import React from 'react';
import { Monitor, MonitorDot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL, GUACAMOLE_URL } from '../config';

const RemoteDesktopButton = ({ appliance }) => {
  const { token } = useAuth();
  
  const handleOpenRemoteDesktop = async (protocol) => {
    try {
      // Hole temporären Token vom Backend
      const response = await fetch(`${API_BASE_URL}/api/remote/guacamole/token/${appliance.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Fehler beim Abrufen des Remote Desktop Tokens');
      }
      
      const { token: guacToken, connectionId } = await response.json();
      
      // Prüfe ob wir in der Electron App sind
      if (window.electronAPI && window.electronAPI.remoteDesktop) {
        // Electron App - nutze native Fenster
        const result = await window.electronAPI.remoteDesktop.open({
          applianceId: appliance.id,
          applianceName: appliance.name,
          protocol: protocol,
          guacamoleUrl: GUACAMOLE_URL,
          token: guacToken
        });
        
        if (!result.success) {
          console.error('Fehler beim Öffnen des Remote Desktop:', result.error);
        }
      } else {
        // Web Browser - nutze den normalen Window Manager
        const remoteDesktopWindow = await import('../utils/remoteDesktopWindow');
        await remoteDesktopWindow.default.openRemoteDesktop({
          applianceId: appliance.id,
          applianceName: appliance.name,
          protocol: protocol,
          guacamoleUrl: GUACAMOLE_URL,
          token: guacToken
        });
      }
      
      // Optional: Log Activity
      await fetch(`${API_BASE_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'remote_desktop_opened',
          appliance_id: appliance.id,
          details: { protocol }
        })
      });
    } catch (error) {
      console.error('Fehler beim Öffnen des Remote Desktop:', error);
      // Hier könnte eine Fehlermeldung angezeigt werden
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
        >
          <MonitorDot size={16} />
        </button>
      )}
    </>
  );
};

export default RemoteDesktopButton;
