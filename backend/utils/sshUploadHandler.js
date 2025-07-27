// SSH Upload Handler with progress tracking
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const pool = require('./database');

const handleSSHUpload = async (req, res) => {
  console.log('DEBUG: SSH Upload Route Handler Called');
  
  let tempFilePath = null;
  
  try {
    const { hostId, targetPath } = req.body;
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

    if (!hostId) {
      return res.status(400).json({
        success: false,
        error: 'Missing hostId',
      });
    }

    console.log('DEBUG: File uploaded:', file.originalname, 'Size:', file.size);
    console.log('DEBUG: Target path:', targetPath);
    console.log('DEBUG: Host ID:', hostId);
    
    tempFilePath = file.path;

    // Get SSH host details from database
    const [[host]] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE id = ? AND is_active = 1',
      [hostId]
    );

    if (!host) {
      // Clean up temp file
      await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
      
      return res.status(404).json({
        success: false,
        error: 'SSH host not found or inactive',
      });
    }

    console.log('DEBUG: Found SSH host:', host.hostname, `${host.username}@${host.host}:${host.port}`);

    // Set SSE headers for progress streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    // Send initial progress
    res.write(`data: ${JSON.stringify({ phase: 'preparing', progress: 0 })}\n\n`);

    // Check if we need password authentication
    const password = req.body.password;
    const usePassword = (!host.ssh_key_id && !host.key_name) || (host.requiresPassword && password);
    
    // Prepare SSH command based on authentication method
    let mkdirCommand;
    if (usePassword) {
      // Use sshpass for password authentication
      mkdirCommand = ['sshpass', '-p', password, 'ssh', 
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.host}`, '-p', host.port || '22', 
                      `mkdir -p '${targetPath}'`];
    } else {
      // Use key-based authentication with SSH config
      // SSH config contains the host configuration with the correct key
      mkdirCommand = ['ssh', '-F', '/root/.ssh/config',
                      `host_${host.id}`, 
                      `mkdir -p '${targetPath}'`];
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

    res.write(`data: ${JSON.stringify({ phase: 'transferring', progress: 10 })}\n\n`);

    // Build remote path
    const remotePath = path.join(targetPath, file.originalname);
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
      rsyncArgs = ['-p', password, 'rsync', '-avz', '--progress', '-e',
                   `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${host.port || 22}`,
                   tempFilePath,
                   `${host.username}@${host.host}:${remotePath}`];
      
      var transferProcess = spawn('sshpass', rsyncArgs);
      console.log('DEBUG: Started sshpass rsync process');
    } else {
      // Use key-based authentication with SSH config
      rsyncArgs = ['-avz', '--progress', '-e',
                   `ssh -F /root/.ssh/config`,
                   tempFilePath,
                   `host_${host.id}:${remotePath}`];
      
      var transferProcess = spawn('rsync', rsyncArgs);
      console.log('DEBUG: Started rsync with SSH config');
      console.log('DEBUG: rsync command:', 'rsync', rsyncArgs.join(' '));
    }
    
    let lastProgress = 10;
    
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
      console.error('DEBUG: rsync stderr:', data.toString());
    });

    const transferResult = await new Promise((resolve, reject) => {
      transferProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          reject(new Error(`rsync exited with code ${code}`));
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
      verifyCommand = ['sshpass', '-p', password, 'ssh',
                      '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                      '-o', 'ConnectTimeout=10',
                      `${host.username}@${host.host}`, '-p', host.port || '22',
                      `ls -la '${remotePath}'`];
    } else {
      // Use SSH config for key-based authentication
      verifyCommand = ['ssh', '-F', '/root/.ssh/config',
                      `host_${host.id}`,
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

    // Clean up temp file
    await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
    
    // Log successful upload
    await pool.execute(
      'INSERT INTO ssh_upload_log (host_id, filename, file_size, target_path, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [hostId, file.originalname, file.size, remotePath, 'success']
    );

    // Send final success response
    res.write(`data: ${JSON.stringify({ 
      phase: 'complete', 
      progress: 100,
      success: true,
      message: 'File uploaded and transferred successfully',
      path: remotePath,
      host: host.hostname,
      size: file.size
    })}\n\n`);
    
    res.end();

  } catch (error) {
    console.error('ERROR in SSH upload handler:', error);
    
    // Clean up temp file if it exists
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(e => console.error('Failed to clean up temp file:', e));
    }
    
    // Log failed upload if we have hostId
    if (req.body.hostId && req.file) {
      await pool.execute(
        'INSERT INTO ssh_upload_log (host_id, filename, file_size, target_path, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [req.body.hostId, req.file.originalname, req.file.size, 
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
