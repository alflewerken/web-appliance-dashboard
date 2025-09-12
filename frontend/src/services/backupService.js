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

  static async restoreBackup(file, decryptionKey = null, restoreSnmpMetrics) {
    console.log('🚀 BackupService.restoreBackup called with restoreSnmpMetrics:', restoreSnmpMetrics);
    return this.restoreFromFile(file, decryptionKey, restoreSnmpMetrics);
  }

  static async restoreBackupWithConfirmation(file, decryptionKey = null, restoreSnmpMetrics, confirmInvalidKey = false) {
    console.log('🚀 BackupService.restoreBackupWithConfirmation called with confirmInvalidKey:', confirmInvalidKey);
    return this.restoreFromFile(file, decryptionKey, restoreSnmpMetrics, confirmInvalidKey);
  }

  static async restoreFromFile(file, decryptionKey = null, restoreSnmpMetrics, confirmInvalidKey = false) {
    console.log('🔍 BackupService.restoreFromFile called with restoreSnmpMetrics:', restoreSnmpMetrics);
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

      // Add confirmation flag if provided
      if (confirmInvalidKey) {
        backupData.confirmInvalidKey = true;
      }

      // Add SNMP metrics restore option
      backupData.restoreSnmpMetrics = restoreSnmpMetrics;
      console.log('📊 Setting backupData.restoreSnmpMetrics to:', restoreSnmpMetrics);
      console.log('📦 Full backupData object keys:', Object.keys(backupData));

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

      // Use SSE-enabled restore endpoint - it now has ALL features
      try {
        console.log('🚀 Using SSE-enabled restore endpoint...');
        const sseResponse = await axios.post('/api/restore/progress/start', backupData, {
          timeout: 10000, // Short timeout for immediate response
        });
        
        console.log('📡 SSE Response:', sseResponse.data);
        
        // Check if this is a key validation error response
        if (sseResponse.data.keyValidation && !sseResponse.data.keyValidation.isValid) {
          console.log('❌ Key validation failed from backend');
          return {
            success: false,
            requiresConfirmation: sseResponse.data.requiresConfirmation,
            keyValidation: sseResponse.data.keyValidation,
            message: sseResponse.data.keyValidation.message || 'Falscher Backup-Schlüssel'
          };
        }
        
        if (sseResponse.data.sessionId) {
          console.log('✅ Using SSE-enabled restore, sessionId:', sseResponse.data.sessionId);
          return {
            success: true,
            sessionId: sseResponse.data.sessionId,
            totalItems: sseResponse.data.totalItems,
            message: 'Restore started with real-time progress tracking'
          };
        } else {
          throw new Error('No sessionId received from restore endpoint');
        }
      } catch (error) {
        console.error('❌ Restore error:', error);
        console.error('Full error response:', error.response?.data);
        
        // Check if it's a key validation error
        if (error.response?.data?.keyValidation && !error.response.data.keyValidation.isValid) {
          console.log('❌ Key validation error in catch block');
          return {
            success: false,
            requiresConfirmation: error.response.data.requiresConfirmation,
            keyValidation: error.response.data.keyValidation,
            message: error.response.data.keyValidation.message || 'Falscher Backup-Schlüssel: Der eingegebene Schlüssel ist ungültig.'
          };
        }
        
        // Extract specific error message
        let errorMessage = 'Wiederherstellung fehlgeschlagen';
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // Make error message more specific if it's about decryption
        if (errorMessage.toLowerCase().includes('ungültig') || 
            errorMessage.toLowerCase().includes('schlüssel') ||
            errorMessage.toLowerCase().includes('invalid') ||
            errorMessage.toLowerCase().includes('decrypt') ||
            errorMessage.toLowerCase().includes('key')) {
          errorMessage = 'Falscher Backup-Schlüssel: Der eingegebene Schlüssel ist ungültig und die Daten können nicht entschlüsselt werden.';
        }
        
        return {
          success: false,
          message: errorMessage
        };
      }
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

  static async selectiveImport(filteredData, decryptionKey) {
    try {
      const authToken = localStorage.getItem('token');
      
      // Add decryption key if provided
      if (decryptionKey) {
        filteredData.decryption_key = decryptionKey;
      }
      
      const response = await axios.post('/api/selective-import', filteredData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Selective import error:', error);
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        message: 'Selective import failed: ' + error.message
      };
    }
  }
}
