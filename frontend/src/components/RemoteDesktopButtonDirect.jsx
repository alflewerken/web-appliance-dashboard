import React from 'react';
import { Monitor, MonitorDot } from 'lucide-react';

const RemoteDesktopButton = ({ appliance }) => {
  const [loading, setLoading] = React.useState(false);
  
  const handleOpenRemoteDesktop = async (protocol) => {
    try {
      setLoading(true);
      
      // Für Nextcloud-Mac: Direkte Guacamole-URL mit Basis-Auth
      // Diese Methode öffnet Guacamole mit automatischer Anmeldung
      const guacamoleBase = `http://${window.location.hostname}:9070/guacamole`;
      
      // Erstelle die direkte Connection-URL
      // Connection ID 1 ist dashboard-45 (Nextcloud-Mac)
      const connectionIdentifier = btoa('1\0c\0postgresql');
      
      // Öffne zuerst die Login-Seite mit automatischer Weiterleitung
      const loginUrl = `${guacamoleBase}/#/?username=guacadmin&password=guacadmin`;
      const connectionUrl = `${guacamoleBase}/#/client/${connectionIdentifier}`;
      
      // Erkenne mobiles Gerät
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Auf mobilen Geräten: Direkte Navigation
        // Öffne die Verbindung direkt
        window.location.href = connectionUrl;
      } else {
        // Desktop: Öffne in neuem Fenster
        const windowFeatures = 'width=1280,height=800,left=100,top=100,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes';
        const windowName = `remote-desktop-${appliance.id}-${Date.now()}`;
        
        // Öffne direkt die Verbindungs-URL
        const remoteWindow = window.open(connectionUrl, windowName, windowFeatures);
        
        if (!remoteWindow) {
          throw new Error('Popup-Blocker verhindert das Öffnen. Bitte erlauben Sie Popups für diese Seite.');
        }
      }
      
    } catch (error) {
      console.error('Fehler beim Öffnen des Remote Desktop:', error);
      alert(error.message || 'Fehler beim Öffnen des Remote Desktop. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  // Zeige Buttons nur wenn Remote Desktop aktiviert ist
  if (!appliance.remoteDesktopEnabled) {
    return null;
  }

  return (
    <>
      {appliance.remoteProtocol === 'vnc' && (
        <button
          type="button"
          className="remote-desktop-btn vnc"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenRemoteDesktop('vnc');
          }}
          title="VNC Remote Desktop öffnen"
          disabled={loading}
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          <Monitor size={16} />
        </button>
      )}
      
      {appliance.remoteProtocol === 'rdp' && (
        <button
          type="button"
          className="remote-desktop-btn rdp"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpenRemoteDesktop('rdp');
          }}
          title="RDP Remote Desktop öffnen"
          disabled={loading}
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          <MonitorDot size={16} />
        </button>
      )}
    </>
  );
};

export default RemoteDesktopButton;
