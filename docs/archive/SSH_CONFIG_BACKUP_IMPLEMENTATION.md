# SSH-Config Backup & Restore Implementation

## Durchgeführte Änderungen

### 1. backup.js - SSH Config zum Backup hinzugefügt

**Neue Variable:**
- `let sshConfig = [];` zur Liste der Backup-Variablen hinzugefügt

**SSH Config Daten abrufen:**
```javascript
const [configResult] = await pool.execute(
  'SELECT * FROM ssh_config ORDER BY host_id, config_key'
);
sshConfig = configResult;
console.log(`📊 Found ${sshConfig.length} SSH config entries in database`);
```

**Backup-Datenstruktur erweitert:**
- `ssh_config: sshConfig` zum data-Objekt hinzugefügt
- `ssh_config_count: sshConfig.length` zu metadata hinzugefügt
- `includes_ssh_config: sshConfig.length > 0` zu metadata hinzugefügt
- SSH Config zur total_items Berechnung hinzugefügt

### 2. backup.js - SSH Config Restore implementiert

**Neue Variable:**
- `let restoredSSHConfig = 0;` zur Zählervariablen-Liste hinzugefügt
- `ssh_config` beim Destrukturieren des backupData.data Objekts hinzugefügt

**Restore-Logik (nach SSH Hosts Restore):**
```javascript
// Restore SSH config - only if present in backup
let restoredSSHConfig = 0;
if (ssh_config && ssh_config.length > 0) {
  try {
    console.log(`Restoring ${ssh_config.length} SSH config entries...`);
    await connection.execute('DELETE FROM ssh_config');

    for (const config of ssh_config) {
      // Find the new host ID for this config entry
      let newHostId = config.host_id;
      
      // If SSH hosts were remapped, find the new ID
      if (ssh_hosts && ssh_hosts.length > 0) {
        const originalHost = ssh_hosts.find(h => h.id === config.host_id);
        if (originalHost) {
          const [matchingHosts] = await connection.execute(
            'SELECT id FROM ssh_hosts WHERE host = ? AND username = ? AND port = ?',
            [originalHost.host, originalHost.username, originalHost.port]
          );
          if (matchingHosts.length > 0) {
            newHostId = matchingHosts[0].id;
          }
        }
      }

      // Insert config with new host ID
      await connection.execute(
        `INSERT INTO ssh_config 
         (host_id, config_key, config_value, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [newHostId, config.config_key, config.config_value, createdAt, updatedAt]
      );
      restoredSSHConfig++;
    }
    console.log(`✅ Restored ${restoredSSHConfig} SSH config entries`);
  } catch (error) {
    console.log('Error restoring SSH config:', error.message);
  }
} else if (!isOldVersion) {
  // Clear SSH config for newer backups without data
  try {
    await connection.execute('DELETE FROM ssh_config');
    console.log('✅ Cleared SSH config (none in backup)');
  } catch (error) {
    console.log('Note: Could not clear SSH config table:', error.message);
  }
}
```

**Audit Log & Response erweitert:**
- `ssh_config: restoredSSHConfig` zum audit log hinzugefügt
- `restored_ssh_config: restoredSSHConfig` zur API-Response hinzugefügt

## Wichtige Punkte

1. **Host ID Mapping:** Beim Restore werden SSH Config Einträge korrekt auf die neuen Host-IDs gemappt, falls sich diese durch Auto-Increment geändert haben.

2. **Backward Compatibility:** Alte Backups ohne ssh_config werden korrekt behandelt.

3. **Error Handling:** Fehler beim SSH Config Restore führen nicht zum Abbruch des gesamten Restore-Prozesses.

4. **Logging:** Alle Schritte werden mit aussagekräftigen Log-Meldungen dokumentiert.

## Fehlende Tabellen

Die Tabelle `user_sessions` wird weiterhin NICHT gesichert, was aber sinnvoll ist, da:
- Sessions sind temporär und sollten nach einem Restore nicht wiederhergestellt werden
- Neue Sessions werden beim erneuten Login erstellt
- Dies ist kein Fehler sondern beabsichtigt

## Zusammenfassung

Mit diesen Änderungen werden nun ALLE wichtigen Daten beim Backup gesichert und beim Restore wiederhergestellt:
- ✅ appliances (mit allen Service-Commands und SSH-Verbindungen)
- ✅ categories
- ✅ user_settings
- ✅ background_images (mit Bilddateien)
- ✅ ssh_hosts
- ✅ ssh_keys (mit Dateisystem-Integration)
- ✅ ssh_config (NEU)
- ✅ users (mit Passwort-Hashes)
- ✅ audit_logs
- ✅ role_permissions
- ✅ user_appliance_permissions
- ✅ appliance_commands
- ✅ service_command_logs
- ✅ sessions (nur aktive)
