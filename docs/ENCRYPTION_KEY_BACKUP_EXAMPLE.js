// WARNUNG: Diese Implementierung ist ein Sicherheitsrisiko!
// Nur für Entwicklungs-/Testzwecke verwenden

// In backup.js - NICHT EMPFOHLEN
router.get('/backup', async (req, res) => {
  try {
    // ... existing backup code ...

    // SICHERHEITSRISIKO: Schlüssel im Backup speichern
    const encryptionKeyHash = crypto
      .createHash('sha256')
      .update(process.env.SSH_KEY_ENCRYPTION_SECRET || 'default-insecure-key-change-this-in-production!!')
      .digest('hex');

    const backupData = {
      version: '2.8.0',
      created_at: new Date().toISOString(),
      // WARNUNG: Dies macht das Backup unsicher!
      encryption_key_hash: encryptionKeyHash, // Nur der Hash, nicht der Schlüssel selbst
      encryption_warning: 'Remote desktop passwords require matching encryption key',
      data: {
        // ... rest of backup data
      }
    };

    // ... rest of backup code
  } catch (error) {
    // ... error handling
  }
});

// Beim Restore könnte man prüfen:
router.post('/restore', async (req, res) => {
  const backupData = req.body;
  
  if (backupData.encryption_key_hash) {
    const currentKeyHash = crypto
      .createHash('sha256')
      .update(process.env.SSH_KEY_ENCRYPTION_SECRET || 'default-insecure-key-change-this-in-production!!')
      .digest('hex');
    
    if (currentKeyHash !== backupData.encryption_key_hash) {
      console.warn('Encryption key mismatch - remote desktop passwords will need to be re-entered');
      // Könnte eine Warnung an den Client senden
    }
  }
  
  // ... rest of restore code
});
