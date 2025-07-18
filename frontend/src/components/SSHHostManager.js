import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Paper,
  Grid,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  X,
} from 'lucide-react';
import axios from '../utils/axiosConfig';
import { useSSE } from '../hooks/useSSE';
import SSHHostCard from './SSHHostCard';
import './SSHHostManager.css';

const SSHHostManager = ({ onTerminalOpen, embedded }) => {
  const [hosts, setHosts] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [sshKeys, setSSHKeys] = useState([]);

  const [formData, setFormData] = useState({
    hostname: '',
    host: '',
    username: '',
    port: 22,
    key_name: 'dashboard',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setupProgress, setSetupProgress] = useState({});

  const { addEventListener, isConnected } = useSSE();

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

  const fetchHosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/ssh/hosts/all?includeDeleted=${showDeleted}`
      );
      setHosts(response.data.hosts || []);
    } catch (error) {
      console.error('Error fetching SSH hosts:', error);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  const fetchSSHKeys = useCallback(async () => {
    try {
      const response = await axios.get('/api/ssh/keys');
      setSSHKeys(response.data.keys || []);
    } catch (error) {
      console.error('Error fetching SSH keys:', error);
      setError('Fehler beim Laden der SSH-Schlüssel');
    }
  }, []);

  useEffect(() => {
    fetchHosts();
    fetchSSHKeys();

    if (addEventListener) {
      const unsubscribers = [
        addEventListener('ssh_host_created', fetchHosts),
        addEventListener('ssh_host_updated', fetchHosts),
        addEventListener('ssh_host_deleted', fetchHosts),
        addEventListener('ssh_host_restored', fetchHosts),
        addEventListener('ssh_host_reverted', fetchHosts),
        addEventListener('ssh_host_status_changed', fetchHosts),
        addEventListener('ssh_test_completed', fetchHosts),
        addEventListener('ssh_key_created', fetchSSHKeys),
        addEventListener('ssh_key_deleted', fetchSSHKeys),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, fetchHosts, fetchSSHKeys]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingHost) {
        // For editing, check if password is provided to update SSH key
        if (formData.password) {
          // Setup SSH with the new password
          setSetupProgress({ [formData.hostname]: 'Richte SSH-Verbindung ein...' });
          
          try {
            const setupResponse = await axios.post('/api/ssh/setup', {
              hostname: formData.hostname,
              host: formData.host,
              username: formData.username,
              password: formData.password,
              port: formData.port,
              keyName: formData.key_name,
            });

            if (setupResponse.data.success) {
              setSetupProgress({ [formData.hostname]: 'SSH-Schlüssel erfolgreich aktualisiert!' });
              setSuccess('SSH-Schlüssel erfolgreich auf dem Server aktualisiert');
            }
          } catch (setupError) {
            console.error('Setup error:', setupError);
            setError(`Setup-Fehler: ${setupError.response?.data?.error || 'Unbekannter Fehler'}`);
            setLoading(false);
            setTimeout(() => setSetupProgress({}), 3000);
            return;
          }
        }
        
        // Update the host information
        await axios.put(`/api/ssh/hosts/${editingHost.id}`, {
          ...formData,
          password: undefined, // Don't save password
        });
        setSuccess('SSH-Host erfolgreich aktualisiert');
      } else {
        // For new hosts, check if we need to setup SSH
        if (formData.password) {
          // Setup SSH with password
          setSetupProgress({ [formData.hostname]: 'Richte SSH-Verbindung ein...' });
          
          try {
            const setupResponse = await axios.post('/api/ssh/setup', {
              hostname: formData.hostname,
              host: formData.host,
              username: formData.username,
              password: formData.password,
              port: formData.port,
              keyName: formData.key_name,
            });

            if (setupResponse.data.success) {
              setSetupProgress({ [formData.hostname]: 'SSH-Schlüssel erfolgreich eingerichtet!' });
              setSuccess('SSH-Host erfolgreich eingerichtet und gespeichert');
            }
          } catch (setupError) {
            console.error('Setup error:', setupError);
            
            if (setupError.response?.status === 409) {
              setError(setupError.response.data.error || 'Ein SSH-Host mit diesen Daten existiert bereits');
            } else if (setupError.response?.data?.error) {
              setError(`Setup-Fehler: ${setupError.response.data.error}`);
            } else {
              setError('Fehler beim Einrichten der SSH-Verbindung');
            }
            setLoading(false);
            setTimeout(() => setSetupProgress({}), 3000);
            return;
          }
        } else {
          // Just save the host without setup
          await axios.post('/api/ssh/hosts', formData);
          setSuccess('SSH-Host erfolgreich gespeichert');
        }
      }

      setShowAddForm(false);
      setEditingHost(null);
      resetForm();
      fetchHosts();
    } catch (error) {
      console.error('Error saving SSH host:', error);
      
      if (error.response?.status === 409) {
        setError('Ein SSH-Host mit diesem Namen oder diesen Verbindungsdaten existiert bereits');
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern des SSH-Hosts');
      }
    } finally {
      setLoading(false);
      setTimeout(() => setSetupProgress({}), 3000);
    }
  };

  const handleDelete = async (hostId) => {
    if (!window.confirm('Möchten Sie diesen SSH-Host wirklich löschen?')) return;

    try {
      await axios.delete(`/api/ssh/hosts/${hostId}`);
      fetchHosts();
    } catch (error) {
      console.error('Error deleting SSH host:', error);
      alert('Fehler beim Löschen des SSH-Hosts');
    }
  };

  const handleRestore = async (hostId) => {
    try {
      await axios.post(`/api/ssh/hosts/${hostId}/restore`);
      fetchHosts();
    } catch (error) {
      console.error('Error restoring SSH host:', error);
      alert('Fehler beim Wiederherstellen des SSH-Hosts');
    }
  };

  const handleEdit = (host) => {
    setEditingHost(host);
    setFormData({
      hostname: host.hostname,
      host: host.host,
      username: host.username,
      port: host.port,
      key_name: host.key_name,
      password: '', // Don't populate password for security
    });
    if (sshKeys.length === 0) {
      fetchSSHKeys();
    }
    setShowAddForm(true);
  };

  const handleTest = async (host) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/ssh/test', {
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        keyName: host.key_name,
      }, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.data.success) {
        alert('Verbindungstest erfolgreich!');
        return response.data; // Return success
      } else {
        alert(`Verbindungstest fehlgeschlagen: ${response.data.error}`);
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Fehler beim Testen der Verbindung');
      throw error; // Re-throw error for the card component
    }
  };

  const resetForm = () => {
    setFormData({
      hostname: '',
      host: '',
      username: '',
      port: 22,
      key_name: 'dashboard',
      password: '',
    });
    setError('');
    setSuccess('');
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: embedded ? 'transparent' : '#0f1419',
      borderRadius: embedded ? 0 : '12px',
      p: embedded ? 0 : 2,
    }}>
      {/* Error and Success Messages */}
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError('')}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert 
          severity="success" 
          onClose={() => setSuccess('')}
          sx={{ mb: 2 }}
        >
          {success}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        px: embedded ? 0 : 1,
      }}>
        {!embedded && (
          <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 600 }}>
            SSH-Host Verwaltung
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', gap: 1, ml: embedded ? 'auto' : 0 }}>
          <Button
            variant="outlined"
            onClick={() => setShowDeleted(!showDeleted)}
            startIcon={showDeleted ? <Eye size={16} /> : <EyeOff size={16} />}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#9ca3af',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            {showDeleted ? 'Nur aktive' : 'Auch gelöschte'}
          </Button>
          
          <Button
            variant="contained"
            onClick={() => {
              setEditingHost(null);
              resetForm();
              if (sshKeys.length === 0) {
                fetchSSHKeys();
              }
              setShowAddForm(true);
            }}
            startIcon={<Plus size={16} />}
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': {
                backgroundColor: '#0051D5',
              },
            }}
          >
            Neuer Host
          </Button>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
          },
        },
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : hosts.length === 0 ? (
          <Alert 
            severity="info" 
            sx={{ 
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(0, 123, 255, 0.3)',
            }}
          >
            Keine SSH-Hosts vorhanden. Klicken Sie auf "Neuer Host", um einen hinzuzufügen.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hosts.map(host => (
              <SSHHostCard
                key={host.id}
                host={host}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onConnect={onTerminalOpen}
                onTest={handleTest}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Add/Edit Form Dialog */}
      <Dialog
        open={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setEditingHost(null);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1f2e',
            backgroundImage: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff' }}>
          {editingHost ? 'Host bearbeiten' : 'Neuen Host hinzufügen'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Anzeigename"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Host/IP"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Benutzername"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#9ca3af' }}>SSH-Schlüssel</InputLabel>
                  <Select
                    value={formData.key_name}
                    onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                    label="SSH-Schlüssel"
                    sx={{
                      color: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                      },
                      '& .MuiSvgIcon-root': {
                        color: '#9ca3af',
                      },
                    }}
                  >
                    {sshKeys.length === 0 ? (
                      <MenuItem value="dashboard">
                        dashboard (Standard)
                      </MenuItem>
                    ) : (
                      sshKeys.map((key) => (
                        <MenuItem key={key.key_name} value={key.key_name}>
                          {key.key_name} {key.is_default && '(Standard)'}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Passwort (optional)"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  helperText={editingHost ? 
                    "Wenn angegeben, wird der SSH-Schlüssel auf dem Server aktualisiert" : 
                    "Wenn angegeben, wird der SSH-Schlüssel automatisch auf dem Server eingerichtet"
                  }
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#ffffff',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9ca3af',
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#6b7280',
                    },
                  }}
                />
              </Grid>
            </Grid>
            {setupProgress[formData.hostname] && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {setupProgress[formData.hostname]}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button
              onClick={() => {
                setShowAddForm(false);
                setEditingHost(null);
                resetForm();
              }}
              sx={{ color: '#9ca3af' }}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                backgroundColor: '#007AFF',
                '&:hover': {
                  backgroundColor: '#0051D5',
                },
              }}
            >
              {loading ? <CircularProgress size={24} /> : (editingHost ? 'Aktualisieren' : 'Speichern')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default SSHHostManager;
