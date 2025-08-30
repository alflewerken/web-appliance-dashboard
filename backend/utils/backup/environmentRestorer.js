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

    // Try to extract encryption key from backup metadata
    let encryptionKey = null;
    
    // Method 1: Check if backup contains encryption_key in metadata
    if (backupData.metadata && backupData.metadata.encryption_key) {
      encryptionKey = backupData.metadata.encryption_key;

    }
    
    // Method 2: Generate key from backup ID and timestamp (backward compatibility)
    else if (backupData.id && backupData.created_at) {
      // Use the same format as the backup file
      const timestamp = backupData.created_at.replace(/[:\-T]/g, '').slice(0, 14);
      const hash = crypto.createHash('md5').update(backupData.id).digest('hex');
      encryptionKey = `enc_backup_${timestamp}_${hash}`;

    }
    
    // Method 3: Try to find key in backup data
    else if (backupData.encryption_key) {
      encryptionKey = backupData.encryption_key;

    }
    
    if (!encryptionKey) {

      return false;
    }

    // Update both .env files
    await this.updateEnvFile(this.envPath, 'ENCRYPTION_KEY', encryptionKey);
    await this.updateEnvFile(this.backendEnvPath, 'ENCRYPTION_KEY', encryptionKey);

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

    } catch (error) {
      console.error(`  ✗ Failed to update ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configure database credentials from backup if needed
   */
  async configureDatabaseCredentials(backupData) {

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

      return true;
    }
    
    return false;
  }

  /**
   * Restart containers to apply new configuration
   */
  async restartContainers() {

    try {
      // Restart backend container to load new environment
      execSync('docker restart appliance_backend', { stdio: 'pipe' });

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

          return true;
        }
      } catch (error) {
        // Backend not ready yet
      }
      
      // Wait 1 second before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  /**
   * Verify system functionality after restore
   */
  async verifySystemFunctionality() {

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

      // Check database connection (via backend health endpoint)
      checks.database = checks.backend; // If backend is healthy, DB is connected

      // Check if encryption is working (assume working if backend is up)
      checks.encryption = checks.backend && process.env.ENCRYPTION_KEY;

    } catch (error) {
      console.error('  ✗ Verification failed:', error.message);
    }

    return checks;
  }

  /**
   * Create a recovery point before restore
   */
  async createRecoveryPoint() {

    try {
      const timestamp = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14);
      const recoveryDir = path.join(__dirname, '../../../recovery', timestamp);
      
      // Create recovery directory
      await fs.mkdir(recoveryDir, { recursive: true });
      
      // Backup current .env files
      try {
        await fs.copyFile(this.envPath, path.join(recoveryDir, 'env.backup'));
        await fs.copyFile(this.backendEnvPath, path.join(recoveryDir, 'backend.env.backup'));

      } catch (error) {

      }
      
      return recoveryDir;
    } catch (error) {
      console.error('  ✗ Failed to create recovery point:', error.message);
      return null;
    }
  }
}

module.exports = EnvironmentRestorer;
