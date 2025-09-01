import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  TextField,
  Alert,
  Box,
  Paper,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Lock,
  LockOpen,
  Warning,
  Info,
  Key,
} from '@mui/icons-material';

const RestoreKeyDialog = ({ open, onClose, onRestore, fileName }) => {
  const [encryptionKey, setEncryptionKey] = useState('');
  const [skipDecryption, setSkipDecryption] = useState(false);
  const [error, setError] = useState('');

  const handleRestore = () => {
    if (!skipDecryption && !encryptionKey.trim()) {
      setError('Bitte geben Sie den Verschlüsselungsschlüssel ein oder überspringen Sie die Entschlüsselung.');
      return;
    }
    
    onRestore(skipDecryption ? null : encryptionKey.trim());
    handleClose();
  };

  const handleClose = () => {
    setEncryptionKey('');
    setSkipDecryption(false);
    setError('');
    onClose();
  };

  const handleKeyChange = (e) => {
    setEncryptionKey(e.target.value);
    setError('');
  };

  const handleSkipChange = (e) => {
    setSkipDecryption(e.target.checked);
    if (e.target.checked) {
      setError('');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        // Nur bei ESC-Taste schließen, nicht bei Backdrop-Click
        if (reason === 'escapeKeyDown') {
          handleClose();
        }
      }}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={false}
      slotProps={{
        backdrop: {
          sx: {
            zIndex: 9997,
          },
        },
      }}
      PaperProps={{
        sx: {
          backgroundColor: '#1E1E1E',
          backgroundImage: 'none',
          zIndex: 9999,
          position: 'relative',
        },
      }}
      sx={{
        zIndex: 9998,
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
          Backup-Verschlüsselung
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Alert
          severity="info"
          icon={<Info />}
          sx={{
            mb: 3,
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            '& .MuiAlert-icon': {
              color: '#29B6F6',
            },
          }}
        >
          <Typography variant="body2">
            Ihr Backup <strong>{fileName}</strong> enthält verschlüsselte Daten.
            Bitte geben Sie den Verschlüsselungsschlüssel ein, der beim Erstellen 
            des Backups angezeigt wurde.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Key sx={{ fontSize: 20 }} />
            <strong>Verschlüsselungsschlüssel eingeben:</strong>
          </Typography>

          <TextField
            fullWidth
            variant="outlined"
            placeholder="z.B. enc_backup_20250114_a1b2c3d4e5f6..."
            value={encryptionKey}
            onChange={handleKeyChange}
            disabled={skipDecryption}
            error={!!error && !skipDecryption}
            helperText={!skipDecryption ? error : ''}
            autoFocus={true}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                fontFamily: 'monospace',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#0066CC',
                },
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
              },
              '& .MuiInputBase-input': {
                color: '#fff',
                fontSize: '14px',
              },
            }}
          />
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: 2,
            backgroundColor: 'rgba(255, 152, 0, 0.05)',
            border: '1px solid rgba(255, 152, 0, 0.2)',
            mb: 2,
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={skipDecryption}
                onChange={handleSkipChange}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  Ohne Entschlüsselung fortfahren
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Remote-Host-Passwörter müssen dann manuell neu eingegeben werden
                </Typography>
              </Box>
            }
          />
        </Paper>

        {skipDecryption && (
          <Alert
            severity="warning"
            icon={<Warning />}
            sx={{
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              '& .MuiAlert-icon': {
                color: '#FFA726',
              },
            }}
          >
            <Typography variant="body2">
              <strong>Hinweis:</strong> Wenn Sie ohne Schlüssel fortfahren:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              <li>Alle Services werden wiederhergestellt</li>
              <li>SSH-Passwörter müssen neu eingegeben werden</li>
              <li>Remote-Desktop-Passwörter müssen neu eingegeben werden</li>
              <li>Die Verbindungen funktionieren erst nach Eingabe der Passwörter</li>
            </Typography>
          </Alert>
        )}

        {!skipDecryption && (
          <Alert
            severity="success"
            icon={<LockOpen />}
            sx={{
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              '& .MuiAlert-icon': {
                color: '#66BB6A',
              },
            }}
          >
            <Typography variant="body2">
              Mit dem korrekten Schlüssel werden alle Passwörter automatisch 
              entschlüsselt und die Verbindungen funktionieren sofort.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Button
          onClick={handleClose}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleRestore}
          variant="contained"
          sx={{
            backgroundColor: '#0066CC',
            '&:hover': {
              backgroundColor: '#0051A2',
            },
          }}
        >
          Backup wiederherstellen
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestoreKeyDialog;
