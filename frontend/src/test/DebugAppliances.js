// Test-Komponente zum Debuggen der Appliance-Daten
import React, { useEffect } from 'react';
import { useAppliances } from '../hooks/useAppliances';

const DebugAppliances = () => {
  const { appliances } = useAppliances();
  
  useEffect(() => {
    const nextcloud = appliances.filter(a => a.name && a.name.includes('Nextcloud'));
    if (nextcloud.length > 0) {

      nextcloud.forEach(app => {

      });
      
      // Globale Variable für einfachen Zugriff
      window.DEBUG_NEXTCLOUD = nextcloud;

    }
  }, [appliances]);
  
  return null;
};

export default DebugAppliances;
