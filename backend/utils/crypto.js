// General purpose encryption utilities
const crypto = require('crypto');

// Get encryption key from environment or generate one
const getEncryptionKey = () => {
  let key = process.env.SSH_KEY_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET;

  if (!key) {
    console.warn('Warning: Using default encryption key. Set SSH_KEY_ENCRYPTION_SECRET in production!');
    key = 'default-insecure-key-change-this-in-production!!';
  }

  // Ensure key is exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(key).digest();
};

// Encrypt a string
const encrypt = (text) => {
  if (!text) return null;
  
  const algorithm = 'aes-256-gcm';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return as a single string with format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

// Decrypt a string
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  
  try {
    // Parse the encrypted string
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      console.error('Invalid encrypted format');
      return null;
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const algorithm = 'aes-256-gcm';
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(ivHex, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

module.exports = {
  encrypt,
  decrypt,
  getEncryptionKey,
};
