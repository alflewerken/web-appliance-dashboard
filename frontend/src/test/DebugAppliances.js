// Test-Komponente zum Debuggen der Appliance-Daten
import React, { useEffect } from 'react';
import { useAppliances } from '../hooks/useAppliances';

const DebugAppliances = () => {
  const { appliances } = useAppliances();
  
  useEffect(() => {
    const nextcloud = appliances.filter(a => a.name && a.name.includes('Nextcloud'));
    if (nextcloud.length > 0) {
      console.log('[DEBUG] Nextcloud Appliances from useAppliances hook:');
      nextcloud.forEach(app => {
        console.log(`${app.name}:`, {
          remoteDesktopEnabled: app.remoteDesktopEnabled,
          remoteProtocol: app.remoteProtocol,
          vncEnabled: app.vncEnabled,
          rdpEnabled: app.rdpEnabled
        });
      });
      
      // Globale Variable für einfachen Zugriff
      window.DEBUG_NEXTCLOUD = nextcloud;
      console.log('Die Nextcloud-Daten sind jetzt in window.DEBUG_NEXTCLOUD verfügbar');
    }
  }, [appliances]);
  
  return null;
};

export default DebugAppliances;
