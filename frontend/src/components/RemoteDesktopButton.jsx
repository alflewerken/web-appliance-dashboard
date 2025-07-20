import React from 'react';
import { Monitor, MonitorDot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';

const RemoteDesktopButton = ({ appliance }) => {
  const { token } = useAuth();
  const [loading, setLoading] = React.useState(false);
  
  const handleOpenRemoteDesktop = async (protocol) => {
    try {
      setLoading(true);
      
      // Hole Verbindungsinfo vom Backend
      const response = await fetch(`${API_BASE_URL}/api/remote/guacamole/token/${appliance.id}`, {
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
      
      // Öffne Guacamole in neuem Fenster
      const windowFeatures = 'width=1280,height=800,left=100,top=100,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes';
      const windowName = `remote-desktop-${appliance.id}-${Date.now()}`;
      
      const remoteWindow = window.open(connectionInfo.url, windowName, windowFeatures);
      
      if (!remoteWindow) {
        throw new Error('Popup-Blocker verhindert das Öffnen. Bitte erlauben Sie Popups für diese Seite.');
      }
      
    } catch (error) {
      console.error('Fehler beim Öffnen des Remote Desktop:', error);
      alert(error.message || 'Fehler beim Öffnen des Remote Desktop. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  // Zeige Buttons nur wenn Remote Desktop aktiviert ist
  if (!appliance.remote_desktop_enabled) {
    return null;
  }

  return (
    <>
      {appliance.remote_protocol === 'vnc' && (
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
      
      {appliance.remote_protocol === 'rdp' && (
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
