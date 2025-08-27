import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import RustDeskSetupDialog from '../RemoteDesktop/RustDeskSetupDialog';
import { 
  openGuacamoleConnection, 
  openRustDeskConnection, 
  checkRustDeskStatus, 
  getRemoteDesktopType 
} from '../../modules/remoteDesktop/remoteDesktopUtils';
import './RemoteDesktopButton.css';

const RemoteDesktopButton = ({ appliance, onUpdate }) => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [performanceMode] = useState(appliance.guacamolePerformanceMode || appliance.guacamole_performance_mode || 'balanced');
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  
  // Get remote desktop type and status
  const remoteDesktopType = getRemoteDesktopType(appliance);
  const isRustDesk = remoteDesktopType === 'rustdesk';
  const rustDeskStatus = checkRustDeskStatus(appliance);
  
  const handleOpenRemoteDesktop = async (e) => {
    // Prevent event bubbling
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setLoading(true);
    
    try {
      if (isRustDesk) {
        // Check if RustDesk needs setup
        if (!rustDeskStatus.isReady) {
          setShowSetupDialog(true);
          return;
        }
        
        // Open RustDesk connection
        await openRustDeskConnection(appliance, token);
      } else {
        // Open Guacamole connection
        await openGuacamoleConnection(appliance, token, performanceMode);
      }
    } catch (error) {
      console.error('Remote Desktop Error:', error);
      alert(error.message || 'Fehler beim Öffnen der Remote Desktop Verbindung');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRustDeskInstalled = (updatedAppliance) => {
    // Update the appliance data
    if (onUpdate) {
      onUpdate(updatedAppliance);
    }
    setShowSetupDialog(false);
  };
  
  // Determine button styling based on type
  const getButtonStyle = () => {
    if (isRustDesk) {
      return {
        backgroundColor: 'rgba(33, 150, 243, 0.3)',
        border: '1px solid rgba(33, 150, 243, 0.5)',
        color: 'white',
        '&:hover': {
          backgroundColor: 'rgba(33, 150, 243, 0.5)',
        },
      };
    }
    
    // Guacamole styling (VNC/RDP)
    return {
      backgroundColor: 'rgba(76, 175, 80, 0.3)',
      border: '1px solid rgba(76, 175, 80, 0.5)',
      color: 'white',
      '&:hover': {
        backgroundColor: 'rgba(76, 175, 80, 0.5)',
      },
    };
  };
  
  const getTooltipText = () => {
    if (isRustDesk) {
      return rustDeskStatus.isReady ? t('hosts.rustDeskOpen', 'Open RustDesk') : t('hosts.rustDeskSetup', 'Setup RustDesk');
    }
    
    const protocol = appliance.remoteProtocol || 'vnc';
    return t('hosts.remoteDesktopOpenWithProtocol', { protocol: protocol.toUpperCase() }, `Open Remote Desktop (${protocol.toUpperCase()})`);
  };
  
  return (
    <>
      <Tooltip title={getTooltipText()}>
        <IconButton
          onClick={handleOpenRemoteDesktop}
          size="small"
          disabled={loading}
          sx={{
            ...getButtonStyle(),
            width: 28,
            height: 28,
            padding: 0,
          }}
        >
          <Monitor size={16} />
        </IconButton>
      </Tooltip>
      
      {showSetupDialog && (
        <RustDeskSetupDialog
          isOpen={showSetupDialog}
          onClose={() => setShowSetupDialog(false)}
          applianceName={appliance.name}
          applianceId={appliance.id}
          sshHostId={appliance.sshHostId}
          onInstall={handleRustDeskInstalled}
          onManualSave={async (id, password) => {
            // This will be handled by the dialog itself
            return true;
          }}
          currentRustDeskId={appliance.rustdesk_id || appliance.rustdeskId}
        />
      )}
    </>
  );
};

export default RemoteDesktopButton;