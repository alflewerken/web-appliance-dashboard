import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Chip,
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
  Edit2,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import { copyToClipboard } from '../../utils/clipboard';

const SSHKeyManagement = ({ onKeyCreated, onKeyDeleted, adminMode, selectedKeyName }) => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
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
  
  const [editForm, setEditForm] = useState({
    id: null,
    keyName: '',
    comment: '',
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      // SSH-Schlüssel abrufen
      const keysResponse = await axios.get('/api/sshKeys');
      const keysData = keysResponse.data.keys || [];
      
      // Hosts abrufen um zu zählen, welche Keys verwendet werden
      try {
        const hostsResponse = await axios.get('/api/hosts');
        if (hostsResponse.data.success) {
          const hosts = hostsResponse.data.hosts || [];
          
          // Zähle wie viele Hosts jeden Key verwenden
          const keyUsageCount = {};
          hosts.forEach(host => {
            if (host.sshKeyName) {
              keyUsageCount[host.sshKeyName] = (keyUsageCount[host.sshKeyName] || 0) + 1;
            }
          });
          
          // Füge die Usage-Counts zu den Keys hinzu
          const keysWithUsage = keysData.map(key => ({
            ...key,
            hostCount: keyUsageCount[key.keyName] || 0
          }));
          
          setKeys(keysWithUsage);
        } else {
          setKeys(keysData);
        }
      } catch (hostError) {
        console.warn('Could not fetch host counts:', hostError);
        setKeys(keysData);
      }
    } catch (error) {
      console.error('Error fetching SSH keys:', error);
      setError(t('sshKeys.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/sshKeys/generate', generateForm);
      
      if (response.data.success) {
        setSuccess(t('sshKeys.success.keyGenerated'));
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
            setSuccess(t('sshKeys.success.keyGeneratedAndCopied'));
          } else {
            setSuccess(t('sshKeys.success.keyGeneratedCopyFailed'));
          }
        }
        
        // Notify parent component
        if (onKeyCreated) {
          onKeyCreated(generateForm.keyName);
        }
      }
    } catch (error) {
      console.error('Error generating SSH key:', error);
      setError(error.response?.data?.error || t('sshKeys.errors.generateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleImportKey = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/sshKeys/import', importForm);
      
      if (response.data.success) {
        setSuccess(t('sshKeys.success.keyImported'));
        setShowImportDialog(false);
        setImportForm({
          keyName: '',
          privateKey: '',
          passphrase: '',
        });
        fetchKeys();
        
        // Notify parent component
        if (onKeyCreated) {
          onKeyCreated(importForm.keyName);
        }
      }
    } catch (error) {
      console.error('Error importing SSH key:', error);
      setError(error.response?.data?.error || t('sshKeys.errors.importFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPublicKey = async (keyName) => {
    try {
      const response = await axios.get(`/api/sshKeys/${keyName}/public`);
      const copied = await copyToClipboard(response.data.publicKey);
      if (copied) {
        setSuccess(t('sshKeys.success.publicKeyCopied'));
      } else {
        setError(t('sshKeys.errors.clipboardFailed'));
      }
    } catch (error) {
      console.error('Error copying public key:', error);
      setError(t('sshKeys.errors.copyPublicKeyFailed'));
    }
  };

  const handleCopyPrivateKey = async (keyName) => {
    try {
      const response = await axios.get(`/api/sshKeys/${keyName}/private`);
      const copied = await copyToClipboard(response.data.privateKey);
      if (copied) {
        setSuccess(t('sshKeys.success.privateKeyCopied'));
      } else {
        setError(t('sshKeys.errors.clipboardFailed'));
      }
    } catch (error) {
      console.error('Error copying private key:', error);
      setError(t('sshKeys.errors.copyPrivateKeyFailed'));
    }
  };

  const handleDeleteKey = async (keyId, keyName) => {
    if (!window.confirm(t('sshKeys.confirmDelete', { keyName }))) {
      return;
    }

    try {
      await axios.delete(`/api/sshKeys/${keyId}`);
      setSuccess(t('sshKeys.success.keyDeleted'));
      fetchKeys();
      
      // Notify parent component
      if (onKeyDeleted) {
        onKeyDeleted();
      }
    } catch (error) {
      console.error('Error deleting SSH key:', error);
      if (error.response?.status === 400) {
        setError(error.response.data.error || t('sshKeys.errors.cannotDelete'));
      } else {
        setError(t('sshKeys.errors.deleteFailed'));
      }
    }
  };

  const handleEditKey = (key) => {
    setEditForm({
      id: key.id,
      keyName: key.keyName,
      comment: key.comment || '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateKey = async () => {
    try {
      setLoading(true);
      // Da das Backend noch keine Update-Route hat, zeigen wir nur eine Meldung
      // TODO: Backend-Route für Update implementieren
      setError(t('sshKeys.errors.editNotImplemented'));
      setShowEditDialog(false);
    } catch (error) {
      console.error('Error updating SSH key:', error);
      setError(t('sshKeys.errors.updateFailed'));
    } finally {
      setLoading(false);
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
      setError(t('sshKeys.errors.downloadFailed'));
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">{t('sshKeys.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => setShowGenerateDialog(true)}
          >
            {t('sshKeys.generateKey')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Upload size={20} />}
            onClick={() => setShowImportDialog(true)}
          >
            {t('sshKeys.importKey')}
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        {t('sshKeys.infoMessage')}
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
            {t('sshKeys.noKeysMessage')}
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
                border: key.keyName === selectedKeyName 
                  ? '2px solid var(--primary-color)' 
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 2,
                width: '100%',
                boxShadow: key.keyName === selectedKeyName 
                  ? '0 0 20px rgba(0, 122, 255, 0.3)' 
                  : 'none',
                transition: 'all 0.3s ease',
                '.theme-light &': {
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: key.keyName === selectedKeyName 
                    ? '2px solid var(--primary-color)' 
                    : '1px solid rgba(0, 0, 0, 0.1)',
                }
              }}
              >
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Key size={28} style={{ color: 'var(--primary-color)' }} />
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {key.keyName}
                        </Typography>
                        {key.hostCount > 0 && (
                          <Chip 
                            label={`${key.hostCount} ${key.hostCount === 1 ? t('sshKeys.host') : t('sshKeys.hosts')}`}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(138, 43, 226, 0.2)',
                              color: '#8A2BE2',
                              border: '1px solid rgba(138, 43, 226, 0.3)',
                              fontWeight: 500,
                              fontSize: '0.75rem',
                              height: 22,
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        {key.keyType?.toUpperCase() || 'RSA'} • {key.keySize || 2048} bit
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={t('sshKeys.actions.edit')}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditKey(key)}
                        sx={{ 
                          color: 'var(--text-secondary)',
                          '&:hover': { 
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-primary)'
                          }
                        }}
                      >
                        <Edit2 size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('sshKeys.actions.copyPublic')}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleCopyPublicKey(key.keyName)}
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
                    <Tooltip title={t('sshKeys.actions.copyPrivate')}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleCopyPrivateKey(key.keyName)}
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
                    <Tooltip title={t('sshKeys.actions.download')}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDownloadKey(key.keyName, 'public')}
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
                    <Tooltip title={key.hostCount > 0 ? t('sshKeys.cannotDelete', { count: key.hostCount, hosts: key.hostCount === 1 ? t('sshKeys.host') : t('sshKeys.hosts') }) : t('sshKeys.actions.delete')}>
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteKey(key.id, key.keyName)}
                          disabled={key.hostCount > 0}
                          sx={{ 
                            color: key.hostCount > 0 ? 'var(--text-tertiary)' : 'var(--error-color)',
                            '&:hover': { 
                              backgroundColor: key.hostCount > 0 ? 'transparent' : 'rgba(255, 82, 82, 0.1)',
                              color: key.hostCount > 0 ? 'var(--text-tertiary)' : 'var(--error-color)'
                            },
                            '&.Mui-disabled': {
                              color: 'var(--text-tertiary)',
                              opacity: 0.5,
                            }
                          }}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Content */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 0.5 }}>
                    {t('sshKeys.fingerprint')}
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
                        {t('sshKeys.comment')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                        {key.comment}
                      </Typography>
                    </Box>
                  )}
                  
                  <Box sx={{ textAlign: key.comment ? 'right' : 'left' }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 0.5 }}>
                      {t('sshKeys.createdAt')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--text-primary)' }}>
                      {key.createdAt ? new Date(key.createdAt).toLocaleDateString(t('common.locale'), {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : t('common.unknown')}
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
        <DialogTitle>{t('sshKeys.dialogs.generate.title')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('sshKeys.keyName')}
                value={generateForm.keyName}
                onChange={(e) => setGenerateForm({ ...generateForm, keyName: e.target.value })}
                required
                helperText={t('sshKeys.keyNameHelp')}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>{t('sshKeys.keyType')}</InputLabel>
                <Select
                  value={generateForm.keyType}
                  onChange={(e) => setGenerateForm({ ...generateForm, keyType: e.target.value })}
                  label={t('sshKeys.keyType')}
                >
                  <MenuItem value="rsa">RSA</MenuItem>
                  <MenuItem value="ed25519">Ed25519</MenuItem>
                  <MenuItem value="ecdsa">ECDSA</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth disabled={generateForm.keyType === 'ed25519'}>
                <InputLabel>{t('sshKeys.keySize')}</InputLabel>
                <Select
                  value={generateForm.keySize}
                  onChange={(e) => setGenerateForm({ ...generateForm, keySize: e.target.value })}
                  label={t('sshKeys.keySize')}
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
                label={t('sshKeys.comment')}
                value={generateForm.comment}
                onChange={(e) => setGenerateForm({ ...generateForm, comment: e.target.value })}
                helperText={t('sshKeys.commentHelp')}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGenerateDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleGenerateKey} 
            variant="contained" 
            disabled={loading || !generateForm.keyName}
          >
            {t('sshKeys.generate')}
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
        <DialogTitle>{t('sshKeys.dialogs.import.title')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('sshKeys.keyName')}
                value={importForm.keyName}
                onChange={(e) => setImportForm({ ...importForm, keyName: e.target.value })}
                required
                helperText={t('sshKeys.uniqueNameHelp')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={10}
                label={t('sshKeys.privateKey')}
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
                label={t('sshKeys.passphrase')}
                value={importForm.passphrase}
                onChange={(e) => setImportForm({ ...importForm, passphrase: e.target.value })}
                helperText={t('sshKeys.passphraseHelp')}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleImportKey} 
            variant="contained" 
            disabled={loading || !importForm.keyName || !importForm.privateKey}
          >
            {t('sshKeys.import')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Key Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('sshKeys.dialogs.edit.title')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('sshKeys.keyName')}
                value={editForm.keyName}
                onChange={(e) => setEditForm({ ...editForm, keyName: e.target.value })}
                disabled
                helperText={t('sshKeys.keyNameCannotBeChanged')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('sshKeys.comment')}
                value={editForm.comment}
                onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                helperText={t('sshKeys.optionalComment')}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleUpdateKey} 
            variant="contained" 
            disabled={loading}
          >
            {t('common.save')}
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
