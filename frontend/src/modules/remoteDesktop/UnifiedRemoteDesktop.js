import React, { useState } from 'react';
import { 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Typography,
  Divider
} from '@mui/material';
import { Monitor } from 'lucide-react';
import RustDeskSetupDialog from '../../components/RemoteDesktop/RustDeskSetupDialog';
import axios from '../../utils/axiosConfig';

/**
 * Unified Remote Desktop Configuration Component
 * Handles both Guacamole and RustDesk configurations
 */
export const UnifiedRemoteDesktop = ({ 
  entity,
  entityType = 'host',
  formData,
  onFieldChange,
  sshConnectionId,
  sshHost
}) => {  const [showRustDeskDialog, setShowRustDeskDialog] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState(null);

  // Handle both camelCase and snake_case
  const remoteDesktopType = formData.remoteDesktopType || formData.remote_desktop_type || 'guacamole';
  const isRustDesk = remoteDesktopType === 'rustdesk';
  const isGuacamole = remoteDesktopType === 'guacamole';

  const handleCheckRustDeskStatus = async () => {
    if (!sshConnectionId && entityType === 'service') {
      setError('Keine SSH-Verbindung konfiguriert');
      return;
    }

    // If we already have a RustDesk ID, show it directly
    const rustdeskId = formData.rustdesk_id || formData.rustdeskId;
    if (rustdeskId) {
      alert(`RustDesk ist bereits konfiguriert!\nID: ${rustdeskId}`);
      return;
    }

    setCheckingStatus(true);
    setError(null);
    
    try {
      const connectionId = entityType === 'host' ? entity.id : sshConnectionId;
      const response = await axios.get(`/api/rustdeskInstall/${connectionId}/status`);
      
      if (response.data.installed && response.data.rustdesk_id) {
        alert(`RustDesk ist installiert!\nID: ${response.data.rustdesk_id}`);
        onFieldChange('rustdesk_id', response.data.rustdesk_id);
        onFieldChange('rustdeskId', response.data.rustdesk_id);
      } else {
        setShowRustDeskDialog(true);
      }
    } catch (err) {
      console.error('Error checking RustDesk status:', err);
      setError('Fehler beim Prüfen des RustDesk-Status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRustDeskInstall = async () => {
    try {
      const connectionId = entityType === 'host' ? entity.id : sshConnectionId;
      const response = await axios.post(`/api/rustdeskInstall/${connectionId}`, {});
      
      if (response.data.success) {
        if (response.data.rustdesk_id) {
          onFieldChange('rustdesk_id', response.data.rustdesk_id);
          onFieldChange('rustdeskId', response.data.rustdesk_id);
          return true;
        } else if (response.data.manual_id_required) {
          return true;
        }
      }
      return false;    } catch (err) {
      console.error('RustDesk installation error:', err);
      throw err;
    }
  };

  const handleRustDeskManualSave = async (id, password) => {
    try {
      onFieldChange('rustdesk_id', id);
      onFieldChange('rustdeskId', id);
      
      if (password) {
        onFieldChange('rustdesk_password', password);
        onFieldChange('rustdeskPassword', password);
      }
      
      const connectionId = entityType === 'host' ? entity.id : sshConnectionId;
      const response = await axios.put(`/api/rustdeskInstall/${connectionId}/id`, {
        rustdesk_id: id
      });
      
      return !!response.data;
    } catch (err) {
      console.error('Error saving RustDesk ID:', err);
      throw err;
    }
  };

  return (
    <Box>      <Typography variant="h6" gutterBottom>
        Remote Desktop Einstellungen
      </Typography>

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Remote Desktop Typ</InputLabel>
        <Select
          value={remoteDesktopType}
          label="Remote Desktop Typ"
          onChange={(e) => {
            onFieldChange('remoteDesktopType', e.target.value);
            onFieldChange('remoteDesktopType', e.target.value);
          }}
        >
          <MenuItem value="guacamole">Guacamole (Web-basiert)</MenuItem>
          <MenuItem value="rustdesk">RustDesk (Native App)</MenuItem>
        </Select>
      </FormControl>

      {isGuacamole && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Guacamole Verbindungseinstellungen
          </Typography>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Protokoll</InputLabel>
            <Select
              value={formData.remoteProtocol || formData.remote_protocol || 'vnc'}
              label="Protokoll"              onChange={(e) => {
                onFieldChange('remoteProtocol', e.target.value);
                onFieldChange('remote_protocol', e.target.value);
              }}
            >
              <MenuItem value="vnc">VNC</MenuItem>
              <MenuItem value="rdp">RDP (Windows)</MenuItem>
              <MenuItem value="ssh">SSH</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Host / IP-Adresse"
            value={formData.remoteHost || formData.remote_host || ''}
            onChange={(e) => {
              onFieldChange('remoteHost', e.target.value);
              onFieldChange('remote_host', e.target.value);
            }}
            placeholder={entityType === 'host' ? entity.hostname : 'z.B. 192.168.1.100'}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Port"
            type="number"
            value={formData.remotePort || formData.remote_port || ''}
            onChange={(e) => {
              onFieldChange('remotePort', e.target.value);              onFieldChange('remote_port', e.target.value);
            }}
            placeholder={
              formData.remoteProtocol === 'rdp' ? '3389' :
              formData.remoteProtocol === 'ssh' ? '22' : '5900'
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Benutzername"
            value={formData.remoteUsername || formData.remote_username || ''}
            onChange={(e) => {
              onFieldChange('remoteUsername', e.target.value);
              onFieldChange('remote_username', e.target.value);
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Passwort"
            type="password"
            value={formData.remotePassword || formData.remote_password || ''}
            onChange={(e) => {
              onFieldChange('remotePassword', e.target.value);
              onFieldChange('remote_password', e.target.value);
            }}
            sx={{ mb: 2 }}
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            Guacamole verbindet sich über den Browser mit dem Remote Desktop.
            Stellen Sie sicher, dass der angegebene Host vom Server aus erreichbar ist.
          </Alert>
        </Box>
      )}

      {isRustDesk && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            RustDesk Konfiguration
          </Typography>

          <TextField
            fullWidth
            label="RustDesk ID"
            value={formData.rustdesk_id || formData.rustdeskId || ''}
            onChange={(e) => {
              onFieldChange('rustdesk_id', e.target.value);
              onFieldChange('rustdeskId', e.target.value);
            }}
            placeholder="z.B. 123456789"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="RustDesk Passwort (optional)"
            type="password"            value={formData.rustdesk_password || formData.rustdeskPassword || ''}
            onChange={(e) => {
              onFieldChange('rustdesk_password', e.target.value);
              onFieldChange('rustdeskPassword', e.target.value);
            }}
            sx={{ mb: 3 }}
          />

          <Button
            variant="contained"
            color="primary"
            startIcon={checkingStatus ? <CircularProgress size={20} /> : <Monitor />}
            onClick={handleCheckRustDeskStatus}
            disabled={checkingStatus || (entityType === 'service' && !sshConnectionId)}
            fullWidth
          >
            {checkingStatus ? 'Prüfe Status...' : 'RustDesk Installations Status'}
          </Button>

          {entityType === 'service' && !sshConnectionId && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Bitte wählen Sie zuerst eine SSH-Verbindung aus.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            RustDesk nutzt eine ID-basierte Verbindung. Falls noch nicht installiert, 
            können Sie RustDesk über den Button oben installieren.
          </Alert>
        </Box>
      )}

      {showRustDeskDialog && (
        <RustDeskSetupDialog
          isOpen={showRustDeskDialog}
          onClose={() => setShowRustDeskDialog(false)}
          applianceName={entity.name || entity.hostname}
          applianceId={entity.id}
          sshHost={sshHost || entity}
          onInstall={handleRustDeskInstall}
          onManualSave={handleRustDeskManualSave}
          currentRustDeskId={formData.rustdesk_id || formData.rustdeskId}
        />
      )}
    </Box>
  );
};

export default UnifiedRemoteDesktop;