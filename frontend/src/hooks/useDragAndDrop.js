import React, { useState } from 'react';
import { BackupService } from '../services/backupService';
import { RestoreKeyDialog } from '../components/SettingsPanel';
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

  // Funktion zum Wiederherstellen mit Schlüssel
  const handleRestoreWithKey = async (decryptionKey) => {
    if (pendingRestoreFile) {
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
        setShowProgressDialog(true); // Show progress dialog
        
        // Create a new File object since we already read it
        const newFile = new File([fileContent], pendingRestoreFile.name, { type: 'application/json' });
        
        const result = await BackupService.restoreBackup(newFile, decryptionKey);
        
        if (result.success) {
          if (result.reloadRequired) {
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        } else {
          alert('Fehler beim Wiederherstellen: ' + result.message);
        }
      } catch (error) {
        console.error('Error during restore:', error);
        alert('Fehler beim Wiederherstellen: ' + error.message);
      } finally {
        setShowProgressDialog(false);
        setPendingRestoreFile(null);
      }
    } else {
      setShowRestoreDialog(false);
    }
  };

  // Dialog-Components werden direkt zurückgegeben statt in einem separaten Portal gerendert
  const restoreDialogComponent = (
    <>
      {showRestoreDialog && pendingRestoreFile && (
        <RestoreKeyDialog
          open={showRestoreDialog}
          onClose={() => {
            setShowRestoreDialog(false);
            setPendingRestoreFile(null);
          }}
          onRestore={(key) => {
            handleRestoreWithKey(key);
          }}
          fileName={pendingRestoreFile?.name || 'backup.json'}
        />
      )}
      {showProgressDialog && (
        <RestoreProgressDialog
          open={showProgressDialog}
          totalItems={restoreItemCounts}
          onClose={() => setShowProgressDialog(false)}
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

      const suggestedIcon = domainIconMap[domain] || 'Globe';
      const suggestedColor = domainColorMap[domain] || '#007AFF';

      // Generiere einen Namen basierend auf der Domain
      const domainParts = domain.split('.');
      const mainDomain =
        domainParts.length > 2
          ? domainParts[domainParts.length - 2]
          : domainParts[0];
      const suggestedName =
        mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);

      return {
        icon: suggestedIcon,
        color: suggestedColor,
        name: suggestedName,
        description: `Service hosted on ${domain}`,
      };
    } catch (error) {
      return {
        icon: 'Globe',
        color: '#007AFF',
        name: 'Web Service',
        description: 'Web Application',
      };
    }
  };

  const processBackupFile = async file => {
    // Zeige den Schlüssel-Dialog
    setPendingRestoreFile(file);
    setShowRestoreDialog(true);
  };

  const handleDragEnter = e => {
    // Wenn wir im Backup-Tab sind, Event durchlassen
    if (showSettingsModal && activeSettingsTab === 'backup') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = e => {
    // Wenn wir im Backup-Tab sind, Event durchlassen
    if (showSettingsModal && activeSettingsTab === 'backup') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = e => {
    // Wenn wir im Backup-Tab sind, Event durchlassen
    if (showSettingsModal && activeSettingsTab === 'backup') {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async e => {
    // Wenn wir im Backup-Tab sind, Event durchlassen für den lokalen Handler
    if (showSettingsModal && activeSettingsTab === 'backup') {
      // Nicht preventDefault/stopPropagation aufrufen!
      // Der BackupTab Component handled das selbst
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    try {
      // Prüfe zuerst auf Dateien
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];

        // Verarbeitung basierend auf UI-Zustand
        if (showSettingsModal && activeSettingsTab === 'background') {
          // Im Background-Tab: Nur Bilder akzeptieren
          if (file.type.startsWith('image/')) {
            try {
              const success = await uploadBackgroundImage(file);
              if (success) {
              } else {
              }
            } catch (error) {}
          } else {
          }
          return;
        } else if (showSettingsModal) {
          // In anderen Settings-Tabs: Intelligente Weiterleitung
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
                  if (success) {
                  } else {
                  }
                } catch (error) {}
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
                  if (success) {
                  } else {
                  }
                } catch (error) {}
              }, 500);
            } else {
              try {
                const success = await uploadBackgroundImage(file);
                if (success) {
                } else {
                }
              } catch (error) {}
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
            };
            setSelectedServiceForPanel(newAppliance);
            setShowServicePanel(true);
          } else if (setFormData && setEditingAppliance && setShowModal) {
            // Fallback für altes System (sollte nicht mehr verwendet werden)
            setFormData({
              name: domainInfo.name,
              url: url.trim(),
              description: domainInfo.description,
              icon: domainInfo.icon,
              color: domainInfo.color,
              category: getValidCategoryForNewService(),
            });
            setEditingAppliance(null);
            setShowModal(true);
          } else {
            console.error('Keine Handler für neue Services verfügbar');
          }
        }
      }
    } catch (error) {}
  };

  return {
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processBackupFile,
    restoreDialogComponent,  // Dialog-Komponente zurückgeben
  };
};
