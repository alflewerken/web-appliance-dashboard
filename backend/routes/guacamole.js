const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../utils/database');
const { logAuditEvent } = require('../utils/auditLogger');
const { decrypt } = require('../utils/crypto');

// Temporärer Store für Guacamole Tokens
const guacamoleTokens = new Map();

/**
 * Erstellt einen temporären Token für Guacamole Zugriff
 */
router.post('/guacamole/token/:applianceId', async (req, res) => {
  try {
    const { applianceId } = req.params;
    const userId = req.user.userId;
    
    // Prüfe ob User Zugriff auf diese Appliance hat
    const [appliances] = await pool.execute(
      'SELECT * FROM appliances WHERE id = ? AND user_id = ?',
      [applianceId, userId]
    );
    
    if (appliances.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Appliance' });
    }
    
    const appliance = appliances[0];
    
    // Prüfe ob Remote Desktop aktiviert ist
    if (!appliance.remote_desktop_enabled) {
      return res.status(400).json({ error: 'Remote Desktop ist für diese Appliance nicht aktiviert' });
    }    
    // Generiere temporären Token für Guacamole
    const guacToken = crypto.randomBytes(32).toString('hex');
    const connectionId = `${userId}-${applianceId}`;
    
    // Speichere Token mit Ablaufzeit (5 Minuten)
    guacamoleTokens.set(guacToken, {
      userId,
      applianceId,
      connectionId,
      appliance: appliance,
      expires: Date.now() + 300000 // 5 Minuten
    });
    
    // Cleanup alte Tokens
    cleanupExpiredTokens();
    
    // Audit Log
    await logAuditEvent(userId, 'remote_desktop_token_created', 'appliances', applianceId, {
      protocol: appliance.remote_protocol
    });
    
    res.json({
      token: guacToken,
      connectionId,
      expiresIn: 300
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Guacamole Tokens:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});
/**
 * Validiert Guacamole Token (wird von Guacamole Auth Extension aufgerufen)
 */
router.get('/guacamole/validate/:token', async (req, res) => {
  const { token } = req.params;
  
  const tokenData = guacamoleTokens.get(token);
  if (!tokenData || tokenData.expires < Date.now()) {
    return res.status(401).json({ valid: false });
  }
  
  // Token ist nur einmal verwendbar
  guacamoleTokens.delete(token);
  
  // Entschlüssele Passwort wenn vorhanden
  let decryptedPassword = null;
  if (tokenData.appliance.remote_password_encrypted) {
    try {
      decryptedPassword = decrypt(tokenData.appliance.remote_password_encrypted);
    } catch (error) {
      console.error('Fehler beim Entschlüsseln des Passworts:', error);
    }
  }
  
  res.json({
    valid: true,
    connectionId: tokenData.connectionId,
    config: {
      protocol: tokenData.appliance.remote_protocol,
      hostname: tokenData.appliance.remote_host || tokenData.appliance.ip || tokenData.appliance.host,
      port: tokenData.appliance.remote_port?.toString() || (tokenData.appliance.remote_protocol === 'vnc' ? '5900' : '3389'),
      username: tokenData.appliance.remote_username || '',
      password: decryptedPassword || ''
    }
  });
});
/**
 * Cleanup abgelaufene Tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of guacamoleTokens.entries()) {
    if (data.expires < now) {
      guacamoleTokens.delete(token);
    }
  }
}

// Cleanup alle 5 Minuten
setInterval(cleanupExpiredTokens, 300000);

module.exports = router;