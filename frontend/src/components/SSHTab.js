import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  Tooltip,
  FormControlLabel,
  Switch,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tab,
  Tabs,
  Divider,
  Collapse,
} from '@mui/material';
import {
  Server,
  Key,
  Plus,
  Terminal,
  RefreshCw,
  Edit,
  Trash2,
  Download,
  Copy,
  CheckCircle,
  AlertCircle,
  FileText,
  Lock,
  Upload,
  Save,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Shield,
  Check,
  X,
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import axios from '../utils/axiosConfig';
import SSHHostManager from './SSHHostManager';
import { useSSE } from '../hooks/useSSE';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`ssh-tabpanel-${index}`}
      aria-labelledby={`ssh-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </Box>
  );
}

const SSHTab = ({ onTerminalOpen }) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [hosts, setHosts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Host form state
  const [showHostForm, setShowHostForm] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [hostFormData, setHostFormData] = useState({
    hostname: '',
    host: '',
    username: '',
    port: 22,
    password: '',
    key_name: 'dashboard',
  });
  
  // Key form state
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyFormData, setKeyFormData] = useState({
    keyName: 'dashboard',
    keyType: 'rsa',
    keySize: 2048,
    comment: '',
  });
  
  // Other states
  const [expandedHost, setExpandedHost] = useState(null);
  const [testingHost, setTestingHost] = useState(null);
  const [setupProgress, setSetupProgress] = useState({});
  
  const { addEventListener } = useSSE();

  // Fetch functions
  const fetchHosts = useCallback(async () => {
    try {

      const response = await axios.get('/api/ssh/hosts');

      setHosts(response.data.hosts || []);
    } catch (error) {
      console.error('Error fetching SSH hosts:', error);
      setError('Fehler beim Laden der SSH-Hosts');
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    try {

      const response = await axios.get('/api/ssh/keys');

      setKeys(response.data.keys || []);
    } catch (error) {
      console.error('Error fetching SSH keys:', error);
      setError('Fehler beim Laden der SSH-Schlüssel');
    }
  }, []);

  // Load data on mount and setup SSE listeners
  useEffect(() => {

    fetchHosts();
    fetchKeys();

    if (addEventListener) {
      const unsubscribers = [
        addEventListener('ssh_host_created', () => {

          fetchHosts();
        }),
        addEventListener('ssh_host_updated', () => {

          fetchHosts();
        }),
        addEventListener('ssh_host_deleted', () => {

          fetchHosts();
        }),
        addEventListener('ssh_key_created', () => {

          fetchKeys();
        }),
        addEventListener('ssh_key_deleted', () => {

          fetchKeys();
        }),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, fetchHosts, fetchKeys]);

  // Clear messages after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Host management functions
  const handleHostSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingHost) {
        await axios.put(`/api/ssh/hosts/${editingHost.id}`, hostFormData);
        setSuccess('SSH-Host erfolgreich aktualisiert');
      } else {
        // For new hosts, check if we need to setup SSH
        if (hostFormData.password) {
          // Setup SSH with password
          setSetupProgress({ [hostFormData.hostname]: 'Richte SSH-Verbindung ein...' });
          
          try {
            const setupResponse = await axios.post('/api/ssh/setup', {
              hostname: hostFormData.hostname,
              host: hostFormData.host,
              username: hostFormData.username,
              password: hostFormData.password,
              port: hostFormData.port,
              keyName: hostFormData.key_name,
            });

            if (setupResponse.data.success) {
              setSetupProgress({ [hostFormData.hostname]: 'SSH-Schlüssel erfolgreich eingerichtet!' });
              setSuccess('SSH-Host erfolgreich eingerichtet und gespeichert');
              setShowHostForm(false);
              setEditingHost(null);
              resetHostForm();
              fetchHosts();
            }
          } catch (setupError) {
            console.error('Setup error:', setupError);
            
            // Handle setup-specific errors
            if (setupError.response?.status === 409) {
              setError(setupError.response.data.error || 'Ein SSH-Host mit diesen Daten existiert bereits');
            } else if (setupError.response?.data?.error) {
              setError(`Setup-Fehler: ${setupError.response.data.error}`);
            } else {
              setError('Fehler beim Einrichten der SSH-Verbindung');
            }
            setLoading(false);
            return;
          }
        } else {
          // Just save the host without setup
          await axios.post('/api/ssh/hosts', hostFormData);
          setSuccess('SSH-Host erfolgreich gespeichert');
          setShowHostForm(false);
          setEditingHost(null);
          resetHostForm();
          fetchHosts();
        }
      }
    } catch (error) {
      console.error('Error saving SSH host:', error);
      
      // Better error handling
      if (error.response?.status === 409) {
        setError('Ein SSH-Host mit diesem Namen oder diesen Verbindungsdaten existiert bereits');
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern des SSH-Hosts');
      }
      
      // Don't close the form on error
      setLoading(false);
      return;
    } finally {
      setLoading(false);
      setTimeout(() => setSetupProgress({}), 3000);
    }
  };

  const handleEditHost = (host) => {
    setEditingHost(host);
    setHostFormData({
      hostname: host.hostname,
      host: host.host,
      username: host.username,
      port: host.port,
      password: '', // Don't populate password for security
      key_name: host.key_name,
    });
    setShowHostForm(true);
  };

  const handleDeleteHost = async (hostId) => {
    if (!window.confirm('Möchten Sie diesen SSH-Host wirklich löschen?')) return;

    try {
      await axios.delete(`/api/ssh/hosts/${hostId}`);
      setSuccess('SSH-Host erfolgreich gelöscht');
      fetchHosts();
    } catch (error) {
      console.error('Error deleting SSH host:', error);
      setError('Fehler beim Löschen des SSH-Hosts');
    }
  };

  const handleTestConnection = async (host) => {
    setTestingHost(host.id);
    try {
      const response = await axios.post('/api/ssh/test', {
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        keyName: host.key_name,
      });

      if (response.data.success) {
        setSuccess(`Verbindung zu ${host.hostname} erfolgreich!`);
      } else {
        setError(`Verbindungstest fehlgeschlagen: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setError('Fehler beim Testen der Verbindung');
    } finally {
      setTestingHost(null);
    }
  };

  const resetHostForm = () => {
    setHostFormData({
      hostname: '',
      host: '',
      username: '',
      port: 22,
      password: '',
      key_name: 'dashboard',
    });
  };

  // Key management functions
  const handleGenerateKey = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/ssh/keys/generate', keyFormData);
      
      if (response.data.success) {
        setSuccess('SSH-Schlüssel erfolgreich generiert');
        setShowKeyForm(false);
        resetKeyForm();
        fetchKeys();
        
        // Show public key for copying
        if (response.data.publicKey) {
          navigator.clipboard.writeText(response.data.publicKey);
          setSuccess('SSH-Schlüssel generiert und öffentlicher Schlüssel in Zwischenablage kopiert');
        }
      }
    } catch (error) {
      console.error('Error generating SSH key:', error);
      setError(error.response?.data?.error || 'Fehler beim Generieren des SSH-Schlüssels');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Möchten Sie diesen SSH-Schlüssel wirklich löschen?')) return;

    try {
      await axios.delete(`/api/ssh/keys/${keyId}`);
      setSuccess('SSH-Schlüssel erfolgreich gelöscht');
      fetchKeys();
    } catch (error) {
      console.error('Error deleting SSH key:', error);
      
      // Better error handling
      if (error.response?.status === 400) {
        if (error.response.data.error?.includes('in use')) {
          setError(`Dieser SSH-Schlüssel kann nicht gelöscht werden, da er von ${error.response.data.hosts_count || 'einem oder mehreren'} SSH-Host(s) verwendet wird`);
        } else if (error.response.data.error?.includes('default')) {
          setError('Der Standard-SSH-Schlüssel kann nicht gelöscht werden');
        } else {
          setError(error.response.data.error || 'Fehler beim Löschen des SSH-Schlüssels');
        }
      } else {
        setError('Fehler beim Löschen des SSH-Schlüssels');
      }
    }
  };

  const handleDownloadKey = async (keyName, type) => {
    try {
      const response = await axios.get(`/api/ssh/keys/${keyName}/${type}`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'private' ? `id_rsa_${keyName}` : `id_rsa_${keyName}.pub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading key:', error);
      setError('Fehler beim Herunterladen des Schlüssels');
    }
  };

  const resetKeyForm = () => {
    setKeyFormData({
      keyName: 'dashboard',
      keyType: 'rsa',
      keySize: 2048,
      comment: '',
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="SSH-Hosts" icon={<Server size={20} />} iconPosition="start" />
          <Tab label="SSH-Schlüssel" icon={<Key size={20} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* SSH Hosts Tab */}
      <TabPanel value={tabValue} index={0}>
        <SSHHostManager onTerminalOpen={onTerminalOpen} embedded={true} />
      </TabPanel>

      {/* SSH Keys Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">SSH-Schlüssel verwalten</Typography>
            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              onClick={() => setShowKeyForm(true)}
            >
              Schlüssel generieren
            </Button>
          </Box>

          {keys.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">
                Keine SSH-Schlüssel vorhanden
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {keys.map((key) => (
                <Card
                  key={key.id}
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.5)' 
                      : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.06)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 4px 8px rgba(0, 0, 0, 0.4)'
                      : '0 2px 6px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: theme.palette.mode === 'dark'
                        ? '0 6px 12px rgba(0, 0, 0, 0.5)'
                        : '0 4px 8px rgba(0, 0, 0, 0.12)',
                    },
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6">
                            {key.key_name}
                          </Typography>
                          {key.is_default && (
                            <Chip label="Standard" size="small" color="primary" sx={{ ml: 1 }} />
                          )}
                          {key.hosts_count > 0 && (
                            <Chip 
                              label={`${key.hosts_count} Host${key.hosts_count > 1 ? 's' : ''}`} 
                              size="small" 
                              color="secondary" 
                              sx={{ ml: 1 }} 
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          Typ: {key.key_type} | Größe: {key.key_size} Bit
                        </Typography>
                        {key.comment && (
                          <Typography variant="body2" color="textSecondary">
                            {key.comment}
                          </Typography>
                        )}
                        <Typography variant="caption" color="textSecondary">
                          Erstellt: {new Date(key.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ml: 2,
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            width: 100,
                            height: 100,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(46, 160, 67, 0.6) 0%, rgba(46, 160, 67, 0.3) 35%, rgba(46, 160, 67, 0.1) 60%, transparent 75%)',
                            filter: 'blur(20px)',
                            animation: 'pulse 3s ease-in-out infinite',
                            '@keyframes pulse': {
                              '0%, 100%': {
                                transform: 'scale(1)',
                                opacity: 0.8,
                              },
                              '50%': {
                                transform: 'scale(1.1)',
                                opacity: 1,
                              },
                            },
                          }}
                        />
                        <Shield 
                          size={44} 
                          style={{ 
                            color: '#2EA043',
                            filter: 'drop-shadow(0 0 16px rgba(46, 160, 67, 0.9))',
                            position: 'relative',
                            zIndex: 1,
                          }} 
                        />
                      </Box>
                    </Box>
                  </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<Download size={16} />}
                        onClick={() => handleDownloadKey(key.key_name, 'public')}
                      >
                        Public Key
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Download size={16} />}
                        onClick={() => handleDownloadKey(key.key_name, 'private')}
                        color="warning"
                      >
                        Private Key
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteKey(key.id)}
                        color="error"
                        disabled={key.is_default || key.hosts_count > 0}
                        title={
                          key.is_default 
                            ? "Standard-Schlüssel kann nicht gelöscht werden" 
                            : key.hosts_count > 0 
                              ? `Wird von ${key.hosts_count} Host(s) verwendet`
                              : "Schlüssel löschen"
                        }
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </CardActions>
                  </Card>
              ))}
            </Box>
          )}
        </Box>
      </TabPanel>

      {/* Host Form Dialog */}
      <Dialog
        open={showHostForm}
        onClose={() => {
          setShowHostForm(false);
          setEditingHost(null);
          resetHostForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleHostSubmit}>
          <DialogTitle>
            {editingHost ? 'SSH-Host bearbeiten' : 'SSH-Host hinzufügen'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Hostname (Alias)"
                  value={hostFormData.hostname}
                  onChange={(e) => setHostFormData({ ...hostFormData, hostname: e.target.value })}
                  required
                  helperText="Ein eindeutiger Name für diesen Host"
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Host/IP-Adresse"
                  value={hostFormData.host}
                  onChange={(e) => setHostFormData({ ...hostFormData, host: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Port"
                  type="number"
                  value={hostFormData.port}
                  onChange={(e) => setHostFormData({ ...hostFormData, port: parseInt(e.target.value) })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Benutzername"
                  value={hostFormData.username}
                  onChange={(e) => setHostFormData({ ...hostFormData, username: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>SSH-Schlüssel</InputLabel>
                  <Select
                    value={hostFormData.key_name}
                    onChange={(e) => setHostFormData({ ...hostFormData, key_name: e.target.value })}
                    label="SSH-Schlüssel"
                  >
                    {keys.map((key) => (
                      <MenuItem key={key.key_name} value={key.key_name}>
                        {key.key_name} {key.is_default && '(Standard)'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {!editingHost && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Passwort (optional)"
                    type="password"
                    value={hostFormData.password}
                    onChange={(e) => setHostFormData({ ...hostFormData, password: e.target.value })}
                    helperText="Wenn angegeben, wird der SSH-Schlüssel automatisch auf dem Host eingerichtet"
                  />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowHostForm(false);
              setEditingHost(null);
              resetHostForm();
            }}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : (editingHost ? 'Speichern' : 'Hinzufügen')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Key Generation Dialog */}
      <Dialog
        open={showKeyForm}
        onClose={() => {
          setShowKeyForm(false);
          resetKeyForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleGenerateKey}>
          <DialogTitle>SSH-Schlüssel generieren</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Schlüsselname"
                  value={keyFormData.keyName}
                  onChange={(e) => setKeyFormData({ ...keyFormData, keyName: e.target.value })}
                  required
                  helperText="Nur Buchstaben, Zahlen, Bindestriche und Unterstriche"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Schlüsseltyp</InputLabel>
                  <Select
                    value={keyFormData.keyType}
                    onChange={(e) => setKeyFormData({ ...keyFormData, keyType: e.target.value })}
                    label="Schlüsseltyp"
                  >
                    <MenuItem value="rsa">RSA</MenuItem>
                    <MenuItem value="ed25519">Ed25519</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Schlüsselgröße</InputLabel>
                  <Select
                    value={keyFormData.keySize}
                    onChange={(e) => setKeyFormData({ ...keyFormData, keySize: parseInt(e.target.value) })}
                    label="Schlüsselgröße"
                    disabled={keyFormData.keyType === 'ed25519'}
                  >
                    <MenuItem value={2048}>2048 Bit</MenuItem>
                    <MenuItem value={4096}>4096 Bit</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Kommentar (optional)"
                  value={keyFormData.comment}
                  onChange={(e) => setKeyFormData({ ...keyFormData, comment: e.target.value })}
                  helperText="Zusätzliche Informationen zum Schlüssel"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowKeyForm(false);
              resetKeyForm();
            }}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Generieren'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default SSHTab;
