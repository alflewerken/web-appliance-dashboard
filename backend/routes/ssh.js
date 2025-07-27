// SSH Management API - Fixed Version
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { spawn } = require('child_process');
// crypto is not used in this file
const fs = require('fs').promises;
const path = require('path');
const { createAuditLog } = require('../utils/auditLogger');
const sseManager = require('../utils/sseManager');
const { getClientIp } = require('../utils/getClientIp');
const multer = require('multer');
const { execAsync } = require('../utils/ssh');

// SSH Key Management Class
class SSHManager {
  constructor() {
    this.sshDir = '/root/.ssh';
  }

  // Generate SSH key using OpenSSL for better compatibility
  async generateSSHKey(keyName = 'dashboard', keyType = 'rsa', keySize = 2048) {
    return new Promise((resolve, reject) => {
      const privateKeyPath = path.join(this.sshDir, `id_rsa_${keyName}`);
      const publicKeyPath = `${privateKeyPath}.pub`;

      const keygenTimeout = setTimeout(() => {
        if (opensslProcess && !opensslProcess.killed) {
          opensslProcess.kill('SIGTERM');
        }
        reject(new Error('SSH key generation timed out after 30 seconds'));
      }, 30000);

      // Use OpenSSL to generate the private key for better compatibility
      const opensslProcess = spawn('openssl', [
        'genrsa',
        '-out',
        privateKeyPath,
        keySize.toString(),
      ]);

      let stderr = '';

      opensslProcess.stderr.on('data', data => {
        stderr += data.toString();
      });

      opensslProcess.on('close', async code => {
        clearTimeout(keygenTimeout);

        if (code === 0) {
          try {
            // Set correct permissions
            await fs.chmod(privateKeyPath, 0o600);

            // Generate public key from private key
            const sshKeygenProcess = spawn('ssh-keygen', [
              '-y',
              '-f',
              privateKeyPath,
            ]);
            let publicKeyData = '';

            sshKeygenProcess.stdout.on('data', data => {
              publicKeyData += data.toString();
            });

            sshKeygenProcess.on('close', async pubCode => {
              if (pubCode === 0) {
                try {
                  // Add comment to public key
                  const publicKey =
                    publicKeyData.trim() +
                    ` dashboard-${keyName}@appliance-dashboard\n`;

                  // Write public key
                  await fs.writeFile(publicKeyPath, publicKey, { mode: 0o644 });

                  // Read the generated keys
                  const privateKey = await fs.readFile(privateKeyPath, 'utf8');

                  resolve({
                    privateKey: privateKey.trim(),
                    publicKey: publicKey.trim(),
                    keyPath: privateKeyPath,
                    publicKeyPath,
                  });
                } catch (error) {
                  reject(
                    new Error(
                      `Failed to process generated keys: ${error.message}`
                    )
                  );
                }
              } else {
                reject(
                  new Error('Failed to generate public key from private key')
                );
              }
            });
          } catch (error) {
            reject(
              new Error(`Failed to set key permissions: ${error.message}`)
            );
          }
        } else {
          reject(
            new Error(`SSH key generation failed with code ${code}: ${stderr}`)
          );
        }
      });

      opensslProcess.on('error', error => {
        clearTimeout(keygenTimeout);
        reject(new Error(`SSH key generation process error: ${error.message}`));
      });
    });
  }

  // Ensure SSH directory exists
  async ensureSSHDirectory() {
    try {
      await fs.mkdir(this.sshDir, { recursive: true });
      await fs.chmod(this.sshDir, 0o700);
    } catch (error) {
      console.error('Error creating SSH directory:', error);
    }
  }

  // Write SSH key to filesystem
  async writeSSHKey(keyName, privateKey, publicKey) {
    await this.ensureSSHDirectory();

    const privateKeyPath = path.join(this.sshDir, `id_rsa_${keyName}`);
    const publicKeyPath = `${privateKeyPath}.pub`;

    await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
    await fs.writeFile(publicKeyPath, publicKey, { mode: 0o644 });

    return { privateKeyPath, publicKeyPath };
  }

  // Generate SSH config file from database
  async generateSSHConfig() {
    try {
      // Check if deleted_at column exists
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts' AND COLUMN_NAME = 'deleted_at'"
      );

      const hasDeletedColumn = columns.length > 0;

      const [hosts] = await pool.execute(`
        SELECT h.*, k.key_name as key_file
        FROM ssh_hosts h
        LEFT JOIN ssh_keys k ON h.key_name = k.key_name
        WHERE h.is_active = 1 ${hasDeletedColumn ? 'AND h.deleted_at IS NULL' : ''}
        ORDER BY h.hostname
      `);

      let configContent =
        '# Auto-generated SSH config for Appliance Dashboard\n';
      configContent +=
        '# Do not edit manually - changes will be overwritten\n\n';

      for (const host of hosts) {
        const keyFile = path.join(this.sshDir, `id_rsa_${host.key_name}`);

        // Add both hostname and host_id entries for compatibility
        configContent += `Host ${host.hostname}\n`;
        configContent += `    HostName ${host.host}\n`;
        configContent += `    User ${host.username}\n`;
        configContent += `    Port ${host.port}\n`;
        configContent += `    IdentityFile ${keyFile}\n`;
        configContent += `    StrictHostKeyChecking no\n`;
        configContent += `    UserKnownHostsFile /dev/null\n`;
        configContent += `    ServerAliveInterval 30\n`;
        configContent += `    ServerAliveCountMax 3\n`;
        configContent += `    ConnectTimeout 10\n\n`;
        
        // Add host_id entry for upload handler compatibility
        configContent += `Host host_${host.id}\n`;
        configContent += `    HostName ${host.host}\n`;
        configContent += `    User ${host.username}\n`;
        configContent += `    Port ${host.port}\n`;
        configContent += `    IdentityFile ${keyFile}\n`;
        configContent += `    StrictHostKeyChecking no\n`;
        configContent += `    UserKnownHostsFile /dev/null\n`;
        configContent += `    ServerAliveInterval 30\n`;
        configContent += `    ServerAliveCountMax 3\n`;
        configContent += `    ConnectTimeout 10\n\n`;
      }

      const configPath = path.join(this.sshDir, 'config');
      await fs.writeFile(configPath, configContent, { mode: 0o600 });

      return configPath;
    } catch (error) {
      console.error('Error generating SSH config:', error);
      throw error;
    }
  }
}

const sshManager = new SSHManager();

// Get all SSH hosts
router.get('/hosts', async (req, res) => {
  try {
    // Debug: Log all hosts including inactive ones if debug mode
    if (req.query.debug === 'true') {
      const [allHosts] = await pool.execute(
        'SELECT id, hostname, host, username, port, is_active FROM ssh_hosts ORDER BY id'
      );
      console.log('DEBUG: All SSH hosts in database:', allHosts);
    }
    
    const [hosts] = await pool.execute(`
      SELECT h.*, k.key_name as key_exists
      FROM ssh_hosts h
      LEFT JOIN ssh_keys k ON h.key_name = k.key_name
      WHERE h.is_active = 1
      ORDER BY h.hostname
    `);

    res.json({
      success: true,
      hosts: hosts.map(host => ({
        id: host.id,
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        key_name: host.key_name,
        last_tested: host.last_tested,
        test_status: host.test_status,
        connection_string: `${host.username}@${host.host}:${host.port}`,
      })),
    });
  } catch (error) {
    console.error('Error fetching SSH hosts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SSH hosts',
    });
  }
});

// Get all SSH keys
router.get('/keys', async (req, res) => {
  try {
    const [keys] = await pool.execute(`
      SELECT 
        k.id, 
        k.key_name, 
        k.key_type, 
        k.key_size, 
        k.comment, 
        k.is_default, 
        k.created_at,
        COUNT(DISTINCT h.id) as hosts_count
      FROM ssh_keys k
      LEFT JOIN ssh_hosts h ON k.key_name = h.key_name AND h.is_active = 1
      GROUP BY k.id, k.key_name, k.key_type, k.key_size, k.comment, k.is_default, k.created_at
      ORDER BY k.is_default DESC, k.key_name
    `);

    res.json({
      success: true,
      keys,
    });
  } catch (error) {
    console.error('Error fetching SSH keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SSH keys',
    });
  }
});

// Generate new SSH key
router.post('/keys/generate', async (req, res) => {
  try {
    const {
      keyName = 'dashboard',
      keyType = 'rsa',
      keySize = 2048,
      comment = '',
    } = req.body;

    console.log('🔑 Generating SSH key:', { keyName, keyType, keySize });

    if (!keyName.match(/^[a-zA-Z0-9_-]+$/)) {
      return res.status(400).json({
        success: false,
        error:
          'Invalid key name. Use only letters, numbers, hyphens, and underscores.',
      });
    }

    // Check if key already exists
    const [existing] = await pool.execute(
      'SELECT id FROM ssh_keys WHERE key_name = ?',
      [keyName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'SSH key with this name already exists',
      });
    }

    // Ensure SSH directory exists
    await sshManager.ensureSSHDirectory();

    // Generate SSH key
    let keyData;
    try {
      keyData = await sshManager.generateSSHKey(keyName, keyType, keySize);
      console.log('✅ SSH key generated successfully');
    } catch (genError) {
      console.error('❌ SSH key generation failed:', genError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate SSH key',
        details: genError.message,
        troubleshooting: [
          'Check if ssh-keygen is available in container',
          'Verify SSH directory permissions',
          'Ensure sufficient entropy for key generation',
        ],
      });
    }

    try {
      // Store in database
      await pool.execute(
        `
        INSERT INTO ssh_keys (key_name, private_key, public_key, key_type, key_size, comment, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          keyName,
          keyData.privateKey,
          keyData.publicKey,
          keyType,
          keySize,
          comment || `Generated SSH key for ${keyName}`,
          keyName === 'dashboard', // Set as default only for dashboard key
        ]
      );

      console.log('✅ SSH key stored in database');

      // Write key to filesystem
      await sshManager.writeSSHKey(
        keyName,
        keyData.privateKey,
        keyData.publicKey
      );
      console.log('✅ SSH key written to filesystem');

      // Create audit log
      const ipAddress = getClientIp(req);
      await createAuditLog(
        req.user?.id || null,
        'ssh_key_create',
        'ssh_key',
        null,
        {
          key_name: keyName,
          key_type: keyType,
          key_size: keySize,
          created_by: req.user?.username || 'unknown',
        },
        ipAddress
      );

      res.json({
        success: true,
        message: 'SSH key generated successfully',
        key_name: keyName,
        key_type: keyType,
        key_size: keySize,
        public_key: keyData.publicKey,
        fingerprint: keyData.publicKey.split(' ')[1].substring(0, 16) + '...', // Simple fingerprint
      });
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      res.status(500).json({
        success: false,
        error: 'SSH key generated but failed to store in database',
        details: dbError.message,
      });
    }
  } catch (error) {
    console.error('❌ Error generating SSH key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SSH key',
      details: error.message,
    });
  }
});

// Setup SSH key on remote host - IMPROVED VERSION
router.post('/setup', async (req, res) => {
  try {
    const {
      hostname,
      host,
      username,
      password,
      port = 22,
      keyName = 'dashboard',
    } = req.body;

    if (!hostname || !host || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields (hostname, host, username, password) are required',
      });
    }

    console.log(
      `🔧 Setting up SSH for ${username}@${host}:${port} with key ${keyName}`
    );

    // Check if SSH tools are available
    try {
      await new Promise((resolve, reject) => {
        const checkSSH = spawn('which', ['ssh-copy-id']);
        checkSSH.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error('ssh-copy-id not found'));
        });
      });

      await new Promise((resolve, reject) => {
        const checkSSHPass = spawn('which', ['sshpass']);
        checkSSHPass.on('close', code => {
          if (code === 0) resolve();
          else reject(new Error('sshpass not found'));
        });
      });
    } catch (toolError) {
      return res.status(500).json({
        success: false,
        error: 'Required SSH tools not found',
        details: toolError.message,
        missing_tools: ['ssh-copy-id', 'sshpass'],
        installation_help: {
          message: 'SSH tools need to be installed in the container',
          commands: [
            'apk add openssh-client sshpass  # For Alpine',
            'apt-get install openssh-client sshpass  # For Debian/Ubuntu',
          ],
        },
      });
    }

    // Ensure SSH system is initialized
    await sshManager.ensureSSHDirectory();

    // Check if key exists, if not create it
    const keyFile = path.join(sshManager.sshDir, `id_rsa_${keyName}`);
    const pubKeyFile = `${keyFile}.pub`;

    try {
      await fs.access(keyFile);
      console.log(`✅ Using existing SSH key: ${keyName}`);
    } catch (fsError) {
      // Key doesn't exist on filesystem, check database
      const [keys] = await pool.execute(
        'SELECT private_key, public_key FROM ssh_keys WHERE key_name = ?',
        [keyName]
      );

      if (keys.length > 0) {
        // Key exists in database, write to filesystem
        console.log(
          `📝 Writing SSH key from database to filesystem: ${keyName}`
        );
        await sshManager.writeSSHKey(
          keyName,
          keys[0].private_key,
          keys[0].public_key
        );
      } else {
        // Key doesn't exist anywhere, create new one
        console.log(`🔑 Creating new SSH key: ${keyName}`);
        try {
          const keyData = await sshManager.generateSSHKey(keyName);

          // Store in database
          await pool.execute(
            `
            INSERT INTO ssh_keys (key_name, private_key, public_key, key_type, key_size, comment, is_default)
            VALUES (?, ?, ?, 'rsa', 2048, ?, FALSE)
          `,
            [
              keyName,
              keyData.privateKey,
              keyData.publicKey,
              `SSH key for ${hostname}`,
            ]
          );

          // Write to filesystem
          await sshManager.writeSSHKey(
            keyName,
            keyData.privateKey,
            keyData.publicKey
          );
          console.log(`✅ Created and stored new SSH key: ${keyName}`);
        } catch (keyGenError) {
          return res.status(500).json({
            success: false,
            error: 'Failed to generate SSH key',
            details: keyGenError.message,
          });
        }
      }
    }

    // Now attempt to install the key
    return new Promise(resolve => {
      const setupTimeout = setTimeout(() => {
        if (sshCopyId && !sshCopyId.killed) {
          sshCopyId.kill('SIGTERM');
        }
        resolve(
          res.status(500).json({
            success: false,
            error: 'SSH setup timed out after 30 seconds',
            details: 'Please check network connectivity and credentials',
          })
        );
      }, 30000);

      // Use ssh-copy-id with better error handling
      const sshCopyId = spawn('sshpass', [
        '-p',
        password,
        'ssh-copy-id',
        '-i',
        pubKeyFile,
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ConnectTimeout=10',
        '-o',
        'PasswordAuthentication=yes',
        '-o',
        'PubkeyAuthentication=no', // Disable pubkey for initial setup
        '-f', // Force mode to replace existing keys
        '-p',
        port.toString(),
        `${username}@${host}`,
      ]);

      let stdout = '';
      let stderr = '';

      sshCopyId.stdout.on('data', data => {
        const output = data.toString();
        stdout += output;
        console.log('SSH-COPY-ID STDOUT:', output);
      });

      sshCopyId.stderr.on('data', data => {
        const output = data.toString();
        stderr += output;
        console.log('SSH-COPY-ID STDERR:', output);
      });

      sshCopyId.on('close', async code => {
        clearTimeout(setupTimeout);

        console.log(`SSH-COPY-ID finished with exit code: ${code}`);
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);

        // Check for specific error patterns
        const isKeyAlreadyInstalled =
          stderr.includes('already installed') ||
          stderr.includes('key(s) to be installed') ||
          stdout.includes('Number of key(s) added: 0');

        const isAuthFailure =
          stderr.includes('Permission denied') ||
          stderr.includes('Authentication failed');

        const isConnectionFailure =
          stderr.includes('Connection refused') ||
          stderr.includes('No route to host') ||
          stderr.includes('Name or service not known');

        if (code === 0 || isKeyAlreadyInstalled) {
          try {
            // Success or key already installed - verify connection
            console.log(
              `🧪 Verifying SSH connection to ${username}@${host}:${port}`
            );

            // Test the connection to make sure it works
            const testResult = await new Promise(testResolve => {
              const testTimeout = setTimeout(() => {
                if (sshTest) sshTest.kill('SIGTERM');
                testResolve({
                  success: false,
                  error: 'Connection test timeout',
                });
              }, 10000);

              const sshTest = spawn('ssh', [
                '-i',
                keyFile,
                '-o',
                'StrictHostKeyChecking=no',
                '-o',
                'UserKnownHostsFile=/dev/null',
                '-o',
                'ConnectTimeout=5',
                '-o',
                'BatchMode=yes',
                '-p',
                port.toString(),
                `${username}@${host}`,
                'echo "SSH_SETUP_VERIFY" && exit 0',
              ]);

              let testStdout = '';
              let testStderr = '';

              sshTest.stdout.on('data', data => {
                testStdout += data.toString();
              });

              sshTest.stderr.on('data', data => {
                testStderr += data.toString();
              });

              sshTest.on('close', testCode => {
                clearTimeout(testTimeout);
                testResolve({
                  success:
                    testCode === 0 && testStdout.includes('SSH_SETUP_VERIFY'),
                  stdout: testStdout,
                  stderr: testStderr,
                  code: testCode,
                });
              });

              sshTest.on('error', error => {
                clearTimeout(testTimeout);
                testResolve({ success: false, error: error.message });
              });
            });

            if (testResult.success) {
              // Check if host already exists before inserting (only active hosts)
              // Skip this check if we're updating an existing host (indicated by isUpdate flag or existing entry)
              const [existingCheck] = await pool.execute(
                'SELECT id, hostname FROM ssh_hosts WHERE (hostname = ? OR (host = ? AND username = ? AND port = ?)) AND is_active = 1',
                [hostname, host, username, port]
              );

              if (existingCheck.length > 0) {
                const existingHost = existingCheck[0];
                
                // If we found exactly one host and it matches our connection details, this is likely an update
                // In this case, we should update the existing host instead of creating a new one
                if (existingCheck.length === 1 && 
                    existingHost.hostname === hostname) {
                  console.log(`📝 Updating existing SSH host: ${hostname} (ID: ${existingHost.id})`);
                  
                  // Update the key_name for the existing host
                  await pool.execute(
                    'UPDATE ssh_hosts SET key_name = ?, test_status = ? WHERE id = ?',
                    [keyName, 'success', existingHost.id]
                  );
                  
                  // Regenerate SSH config
                  await sshManager.generateSSHConfig();
                  
                  resolve(
                    res.json({
                      success: true,
                      message: 'SSH key updated successfully for existing host',
                      hostId: existingHost.id,
                      isUpdate: true
                    })
                  );
                  return;
                }
                
                // If it's a different host, show error
                let errorMessage = 'SSH-Host existiert bereits';
                
                if (existingHost.hostname === hostname) {
                  errorMessage = `Ein SSH-Host mit dem Namen "${hostname}" existiert bereits`;
                } else {
                  errorMessage = `Ein SSH-Host mit den Verbindungsdaten ${username}@${host}:${port} existiert bereits (Name: ${existingHost.hostname})`;
                }
                
                resolve(
                  res.status(409).json({
                    success: false,
                    error: errorMessage,
                    existingHost: existingHost.hostname
                  })
                );
                return;
              }

              // Add host to database
              const [insertResult] = await pool.execute(
                `
                INSERT INTO ssh_hosts (hostname, host, username, port, key_name, is_active, test_status)
                VALUES (?, ?, ?, ?, ?, TRUE, 'success')
              `,
                [hostname, host, username, port, keyName]
              );

              // Create audit log for new SSH host
              const ipAddress = getClientIp(req);
              await createAuditLog(
                req.user?.id || null,
                'ssh_host_created',
                'ssh_host',
                insertResult.insertId || null,
                {
                  hostname,
                  host,
                  username,
                  port,
                  key_name: keyName,
                  created_by: req.user?.username || 'unknown',
                },
                ipAddress
              );

              // Send SSE event for new host
              sseManager.broadcast({
                type: 'ssh_host_created',
                data: {
                  id: insertResult.insertId,
                  hostname,
                  host,
                  username,
                  port,
                  created_by: req.user?.username || 'unknown',
                },
              });

              // Regenerate SSH config
              await sshManager.generateSSHConfig();

              resolve(
                res.json({
                  success: true,
                  message: isKeyAlreadyInstalled
                    ? 'SSH key was already installed and connection verified'
                    : 'SSH key installed and connection verified successfully',
                  hostname,
                  host,
                  username,
                  port,
                  key_name: keyName,
                  connection_string: `${username}@${host}:${port}`,
                  setupLog: [
                    `✓ SSH key processed for ${keyName}`,
                    `✓ Connection verified to ${username}@${host}:${port}`,
                    `✓ Host registered as "${hostname}"`,
                    `✓ SSH configuration updated`,
                  ],
                })
              );
            } else {
              resolve(
                res.status(500).json({
                  success: false,
                  error:
                    'SSH key may have been installed but connection verification failed',
                  details: `Verification failed: ${testResult.error || testResult.stderr}`,
                  troubleshooting: [
                    'Check if SSH service is running on remote host',
                    'Verify username and credentials',
                    'Ensure SSH key authentication is enabled',
                    'Check firewall and network connectivity',
                  ],
                })
              );
            }
          } catch (dbError) {
            resolve(
              res.json({
                success: true,
                message: 'SSH key installed but database update failed',
                warning:
                  'Connection works but manual database update may be required',
                details: dbError.message,
              })
            );
          }
        } else {
          // Handle specific error cases
          let errorMessage = 'Failed to install SSH key';
          let troubleshooting = [
            'Verify username and password are correct',
            'Check if SSH service is running on remote host',
            'Ensure password authentication is enabled in SSH config',
            'Check network connectivity to the host',
          ];

          if (isAuthFailure) {
            errorMessage =
              'Authentication failed - incorrect username or password';
            troubleshooting = [
              'Double-check the username and password',
              'Verify the account exists on the remote system',
              'Check if password authentication is enabled',
              'Try connecting manually with ssh first',
            ];
          } else if (isConnectionFailure) {
            errorMessage = 'Connection failed - cannot reach remote host';
            troubleshooting = [
              'Verify the host IP address or hostname',
              'Check network connectivity',
              'Ensure SSH service is running on port ' + port,
              'Check firewall settings',
            ];
          }

          resolve(
            res.status(500).json({
              success: false,
              error: errorMessage,
              details:
                stderr || stdout || `ssh-copy-id failed with exit code ${code}`,
              exit_code: code,
              troubleshooting,
              raw_output: {
                stdout,
                stderr,
              },
            })
          );
        }
      });

      sshCopyId.on('error', error => {
        clearTimeout(setupTimeout);
        console.error('SSH-COPY-ID process error:', error);
        resolve(
          res.status(500).json({
            success: false,
            error: 'SSH setup process failed to start',
            details: error.message,
          })
        );
      });
    });
  } catch (error) {
    console.error('Error setting up SSH:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup SSH connection',
      details: error.message,
    });
  }
});

// Initialize SSH system
router.post('/initialize', async (req, res) => {
  try {
    await sshManager.ensureSSHDirectory();

    // Check if default key exists
    const [keys] = await pool.execute(
      'SELECT key_name FROM ssh_keys WHERE key_name = "dashboard"'
    );

    if (keys.length === 0) {
      // Generate default SSH key
      const keyData = await sshManager.generateSSHKey('dashboard');

      await pool.execute(
        `
        INSERT INTO ssh_keys (key_name, private_key, public_key, key_type, key_size, comment, is_default)
        VALUES ('dashboard', ?, ?, 'rsa', 2048, 'Default Dashboard SSH Key', TRUE)
      `,
        [keyData.privateKey, keyData.publicKey]
      );

      // Write key to filesystem
      await sshManager.writeSSHKey(
        'dashboard',
        keyData.privateKey,
        keyData.publicKey
      );
    } else {
      // Ensure existing keys are written to filesystem
      const [keyData] = await pool.execute(
        'SELECT key_name, private_key, public_key FROM ssh_keys'
      );

      for (const key of keyData) {
        await sshManager.writeSSHKey(
          key.key_name,
          key.private_key,
          key.public_key
        );
      }
    }

    // Generate SSH config
    await sshManager.generateSSHConfig();

    res.json({
      success: true,
      message: 'SSH system initialized successfully',
    });
  } catch (error) {
    console.error('Error initializing SSH system:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize SSH system',
      details: error.message,
    });
  }
});

// Test SSH connection
router.post('/test', async (req, res) => {
  try {
    const {
      hostname,
      host,
      username,
      port = 22,
      keyName = 'dashboard',
    } = req.body;

    if (!hostname && !host) {
      return res.status(400).json({
        success: false,
        error: 'Hostname or host is required',
      });
    }

    // Use hostname if provided, otherwise host
    const targetHost = hostname || host;
    const targetUsername = username || 'root';

    console.log(
      `🧪 Testing SSH connection to ${targetUsername}@${targetHost}:${port}`
    );

    // Get SSH key path
    const keyFile = path.join(sshManager.sshDir, `id_rsa_${keyName}`);

    // Check if key exists on filesystem
    try {
      await fs.access(keyFile);
    } catch (fsError) {
      // Try to get key from database and write to filesystem
      const [keys] = await pool.execute(
        'SELECT private_key, public_key FROM ssh_keys WHERE key_name = ?',
        [keyName]
      );

      if (keys.length > 0) {
        await sshManager.writeSSHKey(
          keyName,
          keys[0].private_key,
          keys[0].public_key
        );
      } else {
        return res.status(500).json({
          success: false,
          error: 'SSH key not found. Please initialize SSH system first.',
          suggestion: 'Call POST /api/ssh/initialize to set up SSH keys',
        });
      }
    }

    // Test SSH connection
    return new Promise(resolve => {
      const testTimeout = setTimeout(() => {
        if (sshTest && !sshTest.killed) {
          sshTest.kill('SIGTERM');
        }
        resolve(
          res.status(500).json({
            success: false,
            error: 'SSH test timed out after 15 seconds',
            details:
              'Connection timeout - please check host and network connectivity',
          })
        );
      }, 15000);

      const sshTest = spawn('ssh', [
        '-i',
        keyFile,
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ConnectTimeout=10',
        '-o',
        'BatchMode=yes',
        '-p',
        port.toString(),
        `${targetUsername}@${targetHost}`,
        'echo "SSH_TEST_SUCCESS" && whoami && uptime',
      ]);

      let stdout = '';
      let stderr = '';

      sshTest.stdout.on('data', data => {
        stdout += data.toString();
      });

      sshTest.stderr.on('data', data => {
        stderr += data.toString();
      });

      sshTest.on('close', async code => {
        clearTimeout(testTimeout);

        const testResult = {
          success: code === 0,
          hostname: targetHost,
          username: targetUsername,
          port,
          key_name: keyName,
          exit_code: code,
          timestamp: new Date().toISOString(),
        };

        if (code === 0) {
          // Parse successful output
          const lines = stdout.trim().split('\n');
          testResult.output = {
            test_marker: lines.find(l => l.includes('SSH_TEST_SUCCESS'))
              ? 'found'
              : 'missing',
            remote_user:
              lines.find(
                l =>
                  !l.includes('SSH_TEST_SUCCESS') && !l.includes('load average')
              ) || 'unknown',
            uptime: lines.find(l => l.includes('load average')) || 'unknown',
          };
          testResult.message = 'SSH connection successful';

          // Update database with successful test
          try {
            await pool.execute(
              `
              UPDATE ssh_hosts 
              SET last_tested = NOW(), test_status = 'success' 
              WHERE hostname = ? OR host = ?
            `,
              [targetHost, targetHost]
            );
          } catch (dbError) {
            console.warn('Failed to update test status in database:', dbError);
          }
        } else {
          testResult.error = 'SSH connection failed';
          testResult.details = stderr || stdout || 'Unknown error';
          testResult.troubleshooting = [
            'Check if SSH key is properly installed on remote host',
            'Verify host is reachable and SSH service is running',
            'Ensure correct username and port',
            'Check firewall settings',
          ];

          // Update database with failed test
          try {
            await pool.execute(
              `
              UPDATE ssh_hosts 
              SET last_tested = NOW(), test_status = 'failed' 
              WHERE hostname = ? OR host = ?
            `,
              [targetHost, targetHost]
            );
          } catch (dbError) {
            console.warn('Failed to update test status in database:', dbError);
          }
        }

        resolve(res.status(code === 0 ? 200 : 500).json(testResult));
      });

      sshTest.on('error', error => {
        clearTimeout(testTimeout);
        resolve(
          res.status(500).json({
            success: false,
            error: 'SSH test process failed',
            details: error.message,
            hostname: targetHost,
            username: targetUsername,
            port,
          })
        );
      });
    });
  } catch (error) {
    console.error('Error testing SSH connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test SSH connection',
      details: error.message,
    });
  }
});

// Register existing SSH connection (without password)
router.post('/register', async (req, res) => {
  try {
    const {
      hostname,
      host,
      username,
      port = 22,
      keyName = 'dashboard',
    } = req.body;

    if (!hostname || !host || !username) {
      return res.status(400).json({
        success: false,
        error: 'Hostname, host, and username are required for registration',
      });
    }

    console.log(
      `📝 Registering existing SSH connection: ${username}@${host}:${port}`
    );

    // Check if SSH key exists, if not initialize it
    const keyFile = path.join(sshManager.sshDir, `id_rsa_${keyName}`);

    try {
      await fs.access(keyFile);
    } catch (fsError) {
      // Try to get key from database and write to filesystem
      const [keys] = await pool.execute(
        'SELECT private_key, public_key FROM ssh_keys WHERE key_name = ?',
        [keyName]
      );

      if (keys.length > 0) {
        await sshManager.writeSSHKey(
          keyName,
          keys[0].private_key,
          keys[0].public_key
        );
      } else {
        // Initialize SSH system if no keys exist
        console.log('🔑 No SSH keys found, initializing SSH system...');
        await sshManager.ensureSSHDirectory();
        const keyData = await sshManager.generateSSHKey(keyName);

        await pool.execute(
          `
          INSERT INTO ssh_keys (key_name, private_key, public_key, key_type, key_size, comment, is_default)
          VALUES (?, ?, ?, 'rsa', 2048, 'Auto-generated dashboard key', TRUE)
        `,
          [keyName, keyData.privateKey, keyData.publicKey]
        );

        await sshManager.writeSSHKey(
          keyName,
          keyData.privateKey,
          keyData.publicKey
        );
        console.log('✅ SSH system initialized for registration');
      }
    }

    // Test the connection to verify it works
    return new Promise(resolve => {
      const testTimeout = setTimeout(() => {
        if (sshTest && !sshTest.killed) {
          sshTest.kill('SIGTERM');
        }
        resolve(
          res.status(500).json({
            success: false,
            error: 'SSH registration test timed out',
            details:
              'Could not verify existing SSH connection within 15 seconds',
          })
        );
      }, 15000);

      const sshTest = spawn('ssh', [
        '-i',
        keyFile,
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ConnectTimeout=10',
        '-o',
        'BatchMode=yes',
        '-p',
        port.toString(),
        `${username}@${host}`,
        'echo "SSH_REGISTER_TEST" && whoami',
      ]);

      let stdout = '';
      let stderr = '';

      sshTest.stdout.on('data', data => {
        stdout += data.toString();
      });

      sshTest.stderr.on('data', data => {
        stderr += data.toString();
      });

      sshTest.on('close', async code => {
        clearTimeout(testTimeout);

        if (code === 0) {
          try {
            // Connection works, register it in database
            const [insertResult] = await pool.execute(
              `
              INSERT IGNORE INTO ssh_hosts (hostname, host, username, port, key_name, is_active, test_status)
              VALUES (?, ?, ?, ?, ?, TRUE, 'success')
              ON DUPLICATE KEY UPDATE 
                test_status = 'success',
                last_tested = NOW(),
                is_active = TRUE
            `,
              [hostname, host, username, port, keyName]
            );

            // Create audit log for registered SSH host
            const ipAddress = getClientIp(req);
            await createAuditLog(
              req.user?.id || null,
              'ssh_host_created',
              'ssh_host',
              insertResult.insertId || null,
              {
                hostname,
                host,
                username,
                port,
                key_name: keyName,
                setup_method: 'existing_key',
                created_by: req.user?.username || 'unknown',
              },
              ipAddress
            );

            // Regenerate SSH config
            await sshManager.generateSSHConfig();

            console.log('✅ SSH connection registered successfully');

            resolve(
              res.json({
                success: true,
                message: 'SSH connection registered successfully',
                hostname,
                host,
                username,
                port,
                sshFormat: `ssh ${hostname}`,
                aliasFormat: `${hostname}`,
                details: [
                  'Connection verified and registered',
                  'SSH config updated',
                  'Ready for use in dashboard',
                ],
                setupLog: [
                  `✓ Verified connection to ${username}@${host}:${port}`,
                  `✓ Registered host as "${hostname}"`,
                  `✓ Updated SSH configuration`,
                  `✓ Connection ready for dashboard use`,
                ],
              })
            );
          } catch (dbError) {
            console.error('Database error during registration:', dbError);
            resolve(
              res.status(500).json({
                success: false,
                error:
                  'SSH connection works but failed to register in database',
                details: dbError.message,
              })
            );
          }
        } else {
          console.log('❌ SSH registration test failed');
          resolve(
            res.status(500).json({
              success: false,
              error: 'Cannot register SSH connection - test failed',
              details: stderr || stdout || 'SSH connection test failed',
              troubleshooting: [
                'Ensure SSH keys are properly set up between the systems',
                'Verify the host is reachable and SSH service is running',
                'Check that passwordless SSH login is configured',
                'Use ssh-copy-id to set up the connection first if needed',
              ],
              suggestion:
                'Try using the "Setup" mode instead to configure SSH keys with password',
            })
          );
        }
      });

      sshTest.on('error', error => {
        clearTimeout(testTimeout);
        resolve(
          res.status(500).json({
            success: false,
            error: 'SSH registration test process failed',
            details: error.message,
          })
        );
      });
    });
  } catch (error) {
    console.error('Error registering SSH connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register SSH connection',
      details: error.message,
    });
  }
});

// Create new SSH host
router.post('/hosts', async (req, res) => {
  try {
    const { hostname, host, username, port = 22, key_name = 'dashboard' } = req.body;

    if (!hostname || !host || !username) {
      return res.status(400).json({
        success: false,
        error: 'Hostname, host, and username are required',
      });
    }

    // Validate port
    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      return res.status(400).json({
        success: false,
        error: 'Invalid port number',
      });
    }

    // Check if host already exists (only active hosts)
    const [existing] = await pool.execute(
      'SELECT id, hostname FROM ssh_hosts WHERE (hostname = ? OR (host = ? AND username = ? AND port = ?)) AND is_active = 1',
      [hostname, host, username, portNumber]
    );

    if (existing.length > 0) {
      // Determine which condition matched
      const existingHost = existing[0];
      let errorMessage = 'SSH-Host existiert bereits';
      
      if (existingHost.hostname === hostname) {
        errorMessage = `Ein SSH-Host mit dem Namen "${hostname}" existiert bereits`;
      } else {
        errorMessage = `Ein SSH-Host mit den Verbindungsdaten ${username}@${host}:${portNumber} existiert bereits (Name: ${existingHost.hostname})`;
      }
      
      return res.status(409).json({
        success: false,
        error: errorMessage,
        existingHost: existingHost.hostname
      });
    }

    // Check if key exists
    const [keys] = await pool.execute(
      'SELECT id FROM ssh_keys WHERE key_name = ?',
      [key_name]
    );

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: `SSH key "${key_name}" not found. Please create it first.`,
      });
    }

    // Insert new host
    const [result] = await pool.execute(
      `INSERT INTO ssh_hosts (hostname, host, username, port, key_name, is_active) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [hostname, host, username, portNumber, key_name]
    );

    // Create audit log
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_created',
      'ssh_host',
      result.insertId,
      {
        hostname,
        host,
        username,
        port: portNumber,
        key_name,
        created_by: req.user?.username || 'unknown',
      },
      getClientIp(req)
    );

    // Regenerate SSH config
    await sshManager.generateSSHConfig();

    // Send SSE event
    sseManager.broadcast({
      type: 'ssh_host_created',
      data: {
        id: result.insertId,
        hostname,
        host,
        username,
        port: portNumber,
        key_name,
        created_by: req.user?.username || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'SSH host created successfully',
      host: {
        id: result.insertId,
        hostname,
        host,
        username,
        port: portNumber,
        key_name,
      },
    });
  } catch (error) {
    console.error('Error creating SSH host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create SSH host',
      details: error.message,
    });
  }
});

// Update SSH host
router.put('/hosts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const hostId = parseInt(id, 10);
    const { hostname, host, username, port, key_name } = req.body;

    console.log('Update SSH host request:', { 
      id: id, 
      hostId: hostId,
      hostname, 
      host, 
      username, 
      port, 
      key_name 
    });
    
    // Validate host ID
    if (isNaN(hostId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid host ID',
      });
    }

    if (!hostname || !host || !username || !port) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
    }

    // Ensure port is a number
    const portNumber = parseInt(port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      return res.status(400).json({
        success: false,
        error: 'Invalid port number',
      });
    }

    // Get old data before update for audit log
    const [oldHostData] = await pool.execute(
      'SELECT hostname, host, username, port, key_name FROM ssh_hosts WHERE id = ?',
      [hostId]
    );

    if (oldHostData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH host not found',
      });
    }

    const oldData = oldHostData[0];
    
    console.log('Update SSH host - Old data:', {
      id,
      hostname: oldData.hostname,
      host: oldData.host,
      username: oldData.username,
      port: oldData.port
    });
    
    console.log('Update SSH host - New data:', {
      hostname,
      host,
      username,
      port: portNumber
    });

    // Check if hostname changed and if new hostname already exists
    if (oldData.hostname !== hostname) {
      console.log('Hostname changed, checking for duplicate hostname...');
      
      const [existingHostname] = await pool.execute(
        'SELECT id, hostname FROM ssh_hosts WHERE hostname = ? AND id != ? AND is_active = 1',
        [hostname, hostId]
      );
      
      if (existingHostname.length > 0) {
        console.log(`Hostname conflict: "${hostname}" already exists (ID: ${existingHostname[0].id})`);
        return res.status(409).json({
          success: false,
          error: `Ein SSH-Host mit dem Namen "${hostname}" existiert bereits`
        });
      }
    }

    // Check if the new combination would violate unique constraint
    // Only check if host, username, or port have changed
    const oldPortNumber = parseInt(oldData.port, 10);
    console.log('Port comparison:', {
      oldPort: oldData.port,
      oldPortNumber: oldPortNumber,
      newPortNumber: portNumber,
      portChanged: oldPortNumber !== portNumber
    });
    
    // Only check for duplicates if connection details actually changed
    if (oldData.host !== host || oldData.username !== username || oldPortNumber !== portNumber) {
      console.log('Host details changed, checking for duplicates...');
      
      // DEBUG: Check all hosts with same details
      const [debugCheck] = await pool.execute(
        'SELECT id, hostname, host, username, port, is_active FROM ssh_hosts WHERE host = ? AND username = ? AND port = ?',
        [host, username, portNumber]
      );
      console.log('DEBUG - All hosts with same connection details:', debugCheck);
      
      // First check if deleted_at column exists
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts' AND COLUMN_NAME = 'deleted_at'"
      );
      const hasDeletedColumn = columns.length > 0;
      
      // Build appropriate query based on schema
      const checkQuery = hasDeletedColumn
        ? 'SELECT id, hostname FROM ssh_hosts WHERE host = ? AND username = ? AND port = ? AND id != ? AND deleted_at IS NULL'
        : 'SELECT id, hostname FROM ssh_hosts WHERE host = ? AND username = ? AND port = ? AND id != ? AND is_active = 1';
      
      // Ensure hostId is a string for the SQL query to work correctly
      const [existingHosts] = await pool.execute(checkQuery, [host, username, portNumber, hostId]);
      
      console.log('Duplicate check:', {
        query: checkQuery,
        params: {
          host: host,
          username: username, 
          port: portNumber,
          excludeId: hostId,
          excludeIdType: typeof hostId
        },
        foundHosts: existingHosts.length,
        existingHosts: existingHosts
      });

      if (existingHosts.length > 0) {
        // Double-check: Make sure the conflicting host is not the same host we're updating
        const conflictingHost = existingHosts[0];
        
        // Additional safety check
        if (conflictingHost.id === hostId) {
          console.log('Warning: Conflict detected with same host ID - this should not happen. Continuing with update...');
        } else {
          // We have a real conflict with a different host
          
          // If we have deleted_at column and the conflicting host is deleted, we can remove it
          if (hasDeletedColumn) {
          const [deletedCheck] = await pool.execute(
            'SELECT id, deleted_at FROM ssh_hosts WHERE id = ? AND deleted_at IS NOT NULL',
            [conflictingHost.id]
          );
          
          if (deletedCheck.length > 0) {
            console.log(`Removing deleted host ${conflictingHost.hostname} (ID: ${conflictingHost.id}) to allow update`);
            
            // Delete the old deleted host permanently
            await pool.execute('DELETE FROM ssh_hosts WHERE id = ?', [conflictingHost.id]);
            
            // Continue with the update
            console.log('Deleted host removed, continuing with update...');
          } else {
            // It's an active host, so we have a real conflict
            console.log(`Conflict found: Host ${existingHosts[0].hostname} (ID: ${existingHosts[0].id}) already uses ${username}@${host}:${portNumber}`);
            return res.status(409).json({
              success: false,
              error: 'SSH host with this connection already exists',
              details: `A host with ${username}@${host}:${portNumber} already exists (${existingHosts[0].hostname})`,
            });
          }
        } else {
          // No deleted_at column, check if it's inactive
          const [inactiveCheck] = await pool.execute(
            'SELECT id, is_active FROM ssh_hosts WHERE id = ? AND is_active = FALSE',
            [conflictingHost.id]
          );
          
          if (inactiveCheck.length > 0) {
            console.log(`Removing inactive host ${conflictingHost.hostname} (ID: ${conflictingHost.id}) to allow update`);
            
            // Delete the old inactive host permanently
            await pool.execute('DELETE FROM ssh_hosts WHERE id = ?', [conflictingHost.id]);
            
            // Continue with the update
            console.log('Inactive host removed, continuing with update...');
          } else {
            // It's an active host, so we have a real conflict
            console.log(`Conflict found: Host ${existingHosts[0].hostname} (ID: ${existingHosts[0].id}) already uses ${username}@${host}:${portNumber}`);
            return res.status(409).json({
              success: false,
              error: 'SSH host with this connection already exists',
              details: `A host with ${username}@${host}:${portNumber} already exists (${existingHosts[0].hostname})`,
            });
          }
        }
        } // Close the else block for real conflict
      }
    } else {
      console.log('No changes to host/username/port detected, skipping duplicate check');
    }

    // Update SSH host with proper port number
    await pool.execute(
      `
      UPDATE ssh_hosts 
      SET hostname = ?, host = ?, username = ?, port = ?, key_name = ?
      WHERE id = ?
    `,
      [hostname, host, username, portNumber, key_name || 'dashboard', hostId]
    );

    // Create audit log with old and new data
    const ipAddress = getClientIp(req);
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_updated',
      'ssh_host',
      hostId,
      {
        old_data: {
          hostname: oldData.hostname,
          host: oldData.host,
          username: oldData.username,
          port: oldData.port,
          key_name: oldData.key_name,
        },
        new_data: {
          hostname,
          host,
          username,
          port: portNumber,
          key_name: key_name || 'dashboard',
        },
        updated_by: req.user?.username || 'unknown',
      },
      ipAddress
    );

    // Regenerate SSH config after update
    await sshManager.generateSSHConfig();

    // Send SSE event for updated host
    sseManager.broadcast({
      type: 'ssh_host_updated',
      data: {
        id: hostId,
        hostname,
        changes: {
          hostname:
            oldData.hostname !== hostname
              ? { old: oldData.hostname, new: hostname }
              : null,
          host: oldData.host !== host ? { old: oldData.host, new: host } : null,
          username:
            oldData.username !== username
              ? { old: oldData.username, new: username }
              : null,
          port: oldData.port !== portNumber ? { old: oldData.port, new: portNumber } : null,
          key_name:
            oldData.key_name !== (key_name || 'dashboard')
              ? { old: oldData.key_name, new: key_name || 'dashboard' }
              : null,
        },
        updated_by: req.user?.username || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'SSH host updated successfully',
    });
  } catch (error) {
    console.error('Error updating SSH host:', error);
    
    // Handle specific database errors
    if (error.code === 'ER_DUP_ENTRY') {
      // Parse the error to determine which field caused the duplicate
      if (error.sqlMessage && error.sqlMessage.includes('hostname')) {
        const hostnameMatch = error.sqlMessage.match(/'([^']+)'/);
        const duplicateHostname = hostnameMatch ? hostnameMatch[1] : hostname;
        return res.status(409).json({
          success: false,
          error: `Ein SSH-Host mit dem Namen "${duplicateHostname}" existiert bereits`
        });
      }
      
      return res.status(409).json({
        success: false,
        error: 'SSH host with this connection already exists',
        details: error.sqlMessage,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update SSH host',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Debug endpoint to check for duplicate hosts
router.get('/hosts/debug/:id', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id, 10);
    
    // Get the host details
    const [currentHost] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE id = ?',
      [hostId]
    );
    
    if (currentHost.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    const host = currentHost[0];
    
    // Find all hosts with same connection details
    const [allMatching] = await pool.execute(
      'SELECT id, hostname, host, username, port, is_active FROM ssh_hosts WHERE host = ? AND username = ? AND port = ?',
      [host.host, host.username, host.port]
    );
    
    // Find potential conflicts (excluding current host)
    const [conflicts] = await pool.execute(
      'SELECT id, hostname, host, username, port, is_active FROM ssh_hosts WHERE host = ? AND username = ? AND port = ? AND id != ?',
      [host.host, host.username, host.port, hostId]
    );
    
    res.json({
      currentHost: host,
      allMatchingHosts: allMatching,
      potentialConflicts: conflicts,
      debug: {
        hostId,
        hostIdType: typeof hostId,
        queryParams: {
          host: host.host,
          username: host.username,
          port: host.port
        }
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete SSH host (soft delete if supported)
router.delete('/hosts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if deleted_at column exists
    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts' AND COLUMN_NAME = 'deleted_at'"
    );

    const hasDeletedColumn = columns.length > 0;

    // Get host data before deletion for audit log
    const [hostData] = await pool.execute(
      `SELECT hostname, host, username, port, key_name FROM ssh_hosts WHERE id = ? ${hasDeletedColumn ? 'AND deleted_at IS NULL' : 'AND is_active = TRUE'}`,
      [id]
    );

    if (hostData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH host not found or already deleted',
      });
    }

    const deletedHost = hostData[0];

    // Perform soft delete if column exists, otherwise set is_active to NULL
    if (hasDeletedColumn) {
      await pool.execute(
        'UPDATE ssh_hosts SET deleted_at = NOW(), deleted_by = ?, is_active = NULL WHERE id = ?',
        [req.user?.id || null, id]
      );
    } else {
      // Use NULL for deleted hosts to work with unique constraint
      await pool.execute(
        'UPDATE ssh_hosts SET is_active = NULL WHERE id = ?',
        [id]
      );
    }

    // Create audit log for deletion
    const ipAddress = getClientIp(req);
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_deleted',
      'ssh_host',
      id,
      {
        deleted_host: {
          hostname: deletedHost.hostname,
          host: deletedHost.host,
          username: deletedHost.username,
          port: deletedHost.port,
          key_name: deletedHost.key_name,
        },
        deleted_by: req.user?.username || 'unknown',
      },
      ipAddress
    );

    // Regenerate SSH config after deletion
    await sshManager.generateSSHConfig();

    // Send SSE event for deleted host
    sseManager.broadcast({
      type: 'ssh_host_deleted',
      data: {
        id,
        hostname: deletedHost.hostname,
        deleted_by: req.user?.username || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'SSH host deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SSH host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete SSH host',
      details: error.message,
    });
  }
});

// SSH setup status for frontend
router.get('/setup-status', async (req, res) => {
  try {
    const [hostRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM ssh_hosts WHERE is_active = 1'
    );
    const [keys] = await pool.execute('SELECT COUNT(*) as count FROM ssh_keys');

    // Get actual host list for frontend
    const [hostList] = await pool.execute(`
      SELECT hostname, host, username, port 
      FROM ssh_hosts 
      WHERE is_active = 1 
      ORDER BY hostname
    `);

    const hostCount = hostRows[0]?.count || 0;
    const keyCount = keys[0]?.count || 0;

    // Format hosts array for frontend
    const hosts = hostList.map(
      host => `${host.username}@${host.host}:${host.port}`
    );

    res.json({
      ssh_configured: hostCount > 0,
      total_hosts: hostCount,
      total_keys: keyCount,
      setup_complete: hostCount > 0 && keyCount > 0,
      hosts, // ✅ Füge die fehlende hosts Property hinzu!
      recommendations:
        hostCount === 0 ? ['Setup SSH connection to get started'] : [],
    });
  } catch (error) {
    console.error('SSH setup status error:', error);
    res.status(500).json({
      ssh_configured: false,
      total_hosts: 0,
      total_keys: 0,
      setup_complete: false,
      hosts: [], // ✅ Auch im Fehlerfall hosts Array bereitstellen
      error: 'Failed to get SSH setup status',
    });
  }
});

// Enhanced SSH Routes - Additional endpoints for audit logging

// Middleware to set user context for triggers
router.use(async (req, res, next) => {
  if (req.user?.id) {
    try {
      await pool.execute('SET @current_user_id = ?', [req.user.id]);
    } catch (err) {
      // Ignore errors if variables not supported
    }
  }
  if (getClientIp(req)) {
    try {
      await pool.execute('SET @current_ip_address = ?', [getClientIp(req)]);
    } catch (err) {
      // Ignore errors if variables not supported
    }
  }
  next();
});

// Get SSH host history for a specific host
router.get('/hosts/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if history table exists
    const [tables] = await pool.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts_history'"
    );

    if (tables.length === 0) {
      return res.json({
        success: true,
        history: [],
      });
    }

    const [history] = await pool.execute(
      `
      SELECT 
        h.*,
        u.username as changed_by_username
      FROM ssh_hosts_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.ssh_host_id = ?
      ORDER BY h.changed_at DESC
    `,
      [id]
    );

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Error fetching SSH host history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SSH host history',
    });
  }
});

// Get all SSH hosts including soft-deleted ones
router.get('/hosts/all', async (req, res) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';

    // Check if deleted_at column exists
    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts' AND COLUMN_NAME = 'deleted_at'"
    );

    const hasDeletedColumn = columns.length > 0;

    let query = `
      SELECT 
        h.*,
        k.key_name as key_exists
        ${hasDeletedColumn ? ', u.username as deleted_by_username' : ''}
      FROM ssh_hosts h
      LEFT JOIN ssh_keys k ON h.key_name = k.key_name
      ${hasDeletedColumn ? 'LEFT JOIN users u ON h.deleted_by = u.id' : ''}
    `;

    if (!includeDeleted && hasDeletedColumn) {
      query += ' WHERE h.deleted_at IS NULL';
    } else if (!hasDeletedColumn) {
      query += ' WHERE h.is_active = TRUE';
    }

    query += ' ORDER BY h.hostname';

    const [hosts] = await pool.execute(query);

    res.json({
      success: true,
      hosts: hosts.map(host => ({
        id: host.id,
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        key_name: host.key_name,
        last_tested: host.last_tested,
        test_status: host.test_status,
        is_active: host.is_active,
        deleted_at: hasDeletedColumn ? host.deleted_at : null,
        deleted_by: hasDeletedColumn ? host.deleted_by : null,
        deleted_by_username: hasDeletedColumn ? host.deleted_by_username : null,
        connection_string: `${host.username}@${host.host}:${host.port}`,
      })),
    });
  } catch (error) {
    console.error('Error fetching all SSH hosts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SSH hosts',
    });
  }
});

// Restore deleted SSH host
router.post('/hosts/:id/restore', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Check if deleted_at column exists
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts' AND COLUMN_NAME = 'deleted_at'"
    );

    if (columns.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Soft delete not supported - migration needed',
      });
    }

    // Check if host exists and is deleted
    const [hostData] = await connection.execute(
      'SELECT * FROM ssh_hosts WHERE id = ? AND deleted_at IS NOT NULL',
      [id]
    );

    if (hostData.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'SSH host not found or not deleted',
      });
    }

    const restoredHost = hostData[0];

    // Restore the host
    await connection.execute(
      'UPDATE ssh_hosts SET deleted_at = NULL, deleted_by = NULL WHERE id = ?',
      [id]
    );

    // Create audit log for restore
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_restore',
      'ssh_host',
      id,
      {
        action_type: 'restore',
        restored_host: {
          hostname: restoredHost.hostname,
          host: restoredHost.host,
          username: restoredHost.username,
          port: restoredHost.port,
          key_name: restoredHost.key_name,
        },
        restored_by: req.user?.username || 'unknown',
        deleted_at: restoredHost.deleted_at,
        timestamp: new Date().toISOString(),
      },
      getClientIp(req)
    );

    await connection.commit();

    // Regenerate SSH config
    await sshManager.generateSSHConfig();

    // Send SSE event for restored host
    sseManager.broadcast({
      type: 'ssh_host_restored',
      data: {
        id,
        hostname: restoredHost.hostname,
        restored_by: req.user?.username || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'SSH host restored successfully',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring SSH host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore SSH host',
      details: error.message,
    });
  } finally {
    connection.release();
  }
});

// Revert SSH host to a specific version from history
router.post('/hosts/:id/revert/:historyId', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id, historyId } = req.params;

    // Check if history table exists
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ssh_hosts_history'"
    );

    if (tables.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'History not available - migration needed',
      });
    }

    // Get the history entry
    const [historyData] = await connection.execute(
      'SELECT * FROM ssh_hosts_history WHERE id = ? AND ssh_host_id = ?',
      [historyId, id]
    );

    if (historyData.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'History entry not found',
      });
    }

    const historyEntry = historyData[0];

    // Get current data
    const [currentData] = await connection.execute(
      'SELECT * FROM ssh_hosts WHERE id = ?',
      [id]
    );

    if (currentData.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'SSH host not found',
      });
    }

    // Update to historical values
    await connection.execute(
      `
      UPDATE ssh_hosts 
      SET hostname = ?, host = ?, username = ?, port = ?, key_name = ?, is_active = ?
      WHERE id = ?
    `,
      [
        historyEntry.hostname,
        historyEntry.host,
        historyEntry.username,
        historyEntry.port,
        historyEntry.key_name,
        historyEntry.is_active,
        id,
      ]
    );

    // Create audit log for revert
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_revert',
      'ssh_host',
      id,
      {
        action_type: 'revert',
        reverted_to_history_id: historyId,
        reverted_to_timestamp: historyEntry.changed_at,
        old_data: currentData[0],
        new_data: historyEntry,
        reverted_by: req.user?.username || 'unknown',
        timestamp: new Date().toISOString(),
      },
      getClientIp(req)
    );

    await connection.commit();

    // Regenerate SSH config
    await sshManager.generateSSHConfig();

    // Send SSE event for reverted host
    sseManager.broadcast({
      type: 'ssh_host_reverted',
      data: {
        id,
        hostname: historyEntry.hostname,
        reverted_to: historyEntry.changed_at,
        reverted_by: req.user?.username || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'SSH host reverted successfully',
      reverted_to: historyEntry.changed_at,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting SSH host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert SSH host',
      details: error.message,
    });
  } finally {
    connection.release();
  }
});

// Download SSH key (public or private)
router.get('/keys/:keyName/:type', async (req, res) => {
  try {
    const { keyName, type } = req.params;
    
    if (type !== 'public' && type !== 'private') {
      return res.status(400).json({
        success: false,
        error: 'Invalid key type. Use "public" or "private"',
      });
    }

    // First check database
    const [keys] = await pool.execute(
      'SELECT private_key, public_key FROM ssh_keys WHERE key_name = ?',
      [keyName]
    );

    if (keys.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found',
      });
    }

    const keyContent = type === 'private' ? keys[0].private_key : keys[0].public_key;
    const filename = type === 'private' ? `id_rsa_${keyName}` : `id_rsa_${keyName}.pub`;

    // Create audit log for key download
    await createAuditLog(
      req.user?.id || null,
      'ssh_key_download',
      'ssh_key',
      null,
      {
        key_name: keyName,
        key_type: type,
        downloaded_by: req.user?.username || 'unknown',
      },
      getClientIp(req)
    );

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(keyContent);
  } catch (error) {
    console.error('Error downloading SSH key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download SSH key',
      details: error.message,
    });
  }
});

// Delete SSH key
router.delete('/keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;

    // Get key details before deletion
    const [keyDetails] = await pool.execute(
      'SELECT key_name, is_default FROM ssh_keys WHERE id = ?',
      [keyId]
    );

    if (keyDetails.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found',
      });
    }

    if (keyDetails[0].is_default) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default SSH key',
      });
    }

    // Check if key is in use
    const [hostsUsingKey] = await pool.execute(
      'SELECT COUNT(*) as count FROM ssh_hosts WHERE key_name = ?',
      [keyDetails[0].key_name]
    );

    if (hostsUsingKey[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete SSH key that is in use by SSH hosts',
        hosts_count: hostsUsingKey[0].count,
      });
    }

    // Delete from database
    await pool.execute('DELETE FROM ssh_keys WHERE id = ?', [keyId]);

    // Delete from filesystem
    try {
      const privateKeyPath = path.join(sshManager.sshDir, `id_rsa_${keyDetails[0].key_name}`);
      const publicKeyPath = `${privateKeyPath}.pub`;
      
      await fs.unlink(privateKeyPath).catch(() => {});
      await fs.unlink(publicKeyPath).catch(() => {});
    } catch (fsError) {
      console.error('Error deleting key files:', fsError);
    }

    // Create audit log
    await createAuditLog(
      req.user?.id || null,
      'ssh_key_delete',
      'ssh_key',
      keyId,
      {
        key_name: keyDetails[0].key_name,
        deleted_by: req.user?.username || 'unknown',
      },
      getClientIp(req)
    );

    // Send SSE event
    sseManager.broadcast({
      type: 'ssh_key_deleted',
      data: {
        id: keyId,
        key_name: keyDetails[0].key_name,
        deleted_by: req.user?.username || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'SSH key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SSH key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete SSH key',
      details: error.message,
    });
  }
});

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/tmp/uploads';
    // Ensure directory exists
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024, // 50GB limit
  },
});

// Test route
router.get('/test', (req, res) => {
  console.log('SSH Test Route Hit');
  res.json({ message: 'SSH routes are working' });
});

// Test upload route without multer
router.post('/upload-test', (req, res) => {
  console.log('DEBUG: Upload Test Route Hit');
  res.json({ message: 'Upload route is accessible' });
});

// Upload file via SSH
const handleSSHUpload = require('../utils/sshUploadHandler');
router.post('/upload', upload.single('file'), handleSSHUpload);


// Create terminal session for ttyd
router.post('/terminal-session', async (req, res) => {
  console.log('🚀 Terminal session endpoint called');
  console.log('Request body:', req.body);
  
  try {
    const { hostId, sshConnection } = req.body;
    
    let host = null;
    
    // Option 1: Get host by ID
    if (hostId) {
      const [[hostResult]] = await pool.execute(
        'SELECT * FROM ssh_hosts WHERE id = ? AND is_active = 1',
        [hostId]
      );
      host = hostResult;
    }
    
    // Option 2: Parse SSH connection string
    if (!host && sshConnection) {
      const match = sshConnection.match(/^(.+)@(.+):(\d+)$/);
      if (match) {
        console.log('Parsed SSH connection:', { user: match[1], host: match[2], port: match[3] });
        
        // Try to find host by connection details
        const [[hostResult]] = await pool.execute(
          'SELECT * FROM ssh_hosts WHERE host = ? AND username = ? AND port = ? AND is_active = 1',
          [match[2], match[1], parseInt(match[3])]
        );
        
        if (hostResult) {
          host = hostResult;
          console.log('Found matching SSH host:', host.hostname);
        } else {
          // Create temporary host object
          host = {
            host: match[2],
            username: match[1],
            port: parseInt(match[3]),
            hostname: match[2],
            id: 'temp'
          };
          console.log('Using temporary host from connection string');
        }
      }
    }
    
    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'SSH host not found'
      });
    }

    // Ensure session directory exists
    const sessionDir = '/tmp/terminal-sessions';
    try {
      await fs.mkdir(sessionDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    // Create session data
    const sessionData = `# SSH Session Configuration
SSH_HOST="${host.host}"
SSH_USER="${host.username}"
SSH_PORT="${host.port || 22}"
SSH_HOST_ID="${host.id}"
SSH_HOSTNAME="${host.hostname}"
`;

    // Write as latest-session marker file
    const markerFile = path.join(sessionDir, 'latest-session.conf');
    await fs.writeFile(markerFile, sessionData, 'utf8');
    
    // Also create a unique session file for debugging
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const sessionFile = path.join(sessionDir, `ttyd-session-${sessionId}.conf`);
    await fs.writeFile(sessionFile, sessionData, 'utf8');
    
    // Clean up old session files after 60 seconds
    setTimeout(async () => {
      try {
        await fs.unlink(sessionFile);
      } catch (err) {
        // File might already be deleted
      }
    }, 60000);

    res.json({
      success: true,
      sessionId: sessionId,
      message: 'Terminal session created'
    });
    
  } catch (error) {
    console.error('Error creating terminal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create terminal session',
      details: error.message
    });
  }
});

module.exports = router;

// Debug: Print all registered routes
console.log('SSH Router - Registered routes:');
router.stack.forEach(layer => {
  if (layer.route) {
    console.log(`  ${Object.keys(layer.route.methods).join(', ').toUpperCase()} ${layer.route.path}`);
  }
});
