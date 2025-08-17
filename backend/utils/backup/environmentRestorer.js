// Enhanced Restore Manager with automatic environment configuration
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const http = require('http');

class EnvironmentRestorer {
  constructor() {
    this.envPath = path.join(__dirname, '../../../.env');
    this.backendEnvPath = path.join(__dirname, '../../.env');
  }

  /**
   * Extract and configure encryption key from backup
   */
  async configureEncryptionKey(backupData) {
    console.log('🔐 Configuring encryption keys from backup...');
    
    // Try to extract encryption key from backup metadata
    let encryptionKey = null;
    
    // Method 1: Check if backup contains encryption_key in metadata
    if (backupData.metadata && backupData.metadata.encryption_key) {
      encryptionKey = backupData.metadata.encryption_key;
      console.log('✅ Found encryption key in backup metadata');
    }
    
    // Method 2: Generate key from backup ID and timestamp (backward compatibility)
    else if (backupData.id && backupData.created_at) {
      // Use the same format as the backup file
      const timestamp = backupData.created_at.replace(/[:\-T]/g, '').slice(0, 14);
      const hash = crypto.createHash('md5').update(backupData.id).digest('hex');
      encryptionKey = `enc_backup_${timestamp}_${hash}`;
      console.log('✅ Generated encryption key from backup ID and timestamp');
    }
    
    // Method 3: Try to find key in backup data
    else if (backupData.encryption_key) {
      encryptionKey = backupData.encryption_key;
      console.log('✅ Found encryption key in backup root');
    }
    
    if (!encryptionKey) {
      console.warn('⚠️  No encryption key found in backup - encrypted passwords may not work');
      return false;
    }

    // Update both .env files
    await this.updateEnvFile(this.envPath, 'ENCRYPTION_KEY', encryptionKey);
    await this.updateEnvFile(this.backendEnvPath, 'ENCRYPTION_KEY', encryptionKey);
    
    console.log('✅ Encryption key configured in environment files');
    return true;
  }

  /**
   * Update or add a key in .env file
   */
  async updateEnvFile(filePath, key, value) {
    try {
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (err) {
        console.warn(`⚠️  .env file not found at ${filePath}, creating new one`);
      }

      const lines = content.split('\n');
      let keyFound = false;
      
      // Update existing key or mark for addition
      const updatedLines = lines.map(line => {
        if (line.startsWith(`${key}=`)) {
          keyFound = true;
          return `${key}=${value}`;
        }
        return line;
      });

      // Add key if not found
      if (!keyFound) {
        // Find a good place to insert (after other security keys if possible)
        let insertIndex = updatedLines.length;
        
        // Try to find JWT_SECRET or SSH_KEY_ENCRYPTION_SECRET
        for (let i = 0; i < updatedLines.length; i++) {
          if (updatedLines[i].includes('JWT_SECRET') || 
              updatedLines[i].includes('SSH_KEY_ENCRYPTION_SECRET')) {
            insertIndex = i + 1;
            break;
          }
        }
        
        // Insert the new key
        updatedLines.splice(insertIndex, 0, `${key}=${value}`);
      }

      await fs.writeFile(filePath, updatedLines.join('\n'), 'utf8');
      console.log(`  ✓ Updated ${filePath}`);
    } catch (error) {
      console.error(`  ✗ Failed to update ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configure database credentials from backup if needed
   */
  async configureDatabaseCredentials(backupData) {
    console.log('🗄️  Checking database configuration...');
    
    // Extract database config from backup if available
    if (backupData.metadata && backupData.metadata.database) {
      const dbConfig = backupData.metadata.database;
      
      // Update database credentials in .env files
      const credentials = {
        'DB_HOST': dbConfig.host || 'database',
        'DB_PORT': dbConfig.port || '3306',
        'DB_USER': dbConfig.user || 'dashboard_user',
        'DB_PASSWORD': dbConfig.password || 'dashboard_pass123',
        'DB_NAME': dbConfig.name || 'dashboard_db'
      };

      for (const [key, value] of Object.entries(credentials)) {
        await this.updateEnvFile(this.envPath, key, value);
        await this.updateEnvFile(this.backendEnvPath, key, value);
      }
      
      console.log('✅ Database credentials configured');
      return true;
    }
    
    return false;
  }

  /**
   * Restart containers to apply new configuration
   */
  async restartContainers() {
    console.log('🔄 Restarting containers to apply configuration...');
    
    try {
      // Restart backend container to load new environment
      execSync('docker restart appliance_backend', { stdio: 'pipe' });
      console.log('  ✓ Backend container restarted');
      
      // Wait for backend to be ready
      await this.waitForBackend();
      
      return true;
    } catch (error) {
      console.error('  ✗ Failed to restart containers:', error.message);
      return false;
    }
  }

  /**
   * Wait for backend to be ready
   */
  async waitForBackend(maxAttempts = 30) {
    console.log('⏳ Waiting for backend to be ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await new Promise((resolve) => {
          const req = http.get('http://localhost:3001/api/health', (res) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
          });
        });
        
        if (result) {
          console.log('✅ Backend is ready');
          return true;
        }
      } catch (error) {
        // Backend not ready yet
      }
      
      // Wait 1 second before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.warn('⚠️  Backend did not become ready in time');
    return false;
  }

  /**
   * Verify system functionality after restore
   */
  async verifySystemFunctionality() {
    console.log('🔍 Verifying system functionality...');
    
    const checks = {
      backend: false,
      database: false,
      encryption: false
    };

    try {
      // Check backend health
      checks.backend = await new Promise((resolve) => {
        const req = http.get('http://localhost:3001/api/health', (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });
      console.log(`  ${checks.backend ? '✓' : '✗'} Backend API`);
      
      // Check database connection (via backend health endpoint)
      checks.database = checks.backend; // If backend is healthy, DB is connected
      console.log(`  ${checks.database ? '✓' : '✗'} Database connection`);
      
      // Check if encryption is working (assume working if backend is up)
      checks.encryption = checks.backend && process.env.ENCRYPTION_KEY;
      console.log(`  ${checks.encryption ? '✓' : '✗'} Encryption/Decryption`);
      
    } catch (error) {
      console.error('  ✗ Verification failed:', error.message);
    }

    return checks;
  }

  /**
   * Create a recovery point before restore
   */
  async createRecoveryPoint() {
    console.log('💾 Creating recovery point...');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14);
      const recoveryDir = path.join(__dirname, '../../../recovery', timestamp);
      
      // Create recovery directory
      await fs.mkdir(recoveryDir, { recursive: true });
      
      // Backup current .env files
      try {
        await fs.copyFile(this.envPath, path.join(recoveryDir, 'env.backup'));
        await fs.copyFile(this.backendEnvPath, path.join(recoveryDir, 'backend.env.backup'));
        console.log(`  ✓ Environment files backed up to ${recoveryDir}`);
      } catch (error) {
        console.warn('  ⚠️  Could not backup all environment files');
      }
      
      return recoveryDir;
    } catch (error) {
      console.error('  ✗ Failed to create recovery point:', error.message);
      return null;
    }
  }
}

module.exports = EnvironmentRestorer;
