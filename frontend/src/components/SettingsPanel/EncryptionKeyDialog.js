import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Alert,
  Box,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Lock,
  Warning,
  ContentCopy,
  Security,
  VpnKey,
} from '@mui/icons-material';
import { useState } from 'react';

const EncryptionKeyDialog = ({ open, onClose, encryptionKey }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(encryptionKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1E1E1E',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Lock sx={{ color: '#FFD700' }} />
        <Typography variant="h6">
          {t('encryptionDialog.title')}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Alert
          severity="warning"
          icon={<Warning />}
          sx={{
            mb: 3,
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            '& .MuiAlert-icon': {
              color: '#FFA726',
            },
          }}
        >
          <Typography variant="body2">
            <strong>{t('encryptionDialog.attention')}:</strong> {t('encryptionDialog.warning')}
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <VpnKey sx={{ fontSize: 20 }} />
            <strong>{t('encryptionDialog.yourKey')}:</strong>
          </Typography>

          <Paper
            elevation={3}
            sx={{
              p: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                flex: 1,
                fontSize: '14px',
              }}
            >
              {encryptionKey}
            </Typography>
            <Tooltip title={copied ? t('encryptionDialog.copied') : t('encryptionDialog.copyToClipboard')}>
              <IconButton
                onClick={handleCopyKey}
                size="small"
                sx={{
                  color: copied ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: '#fff',
                  },
                }}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Paper>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security sx={{ fontSize: 20 }} />
            {t('encryptionDialog.whatIsEncrypted')}
          </Typography>
          <Typography variant="body2" sx={{ ml: 3 }}>
            • {t('encryptionDialog.encryptedItem1')}<br />
            • {t('encryptionDialog.encryptedItem2')}<br />
            • {t('encryptionDialog.encryptedItem3')}
          </Typography>
        </Box>

        <Alert
          severity="info"
          sx={{
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            '& .MuiAlert-icon': {
              color: '#29B6F6',
            },
          }}
        >
          <Typography variant="body2">
            <strong>{t('encryptionDialog.recommendedStorage')}:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, ml: 2 }}>
            • {t('encryptionDialog.storageOption1')}<br />
            • {t('encryptionDialog.storageOption2')}<br />
            • {t('encryptionDialog.storageOption3')}<br />
            • {t('encryptionDialog.storageOption4')}
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: '#0066CC',
            '&:hover': {
              backgroundColor: '#0051A2',
            },
          }}
        >
          {t('common.understood')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EncryptionKeyDialog;
