import React, { useState, useEffect, useRef } from 'react';
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
import { useRestoreWithValidation } from '../../hooks/useRestoreWithValidation';
import EncryptionKeyDialog from './EncryptionKeyDialog';
import RestoreKeyDialog from './RestoreKeyDialog';
import InvalidKeyDialog from './InvalidKeyDialog';
import RestoreProgressDialog from './RestoreProgressDialog';
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

export default function BackupTab() {
  const { t } = useTranslation();
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [showEncryptionDialog, setShowEncryptionDialog] = useState(false);
  const [showRestoreKeyDialog, setShowRestoreKeyDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [restoreItemCounts, setRestoreItemCounts] = useState({});
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);
  const [restoreSessionId, setRestoreSessionId] = useState(null);
  
  // Use the centralized restore hook
  const {
    validateAndRestore,
    isProcessing,
    showInvalidKeyDialog,
    invalidKeyHandlers
  } = useRestoreWithValidation();
  
  const fileInputRef = useRef();

  // Load backup statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await BackupService.getBackupStats();
        setStats(data);
      } catch (err) {
        console.error('Error loading backup stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, []);

  // Create backup
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setError('');
    setSuccess('');

    try {
      const result = await BackupService.createBackup();
      if (result.encryptionKey) {
        setEncryptionKey(result.encryptionKey);
        setShowEncryptionDialog(true);
      }
      setSuccess(t('backup.createSuccess'));
    } catch (err) {
      setError(err.message || t('backup.createError'));
    } finally {
      setCreatingBackup(false);
    }
  };

  // Handle restore with key using centralized validation
  const handleRestoreWithKey = async (decryptionKey, restoreSnmpMetrics) => {
    console.log('🔑 handleRestoreWithKey called');
    setShowRestoreKeyDialog(false);
    
    if (!pendingRestoreFile) return;
    
    const result = await validateAndRestore(
      pendingRestoreFile,
      decryptionKey,
      {
        restoreSnmpMetrics,
        onSuccess: (result) => {
          if (result.sessionId) {
            setRestoreSessionId(result.sessionId);
            setShowProgressDialog(true);
          } else {
            setSuccess(result.message || 'Restore successful');
            if (result.reloadRequired) {
              setTimeout(() => window.location.reload(), 3000);
            }
          }
        },
        onError: (errorMsg) => {
          // Don't add prefix if message already describes the error clearly
          if (errorMsg.includes('Schlüssel') || errorMsg.includes('decrypt') || 
              errorMsg.includes('autorisiert') || errorMsg.includes('Backup')) {
            setError(errorMsg);
          } else {
            setError('Fehler beim Wiederherstellen: ' + errorMsg);
          }
        },
        onRetryKey: (file) => {
          setPendingRestoreFile(file);
          setShowRestoreKeyDialog(true);
        },
        onCancel: () => {
          setPendingRestoreFile(null);
        }
      }
    );
    
    setPendingRestoreFile(null);
  };

  // Trigger file selection
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection
  const handleFileSelect = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    event.target.value = '';
    
    try {
      // Parse file to get item counts for progress dialog
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);
      
      const itemCounts = {
        categories: backupData.data?.categories?.length || 0,
        appliances: backupData.data?.appliances?.length || 0,
        users: backupData.data?.users?.length || 0,
        background_images: backupData.data?.background_images?.length || 0,
        hosts: backupData.data?.hosts?.length || 0,
        ssh_keys: backupData.data?.ssh_keys?.length || 0,
        snmp_metrics: backupData.data?.snmp_metrics?.length || 0,
      };
      
      setRestoreItemCounts(itemCounts);
      
      // Check if backup has encrypted data
      const hasEncryptedData =
        backupData.data?.ssh_keys?.some(key => key.private_key) ||
        backupData.data?.hosts?.some(host => host.password || host.ssh_key_id) ||
        backupData.data?.appliances?.some(app => 
          app.remote_password_encrypted || app.rustdesk_password_encrypted
        );

      if (hasEncryptedData) {
        setPendingRestoreFile(file);
        setShowRestoreKeyDialog(true);
      } else {
        // No encryption key needed
        handleRestoreWithKey(null, true);
      }
    } catch (err) {
      setError(t('backup.invalidFile'));
    }
  };

  // Handle drag and drop
  const handleDrop = async event => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError(t('backup.invalidFile'));
      return;
    }

    // Process as if selected via file input
    handleFileSelect({ target: { files: [file] } });
  };

  const handleDragOver = event => {
    event.preventDefault();
    event.stopPropagation();
  };

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
          mb: 4,
        }}
      >
        {/* Create Backup Card */}
        <Card
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 2,
                animation: `${floatAnimation} 3s ease-in-out infinite`,
              }}
            >
              <CloudDownload sx={{ fontSize: 40, mr: 2, color: 'white' }} />
              <Box>
                <Typography variant="h6" sx={{ color: 'white' }}>
                  {t('backup.createBackup')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                  {t('backup.createDescription')}
                </Typography>
              </Box>
            </Box>

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={creatingBackup ? <CircularProgress size={20} /> : <Save />}
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
                animation: creatingBackup ? `${pulseAnimation} 2s infinite` : 'none',
              }}
            >
              {creatingBackup ? t('backup.creating') : t('backup.createNow')}
            </Button>
          </CardContent>
        </Card>

        {/* Restore Backup Card */}
        <Card
          sx={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
            },
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 2,
                animation: `${floatAnimation} 3s ease-in-out infinite`,
              }}
            >
              <CloudUpload sx={{ fontSize: 40, mr: 2, color: 'white' }} />
              <Box>
                <Typography variant="h6" sx={{ color: 'white' }}>
                  {t('backup.restoreBackup')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                  {t('backup.restoreDescription')}
                </Typography>
              </Box>
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={restoreLoading || isProcessing ? <CircularProgress size={20} /> : <Restore />}
              onClick={handleRestoreClick}
              disabled={restoreLoading || isProcessing}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              {restoreLoading || isProcessing ? t('backup.restoring') : t('backup.selectFile')}
            </Button>

            <Typography
              variant="caption"
              sx={{ 
                display: 'block', 
                mt: 2, 
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.8)'
              }}
            >
              {t('backup.dragDropHint')}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Statistics */}
      {!statsLoading && stats && (
        <Fade in timeout={500}>
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: 'white' }}>
                {t('backup.statistics')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('backup.lastBackup')}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    {stats.lastBackup || t('backup.never')}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('backup.totalBackups')}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    {stats.totalBackups || 0}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('backup.lastRestore')}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    {stats.lastRestore || t('backup.never')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Dialogs */}
      <EncryptionKeyDialog
        open={showEncryptionDialog}
        encryptionKey={encryptionKey}
        onClose={() => setShowEncryptionDialog(false)}
      />

      <RestoreKeyDialog
        open={showRestoreKeyDialog}
        onClose={() => {
          setShowRestoreKeyDialog(false);
          setPendingRestoreFile(null);
        }}
        onRestore={handleRestoreWithKey}
        fileName={pendingRestoreFile?.name || 'backup.json'}
      />

      {/* Invalid Key Dialog from centralized hook */}
      <InvalidKeyDialog
        open={showInvalidKeyDialog}
        onConfirm={invalidKeyHandlers.onConfirm}
        onRetry={invalidKeyHandlers.onRetry}
        onCancel={invalidKeyHandlers.onCancel}
      />

      {/* Restore Progress Dialog */}
      <RestoreProgressDialog
        open={showProgressDialog}
        sessionId={restoreSessionId}
        totalItems={restoreItemCounts}
        onClose={() => {
          setShowProgressDialog(false);
          setRestoreSessionId(null);
          setRestoreItemCounts({});
        }}
      />

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" icon={<CheckCircle />} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" icon={<Error />} onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
