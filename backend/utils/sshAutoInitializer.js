// SSH Auto-Initialization Module
// This module ensures SSH keys are always available after backup restore

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const pool = require('./database');

class SSHAutoInitializer {
  constructor() {
    this.sshDir = '/root/.ssh';
  }

  async ensureSSHDirectory() {
    try {
      await fs.mkdir(this.sshDir, { recursive: true, mode: 0o700 });

    } catch (error) {
      console.error('❌ Error creating SSH directory:', error.message);
    }
  }

  async restoreSSHKeysFromDatabase() {
    try {

      // Get all SSH keys from database
      const [keys] = await pool.execute(
        'SELECT key_name, private_key, public_key FROM ssh_keys WHERE private_key IS NOT NULL AND private_key != ""'
      );

      if (keys.length === 0) {

        return false;
      }

      let restoredCount = 0;
      for (const key of keys) {
        try {
          const privateKeyPath = path.join(
            this.sshDir,
            `id_rsa_${key.key_name}`
          );
          const publicKeyPath = path.join(
            this.sshDir,
            `id_rsa_${key.key_name}.pub`
          );

          // Write private key from database
          await fs.writeFile(privateKeyPath, key.private_key, { mode: 0o600 });

          // Test if the private key is valid by trying to generate public key
          const testPublicKey = await this.validateAndFixSSHKey(
            privateKeyPath,
            publicKeyPath,
            key
          );

          if (testPublicKey) {

            restoredCount++;
          } else {

          }
        } catch (keyError) {
          console.error(
            `❌ Error restoring key ${key.key_name}:`,
            keyError.message
          );
        }
      }

      return restoredCount > 0;
    } catch (error) {
      console.error(
        '❌ Error restoring SSH keys from database:',
        error.message
      );
      return false;
    }
  }

  // Neue Methode: SSH-Key validieren und bei Bedarf reparieren
  async validateAndFixSSHKey(privateKeyPath, publicKeyPath, keyData) {
    return new Promise(resolve => {
      // Test if we can generate public key from private key
      const testGen = spawn('ssh-keygen', ['-y', '-f', privateKeyPath]);
      let publicKeyOutput = '';
      let stderr = '';

      testGen.stdout.on('data', data => {
        publicKeyOutput += data.toString();
      });

      testGen.stderr.on('data', data => {
        stderr += data.toString();
      });

      testGen.on('close', async code => {
        if (code === 0 && publicKeyOutput.trim()) {
          try {
            // Private key is valid, write public key
            const publicKey =
              publicKeyOutput.trim() +
              ` ${keyData.key_name}@appliance-dashboard\n`;
            await fs.writeFile(publicKeyPath, publicKey, { mode: 0o644 });
            resolve(true);
          } catch (error) {
            console.error(
              `❌ Error writing public key for ${keyData.key_name}:`,
              error.message
            );
            resolve(false);
          }
        } else {
          // Private key is invalid, try to regenerate using OpenSSL

          this.regenerateSSHKey(privateKeyPath, publicKeyPath, keyData).then(
            resolve
          );
        }
      });

      testGen.on('error', error => {
        console.error(
          `❌ SSH key validation error for ${keyData.key_name}:`,
          error.message
        );
        // Try regeneration on error
        this.regenerateSSHKey(privateKeyPath, publicKeyPath, keyData).then(
          resolve
        );
      });
    });
  }

  // Neue Methode: SSH-Key mit OpenSSL neu generieren
  async regenerateSSHKey(privateKeyPath, publicKeyPath, keyData) {
    return new Promise(resolve => {

      const keyGen = spawn('openssl', [
        'genrsa',
        '-out',
        privateKeyPath,
        '2048',
      ]);

      let stderr = '';
      keyGen.stderr.on('data', data => {
        stderr += data.toString();
      });

      keyGen.on('close', async code => {
        if (code === 0) {
          try {
            // Set correct permissions
            await fs.chmod(privateKeyPath, 0o600);

            // Generate public key
            const pubKeyGen = spawn('ssh-keygen', ['-y', '-f', privateKeyPath]);
            let publicKeyData = '';

            pubKeyGen.stdout.on('data', data => {
              publicKeyData += data.toString();
            });

            pubKeyGen.on('close', async pubCode => {
              if (pubCode === 0) {
                try {
                  // Write public key
                  const publicKey =
                    publicKeyData.trim() +
                    ` ${keyData.key_name}@appliance-dashboard-fixed\n`;
                  await fs.writeFile(publicKeyPath, publicKey, { mode: 0o644 });

                  // Update database with new keys
                  const newPrivateKey = await fs.readFile(
                    privateKeyPath,
                    'utf8'
                  );
                  await pool.execute(
                    'UPDATE ssh_keys SET private_key = ?, public_key = ?, updated_at = NOW() WHERE key_name = ?',
                    [newPrivateKey.trim(), publicKey.trim(), keyData.key_name]
                  );

                  resolve(true);
                } catch (error) {
                  console.error(
                    `❌ Error updating regenerated key ${keyData.key_name}:`,
                    error.message
                  );
                  resolve(false);
                }
              } else {
                console.error(
                  `❌ Public key generation failed for ${keyData.key_name}`
                );
                resolve(false);
              }
            });
          } catch (error) {
            console.error(
              `❌ Error setting permissions for ${keyData.key_name}:`,
              error.message
            );
            resolve(false);
          }
        } else {
          console.error(
            `❌ OpenSSL key generation failed for ${keyData.key_name}:`,
            stderr
          );
          resolve(false);
        }
      });
    });
  }

  async generateDefaultSSHKey() {
    try {

      const keyPath = path.join(this.sshDir, 'id_rsa_dashboard');
      const pubKeyPath = `${keyPath}.pub`;

      // Check if key already exists
      try {
        await fs.access(keyPath);

        return true;
      } catch (error) {
        // Key doesn't exist, generate it
      }

      // Generate SSH key using OpenSSL for better compatibility
      return new Promise(resolve => {
        const keyGen = spawn('openssl', ['genrsa', '-out', keyPath, '2048']);

        let stderr = '';
        keyGen.stderr.on('data', data => {
          stderr += data.toString();
        });

        keyGen.on('close', async code => {
          if (code === 0) {
            try {
              // Set correct permissions
              await fs.chmod(keyPath, 0o600);

              // Generate public key from private key
              const pubKeyGen = spawn('ssh-keygen', ['-y', '-f', keyPath]);
              let publicKeyData = '';

              pubKeyGen.stdout.on('data', data => {
                publicKeyData += data.toString();
              });

              pubKeyGen.on('close', async pubCode => {
                if (pubCode === 0) {
                  try {
                    // Add comment to public key
                    const publicKey =
                      publicKeyData.trim() +
                      ' dashboard@appliance-dashboard-auto\n';

                    // Write public key
                    await fs.writeFile(pubKeyPath, publicKey, { mode: 0o644 });

                    // Read generated keys
                    const privateKey = await fs.readFile(keyPath, 'utf8');

                    // Store in database - check if exists first
                    const [existing] = await pool.execute(
                      'SELECT id FROM ssh_keys WHERE key_name = ? AND created_by IS NULL',
                      ['dashboard']
                    );

                    if (existing.length > 0) {
                      // Update existing key
                      await pool.execute(
                        `UPDATE ssh_keys 
                         SET private_key = ?, 
                             public_key = ?, 
                             key_type = ?, 
                             key_size = ?, 
                             comment = ?, 
                             is_default = ?, 
                             updated_at = NOW()
                         WHERE key_name = ? AND created_by IS NULL`,
                        [
                          privateKey.trim(),
                          publicKey.trim(),
                          'rsa',
                          2048,
                          'Auto-generated dashboard SSH key (OpenSSL)',
                          true,
                          'dashboard'
                        ]
                      );
                    } else {
                      // Insert new key
                      await pool.execute(
                        `INSERT INTO ssh_keys 
                         (key_name, private_key, public_key, key_type, key_size, comment, is_default, created_by, created_at, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW(), NOW())`,
                        [
                          'dashboard',
                          privateKey.trim(),
                          publicKey.trim(),
                          'rsa',
                          2048,
                          'Auto-generated dashboard SSH key (OpenSSL)',
                          true
                        ]
                      );
                    }

                    resolve(true);
                  } catch (dbError) {
                    console.error(
                      '❌ Error storing generated SSH key:',
                      dbError.message
                    );
                    resolve(false);
                  }
                } else {
                  console.error('❌ Public key generation failed');
                  resolve(false);
                }
              });
            } catch (error) {
              console.error('❌ Error setting key permissions:', error.message);
              resolve(false);
            }
          } else {
            console.error('❌ SSH key generation failed:', stderr);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error generating default SSH key:', error.message);
      return false;
    }
  }

  async createSSHConfig() {
    try {
      const configPath = path.join(this.sshDir, 'config');
      const configContent = `# SSH Config auto-generated by Web Appliance Dashboard
# This file is automatically managed - manual changes may be overwritten

Host *
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel QUIET
    ConnectTimeout 10
    ServerAliveInterval 30
    ServerAliveCountMax 3
    PasswordAuthentication no
    PubkeyAuthentication yes
    IdentitiesOnly yes
    BatchMode yes

# Default configuration for dashboard SSH
`;

      await fs.writeFile(configPath, configContent, { mode: 0o600 });

    } catch (error) {
      console.error('❌ Error creating SSH config:', error.message);
    }
  }

  async checkSSHSystem() {
    try {
      // Check if any SSH keys exist in filesystem
      const files = await fs.readdir(this.sshDir).catch(() => []);
      const keyFiles = files.filter(
        f => f.startsWith('id_rsa_') && !f.endsWith('.pub')
      );

      return keyFiles.length > 0;
    } catch (error) {
      return false;
    }
  }

  async initialize() {
    try {

      // Wait for database to be ready
      let dbReady = false;
      let attempts = 0;
      while (!dbReady && attempts < 30) {
        try {
          await pool.execute('SELECT 1');
          dbReady = true;

        } catch (error) {
          attempts++;

          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!dbReady) {

        return false;
      }

      // Ensure SSH directory exists
      await this.ensureSSHDirectory();

      // Check if SSH system is already working
      const sshSystemWorking = await this.checkSSHSystem();
      if (sshSystemWorking) {

        return true;
      }

      // Try to restore SSH keys from database
      const restored = await this.restoreSSHKeysFromDatabase();
      if (restored) {
        await this.createSSHConfig();

        return true;
      }

      // Generate default SSH key if nothing was restored
      const generated = await this.generateDefaultSSHKey();
      if (generated) {
        await this.createSSHConfig();

        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ SSH Auto-Initializer error:', error.message);
      return false;
    }
  }
}

module.exports = SSHAutoInitializer;
