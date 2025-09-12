import React, { useState } from 'react';
import { BackupService } from '../services/backupService';
import { useRestoreWithValidation } from './useRestoreWithValidation';
import { RestoreKeyDialog } from '../components/SettingsPanel';
import InvalidKeyDialog from '../components/SettingsPanel/InvalidKeyDialog';
import RestoreProgressDialog from '../components/SettingsPanel/RestoreProgressDialog';

export const useDragAndDrop = (
  showSettingsModal,
  activeSettingsTab,
  setActiveSettingsTab,
  setShowSettingsModal,
  setFormData,
  setEditingAppliance,
  setShowModal,
  uploadBackgroundImage,
  selectedCategory,
  setSelectedServiceForPanel,
  setShowServicePanel
) => {
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [restoreItemCounts, setRestoreItemCounts] = useState({});
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [restoreSessionId, setRestoreSessionId] = useState(null);
  
  // Use the centralized restore hook
  const {
    validateAndRestore,
    showInvalidKeyDialog,
    invalidKeyHandlers
  } = useRestoreWithValidation();
  
  // DISABLE drag&drop restore if we're in the Backup tab
  const isInBackupTab = showSettingsModal && activeSettingsTab === 'backup';

  // Funktion zum Wiederherstellen mit Schlüssel (now using centralized validation)
  const handleRestoreWithKey = async (decryptionKey, restoreSnmpMetrics = true) => {
    if (!pendingRestoreFile) {
      setShowRestoreDialog(false);
      return;
    }
    
    try {
      // First, read the file to get item counts for progress dialog
      const fileContent = await pendingRestoreFile.text();
      const backupData = JSON.parse(fileContent);
      
      // Extract item counts for progress display
      const itemCounts = {
        categories: backupData.data?.categories?.length || 0,
        appliances: backupData.data?.appliances?.length || 0,
        users: backupData.data?.users?.length || 0,
        background_images: backupData.data?.background_images?.length || 0,
        hosts: backupData.data?.hosts?.length || 0,
        ssh_keys: backupData.data?.ssh_keys?.length || 0,
        snmp_metrics: backupData.data?.snmp_metrics?.length || 0,
        snmp_interfaces: backupData.data?.snmp_interfaces?.length || 0,
      };
      
      setRestoreItemCounts(itemCounts);
      setShowRestoreDialog(false); // Close key dialog
      
      // Create a new File object since we already read it
      const newFile = new File([fileContent], pendingRestoreFile.name, { type: 'application/json' });
      
      // Use centralized validation and restore
      await validateAndRestore(
        newFile,
        decryptionKey,
        {
          restoreSnmpMetrics,
          onSuccess: (result) => {
            if (result.sessionId) {
              console.log('✅ Got sessionId from restore:', result.sessionId);
              setRestoreSessionId(result.sessionId);
              setShowProgressDialog(true);
              setRestoreComplete(false);
              setRestoreError(null);
            } else if (result.success) {
              // Old format without SSE
              setShowProgressDialog(true);
              setRestoreComplete(true);
              console.log('Restore successful - dialog stays open until user clicks OK');
            }
          },
          onError: (errorMsg) => {
            setShowProgressDialog(true);
            setRestoreError(errorMsg);
          },
          onRetryKey: (file) => {
            setPendingRestoreFile(file);
            setShowRestoreDialog(true);
          },
          onCancel: () => {
            setPendingRestoreFile(null);
          }
        }
      );
      
    } catch (error) {
      console.error('Error during restore:', error);
      setShowProgressDialog(true);
      setRestoreError(error.message || 'Unknown error occurred');
    } finally {
      setPendingRestoreFile(null);
    }
  };

  // Dialog-Components werden direkt zurückgegeben statt in einem separaten Portal gerendert
  const restoreDialogComponent = (
    <>
      {/* ONLY show dialogs if NOT in Backup tab */}
      {!isInBackupTab && showRestoreDialog && pendingRestoreFile && (
        <RestoreKeyDialog
          open={showRestoreDialog}
          onClose={() => {
            setShowRestoreDialog(false);
            setPendingRestoreFile(null);
          }}
          onRestore={handleRestoreWithKey}
          fileName={pendingRestoreFile?.name || 'backup.json'}
        />
      )}
      {/* Invalid Key Warning Dialog from centralized hook */}
      {!isInBackupTab && showInvalidKeyDialog && (
        <InvalidKeyDialog
          open={showInvalidKeyDialog}
          onConfirm={invalidKeyHandlers.onConfirm}
          onRetry={invalidKeyHandlers.onRetry}
          onCancel={invalidKeyHandlers.onCancel}
        />
      )}
      {/* ONLY show progress dialog if NOT in Backup tab */}
      {!isInBackupTab && showProgressDialog && (
        <RestoreProgressDialog
          open={showProgressDialog}
          sessionId={restoreSessionId}
          totalItems={restoreItemCounts}
          restoreComplete={restoreComplete}
          restoreError={restoreError}
          onClose={() => {
            setShowProgressDialog(false);
            setRestoreSessionId(null);
            setRestoreComplete(false);
            setRestoreError(null);
          }}
        />
      )}
    </>
  );

  // Hilfsfunktion zur Bestimmung der Kategorie für neue Services
  const getValidCategoryForNewService = () => {
    const staticCategories = ['all', 'favorites', 'recent'];

    if (selectedCategory && !staticCategories.includes(selectedCategory)) {
      return selectedCategory;
    }

    return 'productivity';
  };

  const extractDomainInfo = url => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // Domain-basierte Icon-Vorschläge
      const domainIconMap = {
        'github.com': 'Globe',
        'gitlab.com': 'Globe',
        'docker.com': 'Box',
        'hub.docker.com': 'Box',
        'nginx.com': 'Server',
        'apache.org': 'Server',
        'mysql.com': 'Database',
        'postgresql.org': 'Database',
        'mongodb.com': 'Database',
        'redis.io': 'Database',
        'grafana.com': 'BarChart',
        'prometheus.io': 'Activity',
        'elastic.co': 'Search',
        'kibana.org': 'BarChart',
        'jenkins.io': 'Settings',
        'traefik.io': 'Globe',
        'portainer.io': 'Box',
        'nextcloud.com': 'Cloud',
        'owncloud.org': 'Cloud',
        'plex.tv': 'Tv',
        'jellyfin.org': 'Tv',
        'emby.media': 'Tv',
        'home-assistant.io': 'Home',
        'openhab.org': 'Home',
        'nodered.org': 'Settings',
        'mosquitto.org': 'Wifi',
        'influxdata.com': 'TrendingUp',
        'sonarr.tv': 'Video',
        'radarr.video': 'Video',
        'lidarr.audio': 'Music',
        'bazarr.media': 'FileText',
        'tautulli.com': 'BarChart',
        'overseerr.dev': 'Star',
        'ombi.io': 'Star',
        'organizr.app': 'Grid',
        'heimdall.site': 'Grid',
      };

      // Domain-basierte Farb-Vorschläge  
      const domainColorMap = {
        'github.com': '#24292e',
        'gitlab.com': '#FC6D26',
        'docker.com': '#2496ED',
        'grafana.com': '#FF9500',
        'prometheus.io': '#E6522C',
        'elastic.co': '#005571',
        'jenkins.io': '#D33834',
        'nextcloud.com': '#0082C9',
        'plex.tv': '#E5A00D',
        'jellyfin.org': '#00A4DC',
        'home-assistant.io': '#41BDF5',
        'openhab.org': '#FF6600',
        'sonarr.tv': '#35C5F4',
        'radarr.video': '#FFD700',
        'lidarr.audio': '#159552',
        'tautulli.com': '#DBA81A',
        'overseerr.dev': '#5460E6',
        'ombi.io': '#DF7C00',
        'organizr.app': '#1F1F1F',
        'heimdall.site': '#663399',
      };

      // Port-basierte Namen
      const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
      const portNames = {
        '8080': 'Web Service',
        '8443': 'Secure Web Service',
        '3000': 'Application',
        '9000': 'Admin Panel',
        '8123': 'Home Assistant',
        '32400': 'Plex Media Server',
        '8096': 'Jellyfin',
        '8989': 'Sonarr',
        '7878': 'Radarr',
        '8686': 'Lidarr',
        '9696': 'Prowlarr',
        '5055': 'Overseerr',
        '3579': 'Ombi',
        '6789': 'NZBGet',
        '8112': 'Deluge',
        '9091': 'Transmission',
        '8384': 'Syncthing',
        '19999': 'Netdata',
        '3001': 'Grafana',
      };

      let name = '';
      
      // Try to create meaningful name
      if (portNames[port]) {
        name = portNames[port];
      } else {
        // Get domain without TLD
        const parts = domain.split('.');
        if (parts.length > 2) {
          name = parts[parts.length - 3]; // subdomain
        } else {
          name = parts[0]; // main domain
        }
        
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }

      return {
        name,
        url,
        description: `Service on port ${port}`,
        icon: domainIconMap[domain] || 'Globe',
        color: domainColorMap[domain] || '#3498db',
      };
    } catch (error) {
      console.error('Error extracting domain info:', error);
      return {
        name: 'New Service',
        url,
        description: '',
        icon: 'Globe',
        color: '#3498db',
      };
    }
  };

  // Funktion zum Verarbeiten der Backup-Datei
  const processBackupFile = file => {
    setPendingRestoreFile(file);
    setShowRestoreDialog(true);
  };

  const handleDrop = async e => {
    e.preventDefault();
    e.stopPropagation();

    // DISABLE restore when in Backup tab
    if (isInBackupTab) {
      console.log('Drag & drop disabled in Backup tab');
      return;
    }

    // Handle files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];

      // In Settings: Nur Backup-JSON oder Bilder für Background-Tab
      if (showSettingsModal) {
        if (activeSettingsTab === 'background') {
          // Im Background-Tab: Nur Bilder
          if (file.type.startsWith('image/')) {
            try {
              const success = await uploadBackgroundImage(file);
              if (!success) {
                console.error('Failed to upload background image');
              }
            } catch (error) {
              console.error('Error uploading background:', error);
            }
          }
          return;
        }
        
        // In anderen Settings-Tabs: Backup oder Hintergrundbild
        if (
          file.name.toLowerCase().endsWith('.json') ||
          file.type === 'application/json'
        ) {
          // Direkt den Schlüssel-Dialog zeigen
          processBackupFile(file);
        } else if (file.type.startsWith('image/')) {
          const switchToBackground = window.confirm(
            '🖼️ Bilddatei erkannt!\n\n' +
              'Möchten Sie zum Hintergrundbild-Tab wechseln und das Bild hochladen?'
          );
          if (switchToBackground) {
            setActiveSettingsTab('background');
            setTimeout(async () => {
              try {
                const success = await uploadBackgroundImage(file);
                if (!success) {
                  console.error('Failed to upload background image');
                }
              } catch (error) {
                console.error('Error uploading background:', error);
              }
            }, 300);
          }
        }
        return;
      } else {
        // Im Hauptbereich: Bilder oder JSON
        if (file.type.startsWith('image/')) {
          const openSettings = window.confirm(
            '🖼️ Hintergrundbild erkannt!\n\n' +
              'Möchten Sie die Hintergrundbild-Einstellungen öffnen?\n\n' +
              '✅ JA - Einstellungen öffnen und hochladen\n' +
              '❌ NEIN - Direkt als Hintergrundbild setzen'
          );

          if (openSettings) {
            setShowSettingsModal(true);
            setActiveSettingsTab('background');
            setTimeout(async () => {
              try {
                const success = await uploadBackgroundImage(file);
                if (!success) {
                  console.error('Failed to upload background image');
                }
              } catch (error) {
                console.error('Error uploading background:', error);
              }
            }, 500);
          } else {
            try {
              const success = await uploadBackgroundImage(file);
              if (!success) {
                console.error('Failed to upload background image');
              }
            } catch (error) {
              console.error('Error uploading background:', error);
            }
          }
          return;
        } else if (
          file.name.toLowerCase().endsWith('.json') ||
          file.type === 'application/json'
        ) {
          // Direkt den Schlüssel-Dialog zeigen
          processBackupFile(file);
          return;
        } else {
          return;
        }
      }
    }

    // URL-Verarbeitung (nur im Hauptbereich, nicht in Settings)
    if (!showSettingsModal) {
      let url = '';

      if (e.dataTransfer.types.includes('text/uri-list')) {
        url = e.dataTransfer.getData('text/uri-list').split('\n')[0];
      } else if (e.dataTransfer.types.includes('text/plain')) {
        const text = e.dataTransfer.getData('text/plain').trim();
        if (text.startsWith('http://') || text.startsWith('https://')) {
          url = text;
        }
      }

      if (url) {
        // Validiere URL
        try {
          new URL(url);
        } catch (urlError) {
          return;
        }

        // Extrahiere Domain-Informationen
        const domainInfo = extractDomainInfo(url);

        // Verwende Service Panel für neue Services
        if (setSelectedServiceForPanel && setShowServicePanel) {
          const newAppliance = {
            name: domainInfo.name,
            url: url.trim(),
            description: domainInfo.description,
            icon: domainInfo.icon,
            color: domainInfo.color,
            category: getValidCategoryForNewService(),
            isNew: true,
            tags: [],
            requiresAuth: false,
            openInNewTab: true,
          };

          setSelectedServiceForPanel(newAppliance);
          setShowServicePanel(true);
        }
      }
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return {
    handleDrop,
    handleDragOver,
    restoreDialogComponent,
  };
};
