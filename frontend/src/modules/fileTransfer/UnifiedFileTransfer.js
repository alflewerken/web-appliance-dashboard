import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { 
  Box, 
  Button, 
  Typography,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Upload, Download, FolderOpen } from 'lucide-react';
import { SSHFileUpload } from '../../components/Appliances';

/**
 * Unified File Transfer Component for both Hosts and Services
 */
export const UnifiedFileTransfer = ({ 
  entity,
  entityType = 'host',
  sshHost,
  defaultPath = '/tmp'
}) => {
  const [showUpload, setShowUpload] = useState(false);
  const [targetPath, setTargetPath] = useState(defaultPath);
  const [showPathSelector, setShowPathSelector] = useState(false);

  // Common paths based on entity type
  const commonPaths = entityType === 'host' ? [
    { label: 'Temp', value: '/tmp' },
    { label: 'Home', value: '/home' },
    { label: 'Root Home', value: '/root' },
    { label: 'Var Log', value: '/var/log' },
    { label: 'Etc', value: '/etc' },
  ] : [
    { label: 'Temp', value: '/tmp' },
    { label: 'App Data', value: '/opt/services' },
    { label: 'Docker Volumes', value: '/var/lib/docker/volumes' },
    { label: 'Config', value: '/etc/services' },
    { label: 'Logs', value: '/var/log/services' },
  ];

  const handleUploadClick = () => {
    if (!sshHost) {
      alert('Keine SSH-Verbindung verfügbar');
      return;
    }
    setShowUpload(true);
  };

  const handleDownloadClick = () => {
    // TODO: Implement download functionality
    alert('Download-Funktion wird noch implementiert');
  };

  if (!sshHost && entityType === 'service') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">
          Bitte wählen Sie zuerst eine SSH-Verbindung aus, um die Dateiübertragung zu nutzen.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Dateiübertragung
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {entityType === 'host' 
          ? `Dateien mit ${entity.name || entity.hostname} austauschen`
          : `Dateien über ${sshHost?.name || 'SSH-Verbindung'} übertragen`
        }
      </Typography>

      {/* Path Selection */}
      <Box sx={{ mt: 2, mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Zielverzeichnis</InputLabel>
          <Select
            value={showPathSelector ? 'custom' : targetPath}
            label="Zielverzeichnis"
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setShowPathSelector(true);
              } else {
                setTargetPath(e.target.value);
                setShowPathSelector(false);
              }
            }}
          >
            {commonPaths.map(path => (
              <MenuItem key={path.value} value={path.value}>
                {path.label} ({path.value})
              </MenuItem>
            ))}
            <MenuItem value="custom">Eigener Pfad...</MenuItem>
          </Select>
        </FormControl>

        {showPathSelector && (
          <TextField
            fullWidth
            label="Eigener Pfad"
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
            placeholder="/path/to/directory"
            helperText="Geben Sie den vollständigen Pfad ein"
          />
        )}
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={handleUploadClick}
          disabled={!sshHost && entityType === 'host'}
        >
          Datei hochladen
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleDownloadClick}
          disabled={!sshHost && entityType === 'host'}
        >
          Datei herunterladen
        </Button>

        <Button
          variant="outlined"
          startIcon={<FolderOpen />}
          disabled
          sx={{ ml: 'auto' }}
        >
          Dateibrowser
        </Button>
      </Box>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Tipp:</strong> Sie können mehrere Dateien gleichzeitig hochladen. 
          Dateien werden direkt über SSH übertragen.
        </Typography>
      </Alert>

      {/* Upload Modal */}
      {showUpload && sshHost && ReactDOM.createPortal(
        <SSHFileUpload
          sshHost={sshHost}
          targetPath={targetPath}
          requirePassword={sshHost.requiresPassword}
          onClose={() => setShowUpload(false)}
          applianceName={entity.name || entity.hostname}
        />,
        document.body
      )}
    </Box>
  );
};

export default UnifiedFileTransfer;