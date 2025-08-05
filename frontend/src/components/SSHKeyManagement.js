import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Plus,
  Copy,
  Download,
  Trash2,
  Key,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react';
import axios from '../utils/axiosConfig';
import { copyToClipboard } from '../utils/clipboard';

const SSHKeyManagement = ({ onKeyGenerated }) => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState({});
  
  // Form data
  const [generateForm, setGenerateForm] = useState({
    keyName: '',
    keyType: 'rsa',
    keySize: 2048,
    comment: '',
  });
  
  const [importForm, setImportForm] = useState({
    keyName: '',
    privateKey: '',
    passphrase: '',
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/sshKeys');
      setKeys(response.data.keys || []);
    } catch (error) {
      console.error('Error fetching SSH keys:', error);
      setError('Fehler beim Laden der SSH-Schlüssel');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/sshKeys/generate', generateForm);
      
      if (response.data.success) {
        setSuccess('SSH-Schlüssel erfolgreich generiert');
        setShowGenerateDialog(false);
        setGenerateForm({
          keyName: '',
          keyType: 'rsa',
          keySize: 2048,
          comment: '',
        });
        fetchKeys();
        
        // Copy public key to clipboard
        if (response.data.publicKey) {
          const copied = await copyToClipboard(response.data.publicKey);
          if (copied) {
            setSuccess('SSH-Schlüssel generiert und öffentlicher Schlüssel in Zwischenablage kopiert');
          } else {
            setSuccess('SSH-Schlüssel generiert (Kopieren in Zwischenablage fehlgeschlagen)');
          }
        }
        
        // Notify parent component
        if (onKeyGenerated) {
          onKeyGenerated(generateForm.keyName);
        }
      }
    } catch (error) {
      console.error('Error generating SSH key:', error);
      setError(error.response?.data?.error || 'Fehler beim Generieren des SSH-Schlüssels');
    } finally {
      setLoading(false);
    }
  };

  const handleImportKey = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/sshKeys/import', importForm);
      
      if (response.data.success) {
        setSuccess('SSH-Schlüssel erfolgreich importiert');
        setShowImportDialog(false);
        setImportForm({
          keyName: '',
          privateKey: '',
          passphrase: '',
        });
        fetchKeys();
        
        // Notify parent component
        if (onKeyGenerated) {
          onKeyGenerated(importForm.keyName);
        }
      }
    } catch (error) {
      console.error('Error importing SSH key:', error);
      setError(error.response?.data?.error || 'Fehler beim Importieren des SSH-Schlüssels');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPublicKey = async (keyName) => {
    try {
      const response = await axios.get(`/api/sshKeys/${keyName}/public`);
      const copied = await copyToClipboard(response.data.publicKey);
      if (copied) {
        setSuccess('Öffentlicher Schlüssel in Zwischenablage kopiert');
      } else {
        setError('Kopieren in Zwischenablage fehlgeschlagen - bitte manuell kopieren');
      }
    } catch (error) {
      console.error('Error copying public key:', error);
      setError('Fehler beim Kopieren des öffentlichen Schlüssels');
    }
  };

  const handleCopyPrivateKey = async (keyName) => {
    try {
      const response = await axios.get(`/api/sshKeys/${keyName}/private`);
      const copied = await copyToClipboard(response.data.privateKey);
      if (copied) {
        setSuccess('Privater Schlüssel in Zwischenablage kopiert');
      } else {
        setError('Kopieren in Zwischenablage fehlgeschlagen - bitte manuell kopieren');
      }
    } catch (error) {
      console.error('Error copying private key:', error);
      setError('Fehler beim Kopieren des privaten Schlüssels');
    }
  };

  const handleDeleteKey = async (keyId, keyName) => {
    if (!window.confirm(`Möchten Sie den SSH-Schlüssel "${keyName}" wirklich löschen?`)) {
      return;
    }

    try {
      await axios.delete(`/api/sshKeys/${keyId}`);
      setSuccess('SSH-Schlüssel erfolgreich gelöscht');
      fetchKeys();
    } catch (error) {
      console.error('Error deleting SSH key:', error);
      if (error.response?.status === 400) {
        setError(error.response.data.error || 'Schlüssel kann nicht gelöscht werden');
      } else {
        setError('Fehler beim Löschen des SSH-Schlüssels');
      }
    }
  };

  const handleDownloadKey = async (keyName, type) => {
    try {
      const endpoint = type === 'public' ? 'public' : 'private';
      const response = await axios.get(`/api/sshKeys/${keyName}/${endpoint}`);
      
      const blob = new Blob([response.data[`${type}Key`]], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'public' ? `${keyName}.pub` : `${keyName}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading key:', error);
      setError('Fehler beim Herunterladen des Schlüssels');
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">SSH-Schlüssel Verwaltung</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => setShowGenerateDialog(true)}
          >
            Schlüssel generieren
          </Button>
          <Button
            variant="outlined"
            startIcon={<Upload size={20} />}
            onClick={() => setShowImportDialog(true)}
          >
            Schlüssel importieren
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        SSH-Schlüssel werden sicher auf dem Server gespeichert und sind nur für Sie zugänglich. 
        Sie können öffentliche und private Schlüssel in die Zwischenablage kopieren oder herunterladen.
      </Alert>

      {/* Keys Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : keys.length === 0 ? (
        <Paper sx={{ 
          p: 3, 
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 2,
        }}>
          <Typography color="text.secondary">
            Keine SSH-Schlüssel vorhanden. Klicken Sie auf "Schlüssel generieren" um einen neuen zu erstellen.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {keys.map((key) => (
            <Paper 
              key={key.id}
              sx={{ 
                p: 3,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 2,
                width: '100%',
                '.theme-light &': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                }
              }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Key size={28} style={{ color: 'var(--primary-color)' }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {key.key_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        {key.key_type?.toUpperCase()} • {key.key_size} bit
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Öffentlichen Schlüssel kopieren">
                      <IconButton 
                        size="small" 
                        onClick={() => handleCopyPublicKey(key.key_name)}
                        sx={{ 
                          color: 'var(--text-secondary)',
                          '&:hover': { 
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-primary)'
                          }
                        }}
                      >
                        <Copy size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Privaten Schlüssel kopieren">
                      <IconButton 
                        size="small" 
                        onClick={() => handleCopyPrivateKey(key.key_name)}
                        sx={{ 
                          color: 'var(--warning-color)',
                          '&:hover': { 
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            color: 'var(--warning-color)'
                          }
                        }}
                      >
                        <Key size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Herunterladen">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDownloadKey(key.key_name, 'public')}
                        sx={{ 
                          color: 'var(--text-secondary)',
                          '&:hover': { 
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-primary)'
                          }
                        }}
                      >
                        <Download size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Löschen">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteKey(key.id, key.key_name)}
                        sx={{ 
                          color: 'var(--error-color)',
                          '&:hover': { 
                            backgroundColor: 'rgba(255, 82, 82, 0.1)',
                            color: 'var(--error-color)'
                          }
                        }}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Content */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 0.5 }}>
                    Fingerprint
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      wordBreak: 'break-all',
                      p: 1.5,
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 1,
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-primary)',
                      '.theme-light &': {
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                      }
                    }}
                  >
                    {key.fingerprint}
                  </Typography>
                </Box>

                {/* Comment and Date */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2 }}>
                  {key.comment && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 0.5 }}>
                        Kommentar
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        {key.comment}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ textAlign: key.comment ? 'right' : 'left' }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 0.5 }}>
                      Erstellt am
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                      {new Date(key.created_at).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
          ))}
        </Box>
      )}

      {/* Generate Key Dialog */}
      <Dialog
        open={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>SSH-Schlüssel generieren</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Schlüsselname"
                value={generateForm.keyName}
                onChange={(e) => setGenerateForm({ ...generateForm, keyName: e.target.value })}
                required
                helperText="Nur Buchstaben, Zahlen, Bindestriche und Unterstriche"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Schlüsseltyp</InputLabel>
                <Select
                  value={generateForm.keyType}
                  onChange={(e) => setGenerateForm({ ...generateForm, keyType: e.target.value })}
                  label="Schlüsseltyp"
                >
                  <MenuItem value="rsa">RSA</MenuItem>
                  <MenuItem value="ed25519">Ed25519</MenuItem>
                  <MenuItem value="ecdsa">ECDSA</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth disabled={generateForm.keyType === 'ed25519'}>
                <InputLabel>Schlüsselgröße</InputLabel>
                <Select
                  value={generateForm.keySize}
                  onChange={(e) => setGenerateForm({ ...generateForm, keySize: e.target.value })}
                  label="Schlüsselgröße"
                >
                  <MenuItem value={2048}>2048 bit</MenuItem>
                  <MenuItem value={3072}>3072 bit</MenuItem>
                  <MenuItem value={4096}>4096 bit</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Kommentar (optional)"
                value={generateForm.comment}
                onChange={(e) => setGenerateForm({ ...generateForm, comment: e.target.value })}
                helperText="Z.B. 'Produktionsserver' oder 'Backup-System'"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGenerateDialog(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleGenerateKey} 
            variant="contained" 
            disabled={loading || !generateForm.keyName}
          >
            Generieren
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Key Dialog */}
      <Dialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>SSH-Schlüssel importieren</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Schlüsselname"
                value={importForm.keyName}
                onChange={(e) => setImportForm({ ...importForm, keyName: e.target.value })}
                required
                helperText="Eindeutiger Name für diesen Schlüssel"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={10}
                label="Privater Schlüssel"
                value={importForm.privateKey}
                onChange={(e) => setImportForm({ ...importForm, privateKey: e.target.value })}
                required
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                sx={{ fontFamily: 'monospace' }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Passphrase (falls verschlüsselt)"
                value={importForm.passphrase}
                onChange={(e) => setImportForm({ ...importForm, passphrase: e.target.value })}
                helperText="Leer lassen, wenn der Schlüssel nicht verschlüsselt ist"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleImportKey} 
            variant="contained" 
            disabled={loading || !importForm.keyName || !importForm.privateKey}
          >
            Importieren
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </Box>
  );
};

export default SSHKeyManagement;
