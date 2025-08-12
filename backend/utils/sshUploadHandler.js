// SSH Upload Handler with progress tracking
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const pool = require('./database');
const { createAuditLog } = require('./auditLogger');

// Helper function to get the appropriate SSH key path
const getSSHKeyPath = (userId = 1) => {
  const fsSync = require('fs');
  const userSpecificKeyPath = `/root/.ssh/id_rsa_user${userId}_dashboard`;
  const genericKeyPath = '/root/.ssh/id_rsa_dashboard';
  
  if (fsSync.existsSync(userSpecificKeyPath)) {
    console.log(`DEBUG: Using user-specific dashboard SSH key for user ${userId}`);
    return userSpecificKeyPath;
  } else if (fsSync.existsSync(genericKeyPath)) {
    console.log('DEBUG: Using generic dashboard SSH key');
    return genericKeyPath;
  }
  
  console.error('DEBUG: No SSH key available');
  return null;
};

const handleSSHUpload = async (req, res) => {
  console.log('DEBUG: SSH Upload Route Handler Called');
  
  let tempFilePath = null;
  let tempKeyPath = null;
  
  try {
    const { hostId, targetPath, hostname, username, port, password } = req.body;
    const file = req.file;

    // Debug: Log what we received
    console.log('DEBUG: Request body:', req.body);
    console.log('DEBUG: Target path received:', targetPath);

    // Validate inputs
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
      });
    }

    if (!targetPath) {
      return res.status(400).json({
        success: false,
        error: 'Missing targetPath',
      });
    }

    console.log('DEBUG: File uploaded:', file.originalname, 'Size:', file.size);
    console.log('DEBUG: Target path:', targetPath);
    
    tempFilePath = file.path;

    let host;
    
    // Check if we have a hostId or direct SSH connection details
    if (hostId) {
      console.log('DEBUG: Host ID provided:', hostId);
      
      // Get host details from database
      let [[dbHost]] = await pool.execute(
        'SELECT id, name, hostname, port, username, password, private_key, ssh_key_name FROM hosts WHERE id = ?',
        [hostId]
      );

      if (!dbHost) {
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
        
        return res.status(404).json({
          success: false,
          error: 'Host not found',
        });
      }
      
      host = dbHost;
    } else if (hostname && username) {
      // Use direct SSH connection details (for services without host entry)
      console.log('DEBUG: Using direct SSH connection:', `${username}@${hostname}:${port || 22}`);
      
      host = {
        id: null, // No database ID
        hostname: hostname,
        username: username,
        port: port || 22,
        password: password || null,
        private_key: null,
        ssh_key_name: 'dashboard' // Use default dashboard key
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Missing host information. Provide either hostId or hostname/username',
      });
    }

    console.log('DEBUG: Found SSH host:', host.hostname, `${host.username}@${host.hostname}:${host.port}`);

    // Set SSE headers for progress streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    // Send initial progress
    res.write(`data: ${JSON.stringify({ phase: 'preparing', progress: 0 })}\n\n`);

    console.log('DEBUG: Host details:', {
      id: host.id,
      hostname: host.hostname,
      username: host.username,
      has_private_key: !!host.private_key,
      private_key_length: host.private_key ? host.private_key.length : 0,
      has_ssh_key_id: !!host.ssh_key_id,
      has_password: !!host.password
    });

    // Check if we need password authentication
    const authPassword = password || host.password;
    const hasPrivateKey = !!host.private_key; // Has key in database
    const hasSSHKeyName = !!host.ssh_key_name; // Has SSH key name configured
    const hasPassword = !!authPassword;
    
    // Use password only if NO SSH key is available (prefer SSH keys over passwords)
    const usePassword = hasPassword && !hasPrivateKey && !hasSSHKeyName;
    
    console.log('DEBUG: Authentication analysis:', {
      hasPrivateKey,
      hasSSHKeyName,
      hasPassword,
      usePassword
    });
    
    console.log('DEBUG: Authentication method:', usePassword ? 'password' : 'key');
    console.log('DEBUG: Has private_key:', !!host.private_key);
    console.log('DEBUG: Has ssh_key_name:', !!host.ssh_key_name);
    console.log('DEBUG: Has ssh_key_id:', !!host.ssh_key_id);
    
    // Create temporary key file if private_key is in database
    if (host.private_key && !usePassword) {
      const crypto = require('crypto');
      tempKeyPath = `/tmp/ssh_key_${crypto.randomBytes(16).toString('hex')}`;
      await fs.writeFile(tempKeyPath, host.private_key, { mode: 0o600 });
      console.log('DEBUG: Created temporary key file:', tempKeyPath);
    }
    
    // Prepare SSH command based on authentication method
    let mkdirCommand;
    
    // Expand ~ to home directory in the command
    const expandedTargetPath = targetPath.startsWith('~') ? 
      `$HOME${targetPath.substring(1)}` : 
      targetPath;
    
    if (usePassword) {
      // Use sshpass for password authentication
      mkdirCommand = ['sshpass', '-p', authPassword, 'ssh', 
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.hostname}`, '-p', host.port || '22', 
                      `mkdir -p "${expandedTargetPath}"`];
    } else if (tempKeyPath) {
      // Use temporary key file
      mkdirCommand = ['ssh', '-i', tempKeyPath,
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.hostname}`, '-p', host.port || '22', 
                      `mkdir -p "${expandedTargetPath}"`];
    } else {
      // Use the default dashboard key (same as terminal)
      const userId = req.user && req.user.id ? req.user.id : 1;
      const defaultKeyPath = getSSHKeyPath(userId);
      
      if (defaultKeyPath) {
        mkdirCommand = ['ssh', '-i', defaultKeyPath,
                        '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                        '-o', 'ConnectTimeout=10',
                        `${host.username}@${host.hostname}`, '-p', host.port || '22', 
                        `mkdir -p "${expandedTargetPath}"`];
      } else {
        console.error('DEBUG: No SSH key available for this host');
        
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
        
        res.write(`data: ${JSON.stringify({ 
          phase: 'error', 
          error: 'SSH nicht eingerichtet. Bitte führen Sie zuerst "SSH einrichten" aus oder geben Sie ein Passwort an.',
          needsSetup: true
        })}\n\n`);
        res.end();
        return;
      }
    }
    
    console.log('DEBUG: Creating remote directory...');
    console.log('DEBUG: mkdirCommand:', mkdirCommand.join(' '));
    const mkdirProcess = spawn(mkdirCommand[0], mkdirCommand.slice(1));
    
    // Capture mkdir output for debugging
    let mkdirError = '';
    mkdirProcess.stderr.on('data', (data) => {
      mkdirError += data.toString();
      console.error('DEBUG: mkdir stderr:', data.toString());
    });
    
    mkdirProcess.stdout.on('data', (data) => {
      console.log('DEBUG: mkdir stdout:', data.toString());
    });
    
    await new Promise((resolve) => {
      mkdirProcess.on('close', (code) => {
        console.log('DEBUG: mkdir exit code:', code);
        if (code !== 0) {
          console.error('DEBUG: mkdir failed with error:', mkdirError);
        }
        resolve();
      });
    });

    // Check if directory exists after mkdir
    console.log('DEBUG: Checking if target directory exists...');
    let checkDirCommand;
    if (usePassword) {
      checkDirCommand = ['sshpass', '-p', authPassword, 'ssh',
                        '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                        '-o', 'ConnectTimeout=10',
                        `${host.username}@${host.hostname}`, '-p', host.port || '22',
                        `test -d "${expandedTargetPath}" && echo 'EXISTS' || echo 'NOT_EXISTS'`];
    } else if (tempKeyPath) {
      checkDirCommand = ['ssh', '-i', tempKeyPath,
                        '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                        '-o', 'ConnectTimeout=10',
                        `${host.username}@${host.hostname}`, '-p', host.port || '22',
                        `test -d "${expandedTargetPath}" && echo 'EXISTS' || echo 'NOT_EXISTS'`];
    } else {
      // Use default dashboard key
      const userId = req.user && req.user.id ? req.user.id : 1;
      const defaultKeyPath = getSSHKeyPath(userId);
      
      if (defaultKeyPath) {
        checkDirCommand = ['ssh', '-i', defaultKeyPath,
                          '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                        '-o', 'ConnectTimeout=10',
                        `${host.username}@${host.hostname}`, '-p', host.port || '22',
                        `test -d "${expandedTargetPath}" && echo 'EXISTS' || echo 'NOT_EXISTS'`];
      } else {
        console.error('DEBUG: No SSH key available for checking directory');
        
        // Clean up temp file
        await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
        
        res.write(`data: ${JSON.stringify({ 
          phase: 'error', 
          error: 'SSH nicht eingerichtet. Bitte führen Sie zuerst "SSH einrichten" aus oder geben Sie ein Passwort an.',
          needsSetup: true
        })}\n\n`);
        res.end();
        return;
      }
    }
    
    const checkDirProcess = spawn(checkDirCommand[0], checkDirCommand.slice(1));
    let dirCheckResult = '';
    
    checkDirProcess.stdout.on('data', (data) => {
      dirCheckResult += data.toString().trim();
    });
    
    await new Promise((resolve) => {
      checkDirProcess.on('close', resolve);
    });
    
    if (dirCheckResult !== 'EXISTS') {
      console.error('DEBUG: Target directory does not exist:', targetPath);
      
      // Clean up temp files
      await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
      if (tempKeyPath) {
        await fs.unlink(tempKeyPath).catch(e => console.error('Failed to clean up temp key file:', e));
      }
      
      res.write(`data: ${JSON.stringify({ 
        phase: 'error', 
        error: `Das Zielverzeichnis "${targetPath}" existiert nicht auf dem Remote-Host.`,
        details: 'Bitte prüfen Sie den Pfad und versuchen Sie es erneut.'
      })}\n\n`);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ phase: 'transferring', progress: 10 })}\n\n`);

    // Build remote path - handle ~ properly
    let remotePath;
    if (targetPath.startsWith('~')) {
      // Expand ~ to $HOME for remote execution
      const expandedPath = `$HOME${targetPath.substring(1)}`;
      remotePath = expandedPath.endsWith('/') ? 
        `${expandedPath}${file.originalname}` : 
        `${expandedPath}/${file.originalname}`;
    } else {
      remotePath = targetPath.endsWith('/') ? 
        `${targetPath}${file.originalname}` : 
        `${targetPath}/${file.originalname}`;
    }
    console.log('DEBUG: Remote path:', remotePath);
    
    console.log('DEBUG: Starting file transfer...');
    console.log('DEBUG: Use password:', usePassword);
    console.log('DEBUG: Host has SSH key:', !!(host.ssh_key_id || host.key_name));
    
    // Check if SSH config exists for key-based auth
    if (!usePassword) {
      const fs = require('fs');
      const configPath = '/root/.ssh/config';
      if (fs.existsSync(configPath)) {
        console.log('DEBUG: SSH config exists');
        const configContent = fs.readFileSync(configPath, 'utf8');
        if (configContent.includes(`host_${host.id}`)) {
          console.log('DEBUG: Host config found in SSH config');
        } else {
          console.error('DEBUG: Host config NOT found in SSH config!');
          console.log('DEBUG: SSH config content:', configContent.substring(0, 200) + '...');
        }
      } else {
        console.error('DEBUG: SSH config does NOT exist!');
      }
    }
    
    // Use rsync for progress tracking with appropriate authentication
    let rsyncArgs;
    if (usePassword) {
      // Use sshpass with rsync for password authentication
      rsyncArgs = ['-p', authPassword, 'rsync', '-avz', '--progress', '-e',
                   `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${host.port || 22}`,
                   tempFilePath,
                   `${host.username}@${host.hostname}:${remotePath}`];
      
      var transferProcess = spawn('sshpass', rsyncArgs);
      console.log('DEBUG: Started sshpass rsync process');
    } else if (tempKeyPath) {
      // Use temporary key file
      rsyncArgs = ['-avz', '--progress', '-e',
                   `ssh -i ${tempKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${host.port || 22}`,
                   tempFilePath,
                   `${host.username}@${host.hostname}:${remotePath}`];
      
      var transferProcess = spawn('rsync', rsyncArgs);
      console.log('DEBUG: Started rsync with temporary key');
      console.log('DEBUG: rsync command:', 'rsync', rsyncArgs.join(' '));
    } else {
      // Use default dashboard key
      const userId = req.user && req.user.id ? req.user.id : 1;
      const defaultKeyPath = getSSHKeyPath(userId);
      
      if (!defaultKeyPath) {
        throw new Error('No SSH key available for authentication');
      }
      
      rsyncArgs = ['-avz', '--progress', '-e',
        `ssh -i ${defaultKeyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${host.port || 22}`,
        tempFilePath,
        `${host.username}@${host.hostname}:${remotePath}`];
      
      var transferProcess = spawn('rsync', rsyncArgs);
      console.log('DEBUG: Started rsync with default dashboard key');
      console.log('DEBUG: rsync command:', 'rsync', rsyncArgs.join(' '));
    }
    
    let lastProgress = 10;
    let rsyncError = '';
    
    transferProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('DEBUG: rsync output:', output);
      
      // Parse rsync progress output
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1]);
        // Map 0-100% rsync progress to 10-90% overall progress
        const mappedProgress = 10 + (percent * 0.8);
        if (mappedProgress > lastProgress) {
          lastProgress = mappedProgress;
          res.write(`data: ${JSON.stringify({ phase: 'transferring', progress: Math.round(mappedProgress) })}\n\n`);
        }
      }
    });

    transferProcess.stderr.on('data', (data) => {
      rsyncError += data.toString();
      console.error('DEBUG: rsync stderr:', data.toString());
    });

    const transferResult = await new Promise((resolve, reject) => {
      transferProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          console.error('DEBUG: rsync failed with exit code:', code);
          console.error('DEBUG: rsync error output:', rsyncError);
          reject(new Error(`rsync exited with code ${code}: ${rsyncError}`));
        }
      });
      
      transferProcess.on('error', (err) => {
        reject(err);
      });
    });

    res.write(`data: ${JSON.stringify({ phase: 'verifying', progress: 90 })}\n\n`);

    // Verify file was transferred
    let verifyCommand;
    if (usePassword) {
      verifyCommand = ['sshpass', '-p', authPassword, 'ssh',
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.hostname}`, '-p', host.port || '22',
                      `ls -la '${remotePath}'`];
    } else if (tempKeyPath) {
      // Use temporary key file
      verifyCommand = ['ssh', '-i', tempKeyPath,
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.hostname}`, '-p', host.port || '22',
                      `ls -la '${remotePath}'`];
    } else {
      // Use default dashboard key
      const userId = req.user && req.user.id ? req.user.id : 1;
      const defaultKeyPath = getSSHKeyPath(userId);
      
      if (!defaultKeyPath) {
        throw new Error('No SSH key available for verification');
      }
      
      verifyCommand = ['ssh', '-i', defaultKeyPath,
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.hostname}`, '-p', host.port || '22',
                      `ls -la '${remotePath}'`];
    }
    
    const verifyProcess = spawn(verifyCommand[0], verifyCommand.slice(1));
    let verifyOutput = '';
    
    verifyProcess.stdout.on('data', (data) => {
      verifyOutput += data.toString();
    });

    await new Promise((resolve) => {
      verifyProcess.on('close', () => resolve());
    });

    console.log('DEBUG: File verified on remote host:', verifyOutput.trim());

    // Clean up temp files
    await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
    if (tempKeyPath) {
      await fs.unlink(tempKeyPath).catch(e => console.error('Failed to clean up temp key file:', e));
    }
    
    // Log successful upload (only if we have a host ID)
    if (host.id) {
      await pool.execute(
        'INSERT INTO ssh_upload_log (host_id, filename, file_size, target_path, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [host.id, file.originalname, file.size, remotePath, 'success']
      );
    }

    // Create audit log with file details
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    try {
      await createAuditLog(
        userId,
        'ssh_file_upload',
        host.id ? 'hosts' : 'services',
        host.id || 0,
        {
          hostname: host.name || host.hostname,
          host_ip: host.hostname,
          target_path: remotePath,
          files: [{
            name: file.originalname,
            bytes: file.size
          }]
        },
        ipAddress
      );
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Don't fail the upload because of audit log error
    }

    // Send final success response
    res.write(`data: ${JSON.stringify({ 
      phase: 'complete', 
      progress: 100,
      success: true,
      message: 'File uploaded and transferred successfully',
      path: remotePath,
      host: host.name || host.hostname,
      size: file.size
    })}\n\n`);
    
    res.end();

  } catch (error) {
    console.error('ERROR in SSH upload handler:', error);
    
    // Clean up temp files if they exist
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
    }
    if (tempKeyPath) {
      await fs.unlink(tempKeyPath).catch(e => console.error('Failed to clean up temp key file:', e));
    }
    
    // Log failed upload if we have hostId
    if (host && host.id && req.file) {
      await pool.execute(
        'INSERT INTO ssh_upload_log (host_id, filename, file_size, target_path, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [host.id, req.file.originalname, req.file.size, 
         path.join(req.body.targetPath || '', req.file.originalname), 'failed', error.message]
      ).catch(e => console.error('Failed to log error:', e));
    }
    
    // Send error response
    if (!res.headersSent) {
      res.write(`data: ${JSON.stringify({
        phase: 'error',
        progress: 0,
        success: false,
        error: 'Failed to transfer file via SSH',
        details: error.message
      })}\n\n`);
      res.end();
    }
  }
};

module.exports = handleSSHUpload;
