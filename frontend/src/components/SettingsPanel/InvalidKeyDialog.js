import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Alert,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Warning,
  Check,
  Close,
  Key,
  VpnKey,
  Password,
} from '@mui/icons-material';

const InvalidKeyDialog = ({ open, onConfirm, onRetry, onCancel }) => {
  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 165, 0, 0.3)',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Warning sx={{ color: 'warning.main', fontSize: 32 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Ungültiger Backup-Schlüssel
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          Der eingegebene Schlüssel ist ungültig oder gehört zu einem anderen Backup.
        </Alert>

        <Typography variant="body1" sx={{ mb: 2 }}>
          Sie haben folgende Optionen:
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Option 1: Trotzdem fortfahren
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><Check sx={{ color: 'success.main' }} /></ListItemIcon>
              <ListItemText 
                primary="Alle Daten werden wiederhergestellt"
                secondary="Services, Kategorien, Einstellungen, etc."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Close sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText 
                primary="Passwörter gehen verloren"
                secondary="VNC/RDP-Passwörter müssen neu eingegeben werden"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Close sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText 
                primary="SSH-Keys gehen verloren"
                secondary="Private SSH-Schlüssel müssen neu erstellt werden"
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Option 2: Anderen Schlüssel eingeben
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Geben Sie den korrekten Schlüssel ein, der beim Erstellen dieses Backups angezeigt wurde.
          </Typography>
        </Box>

        <Alert severity="info" icon={<Key />}>
          Der Backup-Schlüssel ist eine 64-stellige Zeichenfolge, die beim Erstellen des Backups angezeigt wurde.
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={onCancel}
          color="inherit"
          variant="outlined"
        >
          Abbrechen
        </Button>
        <Button
          onClick={onRetry}
          variant="contained"
          startIcon={<VpnKey />}
          sx={{
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          }}
        >
          Anderen Schlüssel eingeben
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="warning"
          startIcon={<Warning />}
        >
          Trotzdem fortfahren
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvalidKeyDialog;
