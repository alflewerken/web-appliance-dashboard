import axios from '../utils/axiosConfig';

// API Service für Backup & Restore
export class BackupService {
  static async getBackupStats() {
    try {
      const response = await axios.get('/api/backup/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch backup stats:', error);
      return {
        totalBackups: 0,
        lastBackupSize: '0 KB',
        lastBackupDate: null,
        nextScheduled: null,
      };
    }
  }

  static async createBackup() {
    try {
      // Use longer timeout for large backups with images
      const response = await axios.get('/api/backup', {
        timeout: 300000, // 5 minutes timeout for large backups
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      const backupData = response.data;

      // Log backup details for debugging

      // Extract encryption key if present
      const encryptionKey = backupData.encryption_key;
      delete backupData.encryption_key; // Remove from backup data before saving

      // Verify background images are included
      const bgImages = backupData.data?.background_images || [];
      const imagesWithData = bgImages.filter(img => img.file_data && img.file_data.length > 0);

      // Create and download file
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Include image info in success message
      const imageInfo = imagesWithData.length > 0 
        ? ` (inkl. ${imagesWithData.length} Hintergrundbilder)` 
        : '';

      return {
        success: true,
        message: `Backup erfolgreich erstellt! ${backupData.metadata.appliances_count} Services${imageInfo} gesichert.`,
        encryptionKey: encryptionKey,
      };
    } catch (error) {
      console.error('Backup error:', error);
      return {
        success: false,
        message: 'Fehler beim Erstellen des Backups: ' + error.message,
      };
    }
  }

  static async restoreBackup(file, decryptionKey = null) {
    return this.restoreFromFile(file, decryptionKey);
  }

  static async restoreFromFile(file, decryptionKey = null) {
    try {
      // Read file
      const fileContent = await file.text();
      // Prüfe ob die Datei leer ist oder nur Whitespace enthält
      if (!fileContent.trim()) {
        throw new Error('Die JSON-Datei ist leer');
      }

      let backupData;
      try {
        backupData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Ungültige JSON-Datei: ${parseError.message}`);
      }

      // Add decryption key if provided
      if (decryptionKey) {
        backupData.decryption_key = decryptionKey;
      }

      // Validate backup structure
      if (!backupData.data || !backupData.data.appliances) {
        throw new Error(
          'Ungültige Backup-Datei. Die Datei enthält keine gültigen Appliance-Daten.'
        );
      }

      // Show confirmation dialog with version info
      const appliancesCount = backupData.data.appliances?.length || 0;
      const categoriesCount = backupData.data.categories?.length || 0;
      const userSettingsCount = backupData.data.user_settings?.length || backupData.data.settings?.length || 0;
      const backgroundsCount = backupData.data.background_images?.length || 0;
      const hostsCount = backupData.data.hosts?.length || 0;
      const servicesCount = backupData.data.services?.length || 0;
      const sshHostsCount = backupData.data.ssh_hosts?.length || 0;
      const sshKeysCount = backupData.data.ssh_keys?.length || 0;
      const sshFileTransfersCount = backupData.data.ssh_upload_log?.length || backupData.data.ssh_upload_logs?.length || 0;
      const customCommandsCount = backupData.data.appliance_commands?.length || backupData.data.custom_commands?.length || 0;
      const usersCount = backupData.data.users?.length || 0;
      const auditLogsCount = backupData.data.audit_logs?.length || 0;
      const snmpMetricsCount = backupData.data.snmp_metrics?.length || 0;
      const snmpInterfacesCount = backupData.data.snmp_interfaces?.length || 0;
      const backupVersion = backupData.version || 'Unbekannt';
      const isOldVersion = backupVersion.startsWith('1.');

      const versionNote = isOldVersion
        ? '\n\n⚠️ Dies ist ein älteres Backup-Format (v1.x). Die SSH-Funktionen werden nicht wiederhergestellt.'
        : '';

      const confirmMessage =
        `⚠️ WARNUNG: Diese Aktion wird alle aktuellen Daten löschen und durch das Backup ersetzen!\n\n` +
        `📊 Das Backup enthält:\n` +
        `• ${appliancesCount} Services\n` +
        `• ${categoriesCount} Kategorien\n` +
        (userSettingsCount > 0 ? `• ${userSettingsCount} Benutzereinstellungen\n` : '') +
        (backgroundsCount > 0 ? `• ${backgroundsCount} Hintergrundbilder\n` : '') +
        (hostsCount > 0 ? `• ${hostsCount} Terminal-Hosts\n` : '') +
        (servicesCount > 0 ? `• ${servicesCount} Proxy-Services\n` : '') +
        (sshHostsCount > 0 ? `• ${sshHostsCount} SSH-Hosts\n` : '') +
        (sshKeysCount > 0 ? `• ${sshKeysCount} SSH-Schlüssel\n` : '') +
        (sshFileTransfersCount > 0 ? `• ${sshFileTransfersCount} Dateiübertragungen (SSH)\n` : '') +
        (customCommandsCount > 0
          ? `• ${customCommandsCount} Eigene Kommandos\n`
          : '') +
        (usersCount > 0 ? `• ${usersCount} Benutzer\n` : '') +
        (auditLogsCount > 0 ? `• ${auditLogsCount} Audit-Log-Einträge\n` : '') +
        (snmpMetricsCount > 0 ? `• ${snmpMetricsCount.toLocaleString()} Monitoring-Metriken\n` : '') +
        (snmpInterfacesCount > 0 ? `• ${snmpInterfacesCount} Netzwerk-Interfaces\n` : '') +
        `• Version: ${backupVersion}\n` +
        `• Erstellt am: ${new Date(backupData.created_at).toLocaleString()}\n` +
        versionNote +
        `\n\nMöchten Sie wirklich fortfahren?`;

      if (!window.confirm(confirmMessage)) {
        return { success: false, message: 'Wiederherstellung abgebrochen' };
      }

      // Second confirmation
      if (
        !window.confirm(
          '🚨 Sind Sie ABSOLUT SICHER?\n\nDiese Aktion kann nicht rückgängig gemacht werden!'
        )
      ) {
        return { success: false, message: 'Wiederherstellung abgebrochen' };
      }

      // Try new SSE-enabled restore endpoint first
      try {
        console.log('🚀 Trying SSE-enabled restore endpoint...');
        const sseResponse = await axios.post('/api/restore/progress/start', backupData, {
          timeout: 10000, // Short timeout for immediate response
        });
        
        console.log('📡 SSE Response:', sseResponse.data);
        
        if (sseResponse.data.sessionId) {
          console.log('✅ Using SSE-enabled restore, sessionId:', sseResponse.data.sessionId);
          return {
            success: true,
            sessionId: sseResponse.data.sessionId,
            totalItems: sseResponse.data.totalItems,
            message: 'Restore started with real-time progress tracking'
          };
        }
      } catch (sseError) {
        console.error('❌ SSE restore endpoint error:', sseError);
        console.log('📌 Falling back to classic restore endpoint');
      }

      // Fallback: Perform restore with extended timeout for large files
      const restoreResponse = await axios.post('/api/restore', backupData, {
        timeout: 300000, // 5 Minuten Timeout für große Backups
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        }
      });
      const result = restoreResponse.data;
      
      // Check if we got a sessionId for SSE tracking
      if (result.sessionId) {
        return {
          success: true,
          sessionId: result.sessionId,
          message: 'Restore started with real-time progress tracking'
        };
      }

      let successMessage;

      if (result.compatibility_mode && result.ssh_auto_initialized) {
        successMessage =
          `✅ Legacy-Backup erfolgreich wiederhergestellt!\n` +
          `🔑 SSH-System wurde automatisch initialisiert!\n\n`;
      } else if (result.compatibility_mode) {
        successMessage = `✅ Legacy-Backup wiederhergestellt! (SSH-System nicht verfügbar)\n\n`;
      } else {
        successMessage = `✅ Backup erfolgreich wiederhergestellt!\n\n`;
      }

      let nextStepsMessage = '';
      if (result.next_steps && result.next_steps.length > 0) {
        nextStepsMessage =
          `\n🚀 Nächste Schritte:\n` +
          result.next_steps.map(step => `• ${step}`).join('\n') +
          '\n';
      }

      return {
        success: true,
        message:
          successMessage +
          `📊 Wiederhergestellte Daten:\n` +
          `• ${result.restored_appliances} Services\n` +
          `• ${result.restored_categories} Kategorien\n` +
          `• ${result.restored_user_settings || result.restored_settings || 0} Benutzereinstellungen\n` +
          `• ${result.restored_background_images} Hintergrundbilder\n` +
          (result.restored_hosts > 0
            ? `• ${result.restored_hosts} Terminal-Hosts\n`
            : '') +
          (result.restored_services > 0
            ? `• ${result.restored_services} Proxy-Services\n`
            : '') +
          (result.restored_ssh_hosts > 0
            ? `• ${result.restored_ssh_hosts} SSH-Hosts\n`
            : '') +
          (result.restored_ssh_keys > 0
            ? `• ${result.restored_ssh_keys} SSH-Schlüssel\n`
            : '') +
          (result.restored_ssh_upload_log > 0 || result.restored_ssh_upload_logs > 0
            ? `• ${result.restored_ssh_upload_log || result.restored_ssh_upload_logs} Dateiübertragungen (SSH)\n`
            : '') +
          (result.restored_appliance_commands > 0 || result.restored_custom_commands > 0
            ? `• ${result.restored_appliance_commands || result.restored_custom_commands} Eigene Kommandos\n`
            : '') +
          (result.restored_users > 0
            ? `• ${result.restored_users} Benutzer verarbeitet` +
              (result.restored_users_new > 0
                ? ` (${result.restored_users_new} neu)`
                : '') +
              '\n'
            : '') +
          (result.restored_audit_logs > 0
            ? `• ${result.restored_audit_logs} Audit-Log-Einträge\n`
            : '') +
          (result.restored_snmp_metrics > 0
            ? `• ${result.restored_snmp_metrics.toLocaleString()} Monitoring-Metriken\n`
            : '') +
          nextStepsMessage +
          `\n🔄 Die Seite wird neu geladen...`,
        reloadRequired: true,
        sshReady: result.ssh_ready || false,
        sshAutoInitialized: result.ssh_auto_initialized || false,
      };
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        return {
          success: false,
          message:
            'Fehler beim Verarbeiten des Backups:\n\n' +
            error.response.data.error,
        };
      }
      return {
        success: false,
        message: 'Fehler beim Verarbeiten des Backups:\n\n' + error.message,
      };
    }
  }
}
