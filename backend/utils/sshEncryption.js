// SSH Key Encryption utilities
const crypto = require('crypto');

// Get encryption key from environment or generate one
const getEncryptionKey = () => {
  let key = process.env.SSH_KEY_ENCRYPTION_SECRET;

  if (!key) {
    key = 'default-insecure-key-change-this-in-production!!';
  }

  // Ensure key is exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(key).digest();
};

// Encrypt SSH private key
const encryptSSHKey = privateKey => {
  const algorithm = 'aes-256-gcm';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return encrypted data with IV and auth tag
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm,
  };
};

// Decrypt SSH private key
const decryptSSHKey = encryptedData => {
  if (!encryptedData || typeof encryptedData === 'string') {
    // If it's a plain string, assume it's not encrypted (backward compatibility)
    return encryptedData;
  }

  const { encrypted, iv, authTag, algorithm = 'aes-256-gcm' } = encryptedData;

  if (!encrypted || !iv || !authTag) {
    return encryptedData; // Return as-is for backward compatibility
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

// Check if a key is encrypted
const isKeyEncrypted = keyData => {
  if (typeof keyData === 'string') {
    return false;
  }

  return (
    keyData &&
    typeof keyData === 'object' &&
    keyData.encrypted &&
    keyData.iv &&
    keyData.authTag
  );
};

// Migrate unencrypted keys to encrypted format
const migrateUnencryptedKeys = async pool => {
  try {
    const [keys] = await pool.execute(
      'SELECT id, key_name, private_key FROM ssh_keys'
    );

    let migratedCount = 0;

    for (const key of keys) {
      try {
        // Try to parse as JSON first
        const keyData = JSON.parse(key.private_key);

        if (!isKeyEncrypted(keyData)) {
          // This shouldn't happen with JSON data
        }
      } catch (e) {
        // Not JSON, so it's a plain text key
        const encryptedData = encryptSSHKey(key.private_key);

        await pool.execute('UPDATE ssh_keys SET private_key = ? WHERE id = ?', [
          JSON.stringify(encryptedData),
          key.id,
        ]);

        migratedCount++;
      }
    }

    if (migratedCount > 0) {

    } else {

    }
  } catch (error) {
    console.error('Error during SSH key migration:', error);
    throw error;
  }
};

module.exports = {
  encryptSSHKey,
  decryptSSHKey,
  isKeyEncrypted,
  migrateUnencryptedKeys,
};
