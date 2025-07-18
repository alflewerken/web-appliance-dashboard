import React, { useState, useEffect } from 'react';
import SwipeableViews from 'react-swipeable-views';
import './UserManagement.light.css';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Tooltip,
  Grid,
  Divider,
  CircularProgress,
  Avatar,
  Tabs,
  Tab,
  Snackbar,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Close as CloseIcon,
  Shield as ShieldIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import API_BASE_URL from '../config';

// Tab Panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const UserManagement = ({ onClose }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Benutzer',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    console.log('UserManagement component mounted');
    console.log('Current user:', user);
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      setDebugInfo('Lade Benutzer...');
      
      console.log('Fetching users...');
      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);
      console.log('API URL:', `${API_BASE_URL}/api/auth/users`);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (response.status === 401) {
        setError('Sitzung abgelaufen. Bitte neu anmelden.');
        setDebugInfo('401 Unauthorized - Token ungültig');
        // Optional: Redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      if (response.status === 403) {
        setError('Keine Berechtigung. Nur Administratoren können alle Benutzer sehen.');
        setDebugInfo('403 Forbidden - Keine Admin-Rechte');
        return;
      }
      
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log('Parsed users data:', data);
          console.log('Number of users:', data.length);
          setUsers(data);
          setDebugInfo(`${data.length} Benutzer geladen`);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          setError('Fehler beim Verarbeiten der Daten');
          setDebugInfo('JSON Parse Error: ' + parseError.message);
        }
      } else {
        setError(`Fehler beim Laden der Benutzer: ${response.status}`);
        setDebugInfo(`HTTP ${response.status}: ${responseText}`);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Netzwerkfehler beim Laden der Benutzer');
      setDebugInfo('Network Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    // Verwende statische Rollen mit Permissions
    setRoles([
      {
        value: 'Administrator',
        label: 'Administrator',
        role: 'Administrator',
        permissions: [
          'Alle Berechtigungen',
          'Systemverwaltung',
          'Benutzerverwaltung',
          'Rollenverwaltung',
        ],
      },
      {
        value: 'Power User',
        label: 'Power User',
        role: 'Power User',
        permissions: [
          'Appliances erstellen/bearbeiten',
          'Erweiterte Kontrolle',
          'Benutzer anzeigen',
        ],
      },
      {
        value: 'Benutzer',
        label: 'Benutzer',
        role: 'Benutzer',
        permissions: ['Appliances anzeigen', 'Appliances steuern'],
      },
      {
        value: 'Gast',
        label: 'Gast',
        role: 'Gast',
        permissions: ['Nur Ansicht'],
      },
    ]);
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess('Benutzer erfolgreich erstellt');
        setOpenDialog(false);
        fetchUsers();
        setFormData({
          username: '',
          email: '',
          password: '',
          role: 'Benutzer',
        });
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Erstellen des Benutzers');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Fehler beim Erstellen des Benutzers');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/users/${userId}/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (response.ok) {
        setSuccess('Rolle erfolgreich aktualisiert');
        fetchUsers();
      } else {
        setError('Fehler beim Aktualisieren der Rolle');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      setError('Fehler beim Aktualisieren der Rolle');
    }
  };

  const handleEdit = user => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '', // Passwort leer lassen
      role: user.role,
    });
    setEditDialog(true);
  };

  const handleUpdateUser = async () => {
    try {
      const updateData = {
        username: formData.username,
        email: formData.email,
        role: formData.role,
      };

      // Nur Passwort hinzufügen, wenn es geändert wurde
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/auth/users/${selectedUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(updateData),
        }
      );

      if (response.ok) {
        setSuccess('Benutzer erfolgreich aktualisiert');
        setEditDialog(false);
        fetchUsers();
        setFormData({
          username: '',
          email: '',
          password: '',
          role: 'Benutzer',
        });
        setSelectedUser(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Aktualisieren des Benutzers');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Fehler beim Aktualisieren des Benutzers');
    }
  };

  const handleDelete = async userId => {
    if (!window.confirm('Möchten Sie diesen Benutzer wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setSuccess('Benutzer erfolgreich gelöscht');
        fetchUsers();
      } else {
        setError('Fehler beim Löschen des Benutzers');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Fehler beim Löschen des Benutzers');
    }
  };

  const getRoleColor = role => {
    switch (role) {
      case 'Administrator':
        return 'error';
      case 'Power User':
        return 'warning';
      case 'Benutzer':
        return 'primary';
      case 'Gast':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getRoleLabel = role => {
    switch (role) {
      case 'Administrator':
        return 'Administrator';
      case 'Power User':
        return 'Power User';
      case 'Benutzer':
        return 'Benutzer';
      case 'Gast':
        return 'Gast';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
        <Typography sx={{ mt: 2, color: 'var(--text-secondary)' }}>
          {debugInfo}
        </Typography>
      </Box>
    );
  }

  // Debug-Ausgabe
  console.log('Rendering UserManagement, users count:', users.length);

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: 2,
        minHeight: '100%',
        position: 'relative',
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography
          variant="h4"
          sx={{
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          Benutzer- und Rollenverwaltung
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchUsers}
            sx={{
              borderColor: 'var(--text-secondary)',
              color: 'var(--text-secondary)',
              '&:hover': {
                borderColor: 'var(--text-primary)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Aktualisieren
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{
              backgroundColor: '#2196f3',
              '&:hover': {
                backgroundColor: '#1976d2',
              },
            }}
          >
            Neuer Benutzer
          </Button>
          <IconButton
            onClick={onClose}
            sx={{
              color: 'var(--text-secondary)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Debug-Info für Entwicklung */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Angemeldet als: <strong>{user?.username}</strong> ({user?.role})
        </Typography>
        <Typography variant="body2">
          API Endpoint: {API_BASE_URL}/api/auth/users
        </Typography>
        <Typography variant="body2">
          Gefundene Benutzer: <strong>{users.length}</strong>
        </Typography>
        {debugInfo && (
          <Typography variant="body2">
            Debug: {debugInfo}
          </Typography>
        )}
      </Alert>

      <Paper
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          sx={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            '& .MuiTab-root': {
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            },
            '& .Mui-selected': {
              color: 'var(--text-primary)',
            },
          }}
        >
          <Tab label="Benutzer" />
          <Tab label="Rollen & Berechtigungen" />
          <Tab label="Statistiken" />
        </Tabs>

        <SwipeableViews
          index={tabValue}
          onChangeIndex={setTabValue}
          style={{ height: 'calc(100% - 48px)' }}
        >
          {/* Users Tab */}
          <Box sx={{ p: 3 }}>
            {users.length === 0 ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                Keine Benutzer gefunden. Bitte überprüfen Sie Ihre Berechtigungen oder laden Sie die Seite neu.
              </Alert>
            ) : (
              <Box>
              {users.map(userItem => (
                <Card key={userItem.id} sx={{ 
                  mb: 2, 
                  backgroundColor: 'rgba(0, 0, 0, 0.4)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  // Light mode specific styles - much darker containers
                  '.light-mode &': {
                    backgroundColor: 'rgba(0, 0, 0, 0.25)', // Much darker
                    border: '1px solid rgba(0, 0, 0, 0.3)', // Darker border
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', // Stronger shadow
                  }
                }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center" flex={1}>
                        <Avatar sx={{ 
                          mr: 2, 
                          backgroundColor: '#2196f3', 
                          color: '#fff', 
                          flexShrink: 0,
                          '.light-mode &': {
                            backgroundColor: '#1976d2',
                            color: '#ffffff',
                          }
                        }}>
                          {userItem.username[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="h6" sx={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {userItem.username} {userItem.username === user?.username && '(Du)'}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {userItem.email}
                          </Typography>
                          <Box mt={1} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Chip label={getRoleLabel(userItem.role)} color={getRoleColor(userItem.role)} size="small" />
                            <Chip label={userItem.is_active ? 'Aktiv' : 'Inaktiv'} color={userItem.is_active ? 'success' : 'default'} size="small" />
                            {userItem.is_online && (
                              <Chip label="Online" color="info" size="small" />
                            )}
                          </Box>
                          {userItem.last_login && (
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mt: 1 }}>
                              Letzte Anmeldung: {new Date(userItem.last_login).toLocaleString('de-DE')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Tooltip title="Bearbeiten">
                          <IconButton 
                            size="small" 
                            sx={{ color: 'var(--text-secondary)' }}
                            onClick={() => handleEdit(userItem)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen">
                          <IconButton 
                            size="small" 
                            sx={{ color: 'var(--text-secondary)' }}
                            onClick={() => handleDelete(userItem.id)}
                            disabled={userItem.id === 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {/* Roles Tab */}
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {roles.map(role => (
              <Grid item xs={12} md={6} key={role.role}>
                <Card
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <CardContent>
                    <Typography
                      variant="h6"
                      gutterBottom
                      sx={{ color: 'var(--text-primary)' }}
                    >
                      <Chip
                        label={getRoleLabel(role.role)}
                        color={getRoleColor(role.role)}
                        sx={{ mr: 2 }}
                      />
                    </Typography>
                    <Divider
                      sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.1)' }}
                    />
                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      sx={{ color: 'var(--text-secondary)' }}
                    >
                      Berechtigungen:
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      {role.permissions.map((perm, index) => (
                        <Typography
                          key={index}
                          variant="body2"
                          sx={{ color: 'var(--text-secondary)' }}
                        >
                          • {perm}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Statistics Tab */}
        <Box sx={{ p: 3 }}>
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ color: 'var(--text-primary)' }}>
              Statistiken
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'var(--text-secondary)', mt: 2 }}
            >
              Statistiken werden in einer zukünftigen Version verfügbar sein.
            </Typography>
          </Box>
        </Box>
      </SwipeableViews>
    </Paper>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            backdropFilter: 'blur(20px)',
            backgroundImage: 'none',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
        sx={{
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'var(--text-primary)' }}>
          Neuen Benutzer erstellen
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Benutzername"
            value={formData.username}
            onChange={e =>
              setFormData({ ...formData, username: e.target.value })
            }
            margin="normal"
            sx={{
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiInputBase-root': { color: 'var(--text-primary)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              },
            }}
          />
          <TextField
            fullWidth
            label="E-Mail"
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            sx={{
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiInputBase-root': { color: 'var(--text-primary)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              },
            }}
          />
          <TextField
            fullWidth
            label="Passwort"
            type="password"
            value={formData.password}
            onChange={e =>
              setFormData({ ...formData, password: e.target.value })
            }
            margin="normal"
            sx={{
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiInputBase-root': { color: 'var(--text-primary)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              },
            }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: 'var(--text-secondary)' }}>
              Rolle
            </InputLabel>
            <Select
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              label="Rolle"
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: 'var(--text-primary)',
                    '& .MuiMenuItem-root': {
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    },
                  },
                },
              }}
              sx={{
                color: 'var(--text-primary)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '& .MuiSvgIcon-root': { color: 'var(--text-secondary)' },
              }}
            >
              <MenuItem value="Administrator">Administrator</MenuItem>
              <MenuItem value="Power User">Power User</MenuItem>
              <MenuItem value="Benutzer">Benutzer</MenuItem>
              <MenuItem value="Gast">Gast</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button
            onClick={() => setOpenDialog(false)}
            sx={{ color: 'var(--text-secondary)' }}
          >
            Abbrechen
          </Button>
          <Button onClick={handleCreateUser} variant="contained">
            Erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            backdropFilter: 'blur(20px)',
            backgroundImage: 'none',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
        sx={{
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'var(--text-primary)' }}>
          Benutzer bearbeiten
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Benutzername"
            value={formData.username}
            onChange={e =>
              setFormData({ ...formData, username: e.target.value })
            }
            margin="normal"
            sx={{
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiInputBase-root': { color: 'var(--text-primary)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              },
            }}
          />
          <TextField
            fullWidth
            label="E-Mail"
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            sx={{
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiInputBase-root': { color: 'var(--text-primary)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              },
            }}
          />
          <TextField
            fullWidth
            label="Neues Passwort (leer lassen für keine Änderung)"
            type="password"
            value={formData.password}
            onChange={e =>
              setFormData({ ...formData, password: e.target.value })
            }
            margin="normal"
            sx={{
              '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
              '& .MuiInputBase-root': { color: 'var(--text-primary)' },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              },
            }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: 'var(--text-secondary)' }}>
              Rolle
            </InputLabel>
            <Select
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              label="Rolle"
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: 'var(--text-primary)',
                    '& .MuiMenuItem-root': {
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    },
                  },
                },
              }}
              sx={{
                color: 'var(--text-primary)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '& .MuiSvgIcon-root': { color: 'var(--text-secondary)' },
              }}
            >
              <MenuItem value="Administrator">Administrator</MenuItem>
              <MenuItem value="Power User">Power User</MenuItem>
              <MenuItem value="Benutzer">Benutzer</MenuItem>
              <MenuItem value="Gast">Gast</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Button
            onClick={() => setEditDialog(false)}
            sx={{ color: 'var(--text-secondary)' }}
          >
            Abbrechen
          </Button>
          <Button onClick={handleUpdateUser} variant="contained">
            Aktualisieren
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccess('')}
          severity="success"
          sx={{ width: '100%', backgroundColor: 'rgba(46, 125, 50, 0.9)' }}
        >
          {success}
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setError('')}
          severity="error"
          sx={{ width: '100%', backgroundColor: 'rgba(211, 47, 47, 0.9)' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
