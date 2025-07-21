import React from 'react';
import { Monitor, MonitorDot } from 'lucide-react';

const RemoteDesktopButton = ({ appliance }) => {
  const [loading, setLoading] = React.useState(false);

  const openRemoteDesktop = async () => {
    try {
      setLoading(true);
      
      // Direkte URL zu Guacamole
      // Verwendet die Standard-Guacamole-Authentifizierung
      const guacamoleUrl = `http://${window.location.hostname}:9070/guacamole/`;
      
      // Öffne Guacamole in neuem Fenster
      const windowFeatures = 'width=1280,height=800,left=100,top=100,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes';
      window.open(guacamoleUrl, '_blank', windowFeatures);
      
    } catch (error) {
      console.error('Error opening remote desktop:', error);
      alert('Fehler beim Öffnen des Remote Desktop. Bitte versuchen Sie es erneut.');
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
            openRemoteDesktop();
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
            openRemoteDesktop();
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
