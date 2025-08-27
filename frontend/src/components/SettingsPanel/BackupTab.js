import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { BackupService } from '../../services/backupService';
import EncryptionKeyDialog from './EncryptionKeyDialog';
import RestoreKeyDialog from './RestoreKeyDialog';
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
  const { t } = useTranslation();
  const [createLoading, setCreateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);
  const [showRestoreKeyDialog, setShowRestoreKeyDialog] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);

  const handleCreateBackup = async () => {
    try {
      setCreateLoading(true);
      const result = await BackupService.createBackup();
      if (result.success) {
        setSuccess(result.message);
        // Show encryption key dialog if key is provided
        if (result.encryptionKey) {
          setEncryptionKey(result.encryptionKey);
          setShowEncryptionDialog(true);
        }
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(t('backup.createError') + ': ' + error.message);
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
      setError(t('backup.selectJsonFile'));
      return;
    }

    // Show key dialog for restore
    console.log('handleDrop: Setting file and showing dialog', file.name);
    setPendingRestoreFile(file);
    setShowRestoreKeyDialog(true);
    console.log('handleDrop: Dialog should be shown now');
  };

  const handleFileInputChange = async event => {
    const file = event.target.files[0];
    if (!file) return;

    // Show key dialog for restore
    setPendingRestoreFile(file);
    setShowRestoreKeyDialog(true);
    event.target.value = '';
  };

  const restoreFromFile = async (file, decryptionKey = null) => {
    try {
      setRestoreLoading(true);
      const result = await BackupService.restoreBackup(file, decryptionKey);

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

  const handleRestoreWithKey = (decryptionKey) => {
    if (pendingRestoreFile) {
      restoreFromFile(pendingRestoreFile, decryptionKey);
      setPendingRestoreFile(null);
    }
    setShowRestoreKeyDialog(false);
  };

  // Debug output
  useEffect(() => {
    console.log('showRestoreKeyDialog state:', showRestoreKeyDialog);
    console.log('pendingRestoreFile:', pendingRestoreFile);
  }, [showRestoreKeyDialog, pendingRestoreFile]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{ mb: 1, fontWeight: 600, color: 'white' }}
        >
          {t('backup.title')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('backup.subtitle')}
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
                  {t('backup.createBackup')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  {t('backup.createDescription')}
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
                    ? t('backup.creatingBackup')
                    : t('backup.createBackupNow')}
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
            onDragOver={(e) => {
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
                  {t('backup.restoreBackup')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  {t('backup.restoreDescription')}
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
                      ? t('backup.restoring')
                      : t('backup.selectFile')}
                  </Button>
                </label>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Box>

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

      {/* Encryption Key Dialog */}
      <EncryptionKeyDialog
        open={showEncryptionDialog}
        onClose={() => setShowEncryptionDialog(false)}
        encryptionKey={encryptionKey}
      />

      {/* Restore Key Dialog */}
      <RestoreKeyDialog
        open={showRestoreKeyDialog}
        onClose={() => {
          setShowRestoreKeyDialog(false);
          setPendingRestoreFile(null);
        }}
        onRestore={handleRestoreWithKey}
        fileName={pendingRestoreFile?.name || 'backup.json'}
      />
    </Box>
  );
};

export default BackupTab;
