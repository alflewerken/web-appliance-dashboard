import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Snackbar,
  Fade,
} from '@mui/material';
import {
  CloudDownload,
  CloudUpload,
  Save,
  Restore,
  CheckCircle,
  Error,
  Info,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { BackupService } from '../services/backupService';
import './BackupTab.css';

// Animation definitions
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const floatAnimation = keyframes`
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
`;

const BackupTab = () => {
  const [createLoading, setCreateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreateBackup = async () => {
    try {
      setCreateLoading(true);
      const result = await BackupService.createBackup();
      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Fehler beim Erstellen des Backups: ' + error.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDrop = async event => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);

    const { files } = event.dataTransfer;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json')) {
      setError('Bitte wählen Sie eine JSON-Datei aus.');
      return;
    }

    await restoreFromFile(file);
  };

  const handleFileInputChange = async event => {
    const file = event.target.files[0];
    if (!file) return;

    await restoreFromFile(file);
    event.target.value = '';
  };

  const restoreFromFile = async file => {
    try {
      setRestoreLoading(true);
      const result = await BackupService.restoreBackup(file);

      if (result.success) {
        setSuccess(result.message);
        if (result.reloadRequired) {
          setTimeout(() => window.location.reload(), 3000);
        }
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Fehler beim Wiederherstellen: ' + error.message);
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{ mb: 1, fontWeight: 600, color: 'white' }}
        >
          Backup & Wiederherstellung
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Sichern Sie Ihre Einstellungen und stellen Sie sie bei Bedarf wieder
          her
        </Typography>
      </Box>

      {/* Main Actions */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        {/* Create Backup Card */}
        <Fade in timeout={800}>
          <Card
            sx={{
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(0, 122, 255, 0.2)',
                border: '1px solid rgba(0, 122, 255, 0.3)',
              },
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 150,
                height: 150,
                background:
                  'radial-gradient(circle, rgba(0, 122, 255, 0.2) 0%, transparent 70%)',
                animation: `${pulseAnimation} 3s ease-in-out infinite`,
              }}
            />
            <CardContent sx={{ p: 4, position: 'relative' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, rgba(0, 122, 255, 0.2) 0%, rgba(0, 122, 255, 0.1) 100%)',
                    mb: 3,
                    animation: `${floatAnimation} 3s ease-in-out infinite`,
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '120%',
                      height: '120%',
                      background: 'radial-gradient(circle, rgba(0, 122, 255, 0.8) 0%, rgba(0, 122, 255, 0.4) 40%, transparent 70%)',
                      filter: 'blur(25px)',
                      zIndex: -1,
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '200%',
                      height: '200%',
                      background: 'radial-gradient(circle, rgba(0, 122, 255, 0.6) 0%, transparent 60%)',
                      filter: 'blur(50px)',
                      zIndex: -2,
                      animation: `${pulseAnimation} 2s ease-in-out infinite`,
                    },
                  }}
                >
                  <CloudDownload sx={{ 
                    fontSize: 48, 
                    color: '#007aff',
                    filter: 'drop-shadow(0 0 30px rgba(0, 122, 255, 1)) drop-shadow(0 0 60px rgba(0, 122, 255, 0.8)) drop-shadow(0 0 90px rgba(0, 122, 255, 0.6))',
                    zIndex: 1,
                  }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Backup erstellen
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Sichert alle Services, Kategorien und Einstellungen in einer
                  Datei
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleCreateBackup}
                  disabled={createLoading}
                  startIcon={
                    createLoading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <Save />
                    )
                  }
                  sx={{
                    py: 1.5,
                    background:
                      'linear-gradient(135deg, #007aff 0%, #0051a8 100%)',
                    '&:hover': {
                      background:
                        'linear-gradient(135deg, #0051a8 0%, #003d7a 100%)',
                    },
                  }}
                >
                  {createLoading
                    ? 'Erstelle Backup...'
                    : 'Backup jetzt erstellen'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>

        {/* Restore Backup Card */}
        <Fade in timeout={1000}>
          <Card
            sx={{
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s ease',
              borderStyle: dragOver ? 'dashed' : 'solid',
              borderColor: dragOver
                ? 'primary.main'
                : 'rgba(255, 255, 255, 0.1)',
              transform: dragOver ? 'scale(1.02)' : 'scale(1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(76, 175, 80, 0.2)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
              },
            }}
            onDrop={handleDrop}
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 150,
                height: 150,
                background:
                  'radial-gradient(circle, rgba(76, 175, 80, 0.2) 0%, transparent 70%)',
                animation: `${pulseAnimation} 3s ease-in-out infinite`,
              }}
            />
            <CardContent sx={{ p: 4, position: 'relative' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, rgba(76, 175, 80, 0.2) 0%, rgba(76, 175, 80, 0.1) 100%)',
                    mb: 3,
                    animation: `${floatAnimation} 3s ease-in-out infinite`,
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '120%',
                      height: '120%',
                      background: 'radial-gradient(circle, rgba(76, 175, 80, 0.8) 0%, rgba(76, 175, 80, 0.4) 40%, transparent 70%)',
                      filter: 'blur(25px)',
                      zIndex: -1,
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '200%',
                      height: '200%',
                      background: 'radial-gradient(circle, rgba(76, 175, 80, 0.6) 0%, transparent 60%)',
                      filter: 'blur(50px)',
                      zIndex: -2,
                      animation: `${pulseAnimation} 2s ease-in-out infinite`,
                    },
                  }}
                >
                  <CloudUpload sx={{ 
                    fontSize: 48, 
                    color: '#4caf50',
                    filter: 'drop-shadow(0 0 30px rgba(76, 175, 80, 1)) drop-shadow(0 0 60px rgba(76, 175, 80, 0.8)) drop-shadow(0 0 90px rgba(76, 175, 80, 0.6))',
                    zIndex: 1,
                  }} />
                </Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Backup wiederherstellen
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Laden Sie eine Backup-Datei hoch oder ziehen Sie sie hierher
                </Typography>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                  id="backup-file-input"
                />
                <label htmlFor="backup-file-input">
                  <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    component="span"
                    disabled={restoreLoading}
                    startIcon={
                      restoreLoading ? (
                        <CircularProgress size={20} />
                      ) : (
                        <Restore />
                      )
                    }
                    sx={{
                      py: 1.5,
                      borderColor: 'success.main',
                      color: 'success.main',
                      '&:hover': {
                        borderColor: 'success.light',
                        backgroundColor: 'rgba(76, 175, 80, 0.08)',
                      },
                    }}
                  >
                    {restoreLoading
                      ? 'Stelle wieder her...'
                      : 'Datei auswählen'}
                  </Button>
                </label>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Box>

      {/* Info Section */}
      <Fade in timeout={1200}>
        <Box sx={{ mt: 4 }}>
          <Alert
            severity="info"
            icon={<Info />}
            sx={{
              background: 'rgba(33, 150, 243, 0.1)',
              border: '1px solid rgba(33, 150, 243, 0.3)',
              '& .MuiAlert-icon': {
                color: 'info.main',
              },
            }}
          >
            <Typography variant="body2">
              <strong>Tipp:</strong> Erstellen Sie regelmäßige Backups Ihrer
              Konfiguration. Die Backup-Datei enthält alle Ihre Services,
              Kategorien, SSH-Konfigurationen und Einstellungen.
            </Typography>
          </Alert>
        </Box>
      </Fade>

      {/* Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={5000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccess('')}
          severity="success"
          icon={<CheckCircle />}
          sx={{ width: '100%' }}
        >
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setError('')}
          severity="error"
          icon={<Error />}
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BackupTab;
