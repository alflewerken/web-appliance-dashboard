import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Monitor } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const RemoteDesktopButton = ({ appliance }) => {
  const { token } = useAuth();
  const [loading, setLoading] = React.useState(false);
  
  // Stelle sicher, dass vncEnabled/rdpEnabled korrekt gesetzt sind
  const vncEnabled = appliance.vncEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'vnc');
  const rdpEnabled = appliance.rdpEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'rdp');
  
  const handleOpenRemoteDesktop = async (protocol) => {
    try {
      setLoading(true);
      
      // API-URL für Guacamole Token
      const apiUrl = `/api/guacamole/token/${appliance.id}`;
      
      // Token von der API holen
      const response = await axios.post(apiUrl, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const { url, needsLogin, hasToken } = response.data;
      
      console.log('Guacamole response:', response.data);
      
      // Erkenne mobiles Gerät
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Auf mobilen Geräten: Direkte Navigation
        window.location.href = url;
      } else {
        // Desktop: Öffne in neuem Fenster
        const windowFeatures = 'width=1280,height=800,left=100,top=100,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes';
        const windowName = `remote-desktop-${appliance.id}-${Date.now()}`;
        
        const remoteWindow = window.open(url, windowName, windowFeatures);
        
        if (!remoteWindow) {
          throw new Error('Popup-Blocker verhindert das Öffnen. Bitte erlauben Sie Popups für diese Seite.');
        }
      }
      
    } catch (error) {
      console.error('Fehler beim Öffnen des Remote Desktop:', error);
      
      let errorMessage = 'Fehler beim Öffnen des Remote Desktop. Bitte versuchen Sie es erneut.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const getTooltipTitle = () => {
    if (vncEnabled && rdpEnabled) {
      return 'Remote Desktop (VNC/RDP)';
    } else if (vncEnabled) {
      return 'VNC Remote Desktop';
    } else if (rdpEnabled) {
      return 'RDP Remote Desktop';
    }
    return 'Remote Desktop';
  };
  
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Automatische Protokoll-Auswahl
    if (vncEnabled) {
      handleOpenRemoteDesktop('vnc');
    } else if (rdpEnabled) {
      handleOpenRemoteDesktop('rdp');
    }
  };
  
  // Zeige Button nur wenn VNC oder RDP aktiviert ist
  if (!vncEnabled && !rdpEnabled) {
    return null;
  }
  
  return (
    <Tooltip title={getTooltipTitle()}>
      <IconButton
        onClick={handleClick}
        disabled={loading}
        size="small"
        className="remote-desktop-btn"
        sx={{
          backgroundColor: 'rgba(33, 150, 243, 0.3)',
          border: '1px solid rgba(33, 150, 243, 0.5)',
          color: 'white',
          '&:hover': {
            backgroundColor: 'rgba(33, 150, 243, 0.5)',
          },
          '&:disabled': {
            opacity: 0.5,
          },
          width: 28,
          height: 28,
          padding: 0,
        }}
      >
        <Monitor size={16} />
      </IconButton>
    </Tooltip>
  );
};

export default RemoteDesktopButton;
