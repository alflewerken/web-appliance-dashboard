import React from 'react';
import { Monitor, MonitorDot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './RemoteDesktopButton.css';

const RemoteDesktopButton = ({ appliance }) => {
  const { token } = useAuth();
  const [loading, setLoading] = React.useState(false);
  
  const handleOpenRemoteDesktop = async (protocol) => {
    try {
      setLoading(true);
      
      // Hole Verbindungsinfo vom Backend - verwende immer relative URLs
      const url = `/api/guacamole/token/${appliance.id}`;
      console.log('Using URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Fehler beim Abrufen der Verbindungsinformationen');
      }
      
      const connectionInfo = await response.json();
      
      // URL aus der Response holen
      const targetUrl = connectionInfo.url || connectionInfo.connectionUrl;
      
      // Erkenne mobiles Gerät
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Keine Meldung mehr zeigen - Guacamole Session sollte aktiv sein
      
      if (isMobile) {
        // Auf mobilen Geräten: Direkte Navigation
        window.location.href = targetUrl;
      } else {
        // Desktop: Öffne in neuem Fenster
        const windowFeatures = 'width=1280,height=800,left=100,top=100,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes';
        const windowName = `remote-desktop-${appliance.id}-${Date.now()}`;
        
        const remoteWindow = window.open(targetUrl, windowName, windowFeatures);
        
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
