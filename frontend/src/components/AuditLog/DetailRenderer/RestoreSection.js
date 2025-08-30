// Restore section component for audit log details
import React from 'react';
import {
  Box,
  Button,
  TextField,
  Stack,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  History,
  RotateCcw,
} from 'lucide-react';

const RestoreSection = ({ 
  log,
  restoreInfo,
  isRestoring,
  restoreError,
  restoreSuccess,
  showNameInput,
  setShowNameInput,
  newName,
  setNewName,
  showEmailInput,
  setShowEmailInput,
  newEmail,
  setNewEmail,
  handleRestoreClick,
  getResourceName,
}) => {
  return (
    <>
      <Divider sx={{ my: 2 }} />
      
      {restoreSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Erfolgreich {restoreInfo.type === 'restore' ? 'wiederhergestellt' : 'zurückgesetzt'}!
        </Alert>
      )}
      
      {restoreError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {restoreError}
        </Alert>
      )}

      {showNameInput && (
        <TextField
          fullWidth
          size="small"
          label={
            (log.action === 'user_delete' || log.action === 'user_deleted') && showEmailInput
              ? "Neuer Benutzername (optional)"
              : "Neuer Name (optional)"
          }
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          sx={{ mb: 2 }}
          placeholder={
            (log.action === 'user_delete' || log.action === 'user_deleted')
              ? `Neuer Benutzername für ${getResourceName(log)}`
              : `Neuer Name für ${getResourceName(log)}`
          }
          helperText={
            (log.action === 'user_delete' || log.action === 'user_deleted') && showEmailInput
              ? "Lassen Sie leer, um den ursprünglichen Namen zu behalten"
              : null
          }
        />
      )}

      {showEmailInput && (log.action === 'user_delete' || log.action === 'user_deleted') && (
        <TextField
          fullWidth
          size="small"
          label="Neue E-Mail-Adresse (erforderlich)"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          sx={{ mb: 2 }}
          placeholder="neue.email@example.com"
          required
          error={showEmailInput && !newEmail}
          helperText={
            showEmailInput && !newEmail 
              ? "E-Mail-Adresse ist erforderlich für die Wiederherstellung"
              : "Eine neue E-Mail-Adresse verhindert Konflikte mit bestehenden Benutzern"
          }
        />
      )}

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color={restoreInfo.type === 'restore' ? 'success' : 'warning'}
          startIcon={isRestoring ? <CircularProgress size={16} /> : 
            restoreInfo.type === 'restore' ? <History size={16} /> : <RotateCcw size={16} />}
          onClick={handleRestoreClick}
          disabled={isRestoring || restoreSuccess}
        >
          {restoreInfo.type === 'restore' ? 'Wiederherstellen' : 'Änderungen rückgängig machen'}
        </Button>
        
        {restoreInfo.type === 'restore' && !showNameInput && !showEmailInput && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setShowNameInput(true);
              // Bei User-Wiederherstellung auch E-Mail-Feld anzeigen
              if (log.action === 'user_delete' || log.action === 'user_deleted') {
                setShowEmailInput(true);
              }
            }}
          >
            {(log.action === 'user_delete' || log.action === 'user_deleted') 
              ? 'Mit neuen Daten' 
              : 'Mit neuem Namen'}
          </Button>
        )}
      </Stack>
    </>
  );
};

export default RestoreSection;
