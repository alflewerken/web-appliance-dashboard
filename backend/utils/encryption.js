// Centralized encryption utilities for password and sensitive data management
const crypto = require('crypto');

class EncryptionManager {
  constructor() {
    // Get the system encryption key from environment
    this.systemKey = process.env.ENCRYPTION_KEY || process.env.SSH_KEY_ENCRYPTION_SECRET || 'default-insecure-key-change-this-in-production!!';
    this.algorithm = 'aes-256-cbc';
  }

  /**
   * Get or set the system encryption key
   */
  getSystemKey() {
    return this.systemKey;
  }

  setSystemKey(key) {
    this.systemKey = key;
    return this;
  }

  /**
   * Generate a hash key from a string for AES-256
   */
  generateKey(keyString) {
    return crypto.createHash('sha256').update(String(keyString)).digest();
  }

  /**
   * Encrypt data using a specific key
   * Returns format: "iv:authTag:encrypted" for GCM or "iv:encrypted" for CBC
   */
  encrypt(plaintext, keyString = null) {
    if (!plaintext) return null;

    try {
      const key = this.generateKey(keyString || this.systemKey);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return in format: iv:encrypted
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption failed:', error.message);
      return null;
    }
  }

  /**
   * Decrypt data using a specific key
   * Accepts multiple formats:
   * - New format: iv:encrypted (CBC)
   * - Legacy with auth tag: iv:encrypted:authTag (GCM)
   * - Legacy plain: just hex
   */
  decrypt(encryptedData, keyString = null) {
    if (!encryptedData) return null;

    try {
      const key = this.generateKey(keyString || this.systemKey);
      let iv, encrypted, authTag;

      // Check format and parse accordingly
      if (encryptedData.includes(':')) {
        const parts = encryptedData.split(':');
        
        if (parts.length === 3) {
          // Legacy GCM format: iv:encrypted:authTag
          // This format was used in older versions
          iv = Buffer.from(parts[0], 'hex');
          encrypted = parts[1];
          authTag = Buffer.from(parts[2], 'hex');
          
          // Try GCM decryption
          try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
          } catch (gcmError) {
            // If GCM fails, try CBC as fallback
            console.log('GCM decryption failed, trying CBC:', gcmError.message);
          }
        }
        
        if (parts.length >= 2) {
          // Standard format: iv:encrypted
          iv = Buffer.from(parts[0], 'hex');
          encrypted = parts[1];
        } else {
          throw new Error('Invalid encrypted data format');
        }
      } else {
        // Legacy format - use fixed IV (backward compatibility)
        iv = Buffer.alloc(16, 0);
        encrypted = encryptedData;
      }

      // Standard CBC decryption
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return null;
    }
  }

  /**
   * Check if data can be decrypted with a given key
   * Used to prevent double encryption
   */
  canDecrypt(encryptedData, keyString = null) {
    if (!encryptedData) return false;
    
    try {
      const decrypted = this.decrypt(encryptedData, keyString);
      // If we can decrypt and get a non-null result, the key works
      return decrypted !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * IMPROVED Re-encrypt data from one key to another
   * Prevents double encryption by checking if data is already encrypted with target key
   */
  reEncrypt(encryptedData, fromKey, toKey = null) {
    if (!encryptedData) return null;
    
    const targetKey = toKey || this.systemKey;
    
    try {
      // CRITICAL: First check if data is already encrypted with the target key
      // This prevents double encryption when keys are the same
      if (this.canDecrypt(encryptedData, targetKey)) {
        console.log('Data already encrypted with target key, skipping re-encryption');
        return encryptedData;
      }
      
      // Try to decrypt with the source key
      const decrypted = this.decrypt(encryptedData, fromKey);
      
      if (!decrypted) {
        // Decryption failed - but let's check if it's because the data
        // is already encrypted with system key (common scenario)
        if (fromKey !== this.systemKey && this.canDecrypt(encryptedData, this.systemKey)) {
          console.log('Data appears to be encrypted with system key already');
          return encryptedData;
        }
        
        console.warn('Could not decrypt data for re-encryption - returning original');
        return encryptedData;
      }

      // Check if decrypted data looks like it might be encrypted data
      // (this catches double-encrypted data)
      if (this.isEncrypted(decrypted)) {
        console.warn('Decrypted data appears to be encrypted - possible double encryption detected');
        // Try to decrypt once more to get actual plaintext
        const doubleDecrypted = this.decrypt(decrypted, fromKey);
        if (doubleDecrypted) {
          console.log('Successfully recovered from double encryption');
          return this.encrypt(doubleDecrypted, targetKey);
        }
      }

      // Normal case: encrypt with the target key
      return this.encrypt(decrypted, targetKey);
    } catch (error) {
      console.error('Re-encryption failed:', error.message);
      return encryptedData; // Return original on failure
    }
  }

  /**
   * Smart re-encrypt that handles various edge cases
   * This is a safer version that tries multiple strategies
   */
  smartReEncrypt(encryptedData, fromKey, toKey = null) {
    if (!encryptedData) return null;
    
    const targetKey = toKey || this.systemKey;
    
    // If the keys are the same, no need to re-encrypt
    if (fromKey === targetKey) {
      console.log('Source and target keys are the same, no re-encryption needed');
      return encryptedData;
    }
    
    // Try the improved reEncrypt first
    const result = this.reEncrypt(encryptedData, fromKey, toKey);
    
    // Verify the result can be decrypted with target key
    if (this.canDecrypt(result, targetKey)) {
      return result;
    }
    
    console.warn('Re-encryption result cannot be decrypted, returning original');
    return encryptedData;
  }

  /**
   * Check if a string looks like encrypted data
   * Supports multiple formats:
   * - New format: iv:encrypted (32 chars : hex data)
   * - Legacy with auth tag: iv:encrypted:authTag (32:hex:32)
   * - Legacy plain: just hex data
   */
  isEncrypted(data) {
    if (!data || typeof data !== 'string') return false;
    
    // New format: iv:encrypted (32 chars : hex data)
    if (data.match(/^[a-f0-9]{32}:[a-f0-9]+$/i)) return true;
    
    // Legacy format with auth tag: iv:encrypted:authTag
    if (data.match(/^[a-f0-9]{32}:[a-f0-9]+:[a-f0-9]+$/i)) return true;
    
    // Legacy format: just hex data of reasonable length
    if (data.match(/^[a-f0-9]{16,}$/i)) return true;
    
    return false;
  }

  /**
   * Batch re-encrypt multiple fields in an object
   * Uses the smart re-encrypt for better handling
   */
  reEncryptObject(obj, fields, fromKey, toKey = null) {
    const result = { ...obj };
    
    for (const field of fields) {
      if (obj[field]) {
        // Use smartReEncrypt for better edge case handling
        result[field] = this.smartReEncrypt(obj[field], fromKey, toKey);
      }
    }
    
    return result;
  }

  /**
   * Legacy compatibility functions
   */
  encryptPassword(plainPassword) {
    return this.encrypt(plainPassword);
  }

  decryptPassword(encryptedPassword) {
    return this.decrypt(encryptedPassword);
  }

  /**
   * Utility function to detect and fix double-encrypted data
   * This can be used for data cleanup
   */
  fixDoubleEncryption(data, key = null) {
    if (!data || !this.isEncrypted(data)) return data;
    
    const workingKey = key || this.systemKey;
    let current = data;
    let decryptionLevels = 0;
    const maxLevels = 5; // Prevent infinite loops
    
    // Keep decrypting until we get non-encrypted data
    while (decryptionLevels < maxLevels) {
      const decrypted = this.decrypt(current, workingKey);
      
      if (!decrypted) {
        // Can't decrypt further
        break;
      }
      
      if (!this.isEncrypted(decrypted)) {
        // We've reached plaintext
        console.log(`Fixed ${decryptionLevels + 1} level(s) of encryption`);
        // Re-encrypt once with the correct key
        return this.encrypt(decrypted, workingKey);
      }
      
      current = decrypted;
      decryptionLevels++;
    }
    
    if (decryptionLevels >= maxLevels) {
      console.error('Too many encryption levels detected, possible corruption');
    }
    
    return data;
  }
}

// Export singleton instance
const encryptionManager = new EncryptionManager();

// Enhanced reEncrypt function that uses the smart version
const reEncrypt = (data, fromKey, toKey) => {
  return encryptionManager.smartReEncrypt(data, fromKey, toKey);
};

module.exports = {
  encryptionManager,
  encrypt: (data, key) => encryptionManager.encrypt(data, key),
  decrypt: (data, key) => encryptionManager.decrypt(data, key),
  reEncrypt,  // Now uses smartReEncrypt
  isEncrypted: (data) => encryptionManager.isEncrypted(data),
  setKey: (key) => encryptionManager.setSystemKey(key),
  getKey: () => encryptionManager.getSystemKey(),
  // New utility exports
  canDecrypt: (data, key) => encryptionManager.canDecrypt(data, key),
  fixDoubleEncryption: (data, key) => encryptionManager.fixDoubleEncryption(data, key)
};