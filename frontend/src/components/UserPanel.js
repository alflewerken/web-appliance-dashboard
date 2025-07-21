import React, { useState, useEffect, useCallback, useRef } from 'react';
import SwipeableViews from 'react-swipeable-views';
import UnifiedPanelHeader from './UnifiedPanelHeader';
import {
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Chip,
  Avatar,
  Tabs,
  Tab,
  CircularProgress,
  Snackbar,
  Grid,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  GripVertical,
  UserPlus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSSE } from '../hooks/useSSE';
import API_BASE_URL from '../config';
import './unified/UserPanelPatch.css';
import './unified/UserPanelMobileFix.css';
import './unified/UserPanelEmergencyFix.css';
import './unified/UserPanelScrollFix.css';
import './unified/UserPanelGlowButtons.css';

const UserPanel = ({ onClose, onWidthChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, isAdmin } = useAuth();
  const { addEventListener } = useSSE();
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
  
  const fetchUsersTimeoutRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('userPanelWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  // SSE Event Listeners
  useEffect(() => {
    if (!addEventListener) return;

    const userEvents = [
      'user_created', 'user_updated', 'user_deleted',
      'user_activated', 'user_deactivated', 'user_status_changed',
      'user_restore', 'user_restored', 'user_reverted',
      'user_login', 'user_logout', 'login', 'logout',
    ];

    const unsubscribers = userEvents.map(eventType =>
      addEventListener(eventType, data => {
        console.log(`[UserPanel] Received SSE event: ${eventType}`, data);
        debouncedFetchUsers();
      })
    );

    return () => {
      if (fetchUsersTimeoutRef.current) {
        clearTimeout(fetchUsersTimeoutRef.current);
      }
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, [addEventListener]);

  // Panel width notification
  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(panelWidth);
    }
  }, []);

  // Handle resize
  const handleMouseDown = useCallback(e => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = e => {
      if (!isResizing) return;
      const diff = startX.current - e.clientX;
      const newWidth = Math.min(
        Math.max(startWidth.current + diff, 400),
        window.innerWidth - 100
      );
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('userPanelWidth', panelWidth.toString());
        if (onWidthChange) {
          onWidthChange(panelWidth);
        }
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelWidth, onWidthChange]);

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!isAdmin()) {
        setUsers([{
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          is_active: 1,
          last_login: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        if (response.status === 403) {
          setUsers([{
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            is_active: 1,
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString()
          }]);
        } else {
          const errorData = await response.text();
          setError(`Fehler beim Laden der Benutzer: ${response.status} - ${errorData}`);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Fehler beim Laden der Benutzer: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  const debouncedFetchUsers = useCallback(() => {
    if (fetchUsersTimeoutRef.current) {
      clearTimeout(fetchUsersTimeoutRef.current);
    }
    fetchUsersTimeoutRef.current = setTimeout(() => {
      fetchUsers();
    }, 300);
  }, [fetchUsers]);

  const fetchRoles = async () => {
    setRoles([
      {
        value: 'Administrator',
        label: 'Administrator',
        role: 'Administrator',
        permissions: ['Alle Berechtigungen', 'Systemverwaltung', 'Benutzerverwaltung', 'Rollenverwaltung'],
      },
      {
        value: 'Power User',
        label: 'Power User',
        role: 'Power User',
        permissions: ['Appliances erstellen/bearbeiten', 'Erweiterte Kontrolle', 'Benutzer anzeigen'],
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
        setFormData({ username: '', email: '', password: '', role: 'Benutzer' });
      } else {
        const data = await response.json();
        setError(data.message || 'Fehler beim Erstellen des Benutzers');
      }
    } catch (error) {
      setError('Fehler beim Erstellen des Benutzers');
    }
  };

  const handleUpdateUser = async () => {
    try {
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
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
      } else {
        const data = await response.json();
        setError(data.message || 'Fehler beim Aktualisieren des Benutzers');
      }
    } catch (error) {
      setError('Fehler beim Aktualisieren des Benutzers');
    }
  };

  const handleDeleteUser = async userId => {
    if (window.confirm('Möchten Sie diesen Benutzer wirklich löschen?')) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/users/${userId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (response.ok) {
          setSuccess('Benutzer erfolgreich gelöscht');
          fetchUsers();
        } else {
          setError('Fehler beim Löschen des Benutzers');
        }
      } catch (error) {
        setError('Fehler beim Löschen des Benutzers');
      }
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/users/${userId}/toggle-active`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || `Benutzer ${currentStatus ? 'deaktiviert' : 'aktiviert'}`);
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Ändern des Benutzerstatus');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError('Fehler beim Ändern des Benutzerstatus');
    }
  };

  const getRoleColor = role => {
    switch (role) {
      case 'Administrator': return '#FF3B30';
      case 'Power User': return '#FF9500';
      case 'Benutzer': return '#007AFF';
      case 'Gast': return '#8E8E93';
      default: return '#007AFF';
    }
  };

  const getRoleLabel = role => {
    switch (role) {
      case 'Administrator': return 'Administrator';
      case 'Power User': return 'Power User';
      case 'Benutzer': return 'Benutzer';
      case 'Gast': return 'Gast';
      default: return role;
    }
  };

  const isUserOnline = user => {
    if (user.is_online !== undefined) {
      return user.is_online === 1;
    }
    const lastActivity = user.last_activity || user.lastActivity;
    if (!lastActivity) return false;
    const lastActivityTime = new Date(lastActivity).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return now - lastActivityTime < fiveMinutes;
  };

  const isCompactMode = isMobile || panelWidth < 800;

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSwipeChange = (index) => {
    setTabValue(index);
  };

  const renderUserTable = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#007AFF' }} />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography sx={{ color: '#ff3b30', mb: 2 }}>{error}</Typography>
          <Button
            variant="contained"
            onClick={() => {
              setError('');
              setLoading(true);
              fetchUsers();
            }}
            sx={{
              backgroundColor: '#007AFF',
              '&:hover': { backgroundColor: '#0051D5' },
            }}
          >
            Erneut versuchen
          </Button>
        </Box>
      );
    }

    if (users.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
            Keine Benutzer gefunden
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setLoading(true);
              fetchUsers();
            }}
            sx={{
              borderColor: '#007AFF',
              color: '#007AFF',
              '&:hover': {
                borderColor: '#0051D5',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
              },
            }}
          >
            Aktualisieren
          </Button>
        </Box>
      );
    }

    if (isCompactMode) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', px: { xs: 1, sm: 0 } }}>
          {users.map(u => (
            <Paper
              key={u.id}
              sx={{
                p: 2,
                backgroundColor: 'var(--container-bg)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--container-border)',
                borderRadius: '12px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ position: 'relative', mr: 2 }}>
                  <Avatar sx={{ width: 40, height: 40, bgcolor: '#007AFF' }}>
                    {u.username.charAt(0).toUpperCase()}
                  </Avatar>
                  {(isUserOnline(u) || u.username === user.username) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: '#34C759',
                        border: '2px solid rgba(0, 0, 0, 0.95)',
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                      {u.username}
                    </Typography>
                    {u.username === user.username && (
                      <Chip
                        label="Du"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(0, 122, 255, 0.2)',
                          color: '#007AFF',
                        }}
                      />
                    )}
                  </Box>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                    {u.email}
                  </Typography>
                  {(isUserOnline(u) || u.username === user.username) && (
                    <Typography sx={{ color: '#34C759', fontSize: '0.75rem', mt: 0.5 }}>
                      Online
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={getRoleLabel(u.role)}
                  size="small"
                  sx={{
                    backgroundColor: `${getRoleColor(u.role)}20`,
                    color: getRoleColor(u.role),
                    border: `1px solid ${getRoleColor(u.role)}`,
                  }}
                />
                <Chip
                  label={u.is_active ? 'Account aktiv' : 'Account gesperrt'}
                  size="small"
                  sx={{
                    backgroundColor: u.is_active ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                    color: u.is_active ? '#34C759' : '#FF3B30',
                    border: `1px solid ${u.is_active ? '#34C759' : '#FF3B30'}`,
                  }}
                />
              </Box>

              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', mb: 1 }}>
                Letzte Anmeldung: {u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : 'Nie'}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Tooltip title="Bearbeiten">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedUser(u);
                      setFormData({
                        username: u.username,
                        email: u.email,
                        password: '',
                        role: u.role,
                      });
                      setEditDialog(true);
                    }}
                    sx={{ 
                      color: '#34C759',
                      backgroundColor: 'rgba(52, 199, 89, 0.1)',
                      border: '1px solid rgba(52, 199, 89, 0.2)',
                      '&:hover': {
                        backgroundColor: 'rgba(52, 199, 89, 0.2)',
                        borderColor: 'rgba(52, 199, 89, 0.4)',
                      },
                    }}
                    disabled={!isAdmin() && u.id !== user.id}
                  >
                    <Edit size={16} />
                  </IconButton>
                </Tooltip>
                {isAdmin() && (
                  <>
                    <Tooltip title={u.is_active ? 'Deaktivieren' : 'Aktivieren'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleActive(u.id, Boolean(u.is_active))}
                        sx={{ 
                          color: '#FF9500',
                          backgroundColor: 'rgba(255, 149, 0, 0.1)',
                          border: '1px solid rgba(255, 149, 0, 0.2)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 149, 0, 0.2)',
                            borderColor: 'rgba(255, 149, 0, 0.4)',
                          }
                        }}
                      >
                        {u.is_active ? <Lock size={16} /> : <Unlock size={16} />}
                      </IconButton>
                    </Tooltip>
                    {u.username !== user.username && (
                      <Tooltip title="Löschen">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUser(u.id)}
                          sx={{ 
                            color: '#FF3B30',
                            backgroundColor: 'rgba(255, 59, 48, 0.1)',
                            border: '1px solid rgba(255, 59, 48, 0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 59, 48, 0.2)',
                              borderColor: 'rgba(255, 59, 48, 0.4)',
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      );
    }

    // Normal table view
    return (
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: 'var(--container-bg)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--container-border)',
          borderRadius: '12px',
        }}
      >
        <Table sx={{ minWidth: isCompactMode ? 500 : 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Benutzer</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>E-Mail</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Rolle</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Account-Status</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Letzte Anmeldung</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: '#007AFF', flexShrink: 0 }}>
                        {u.username.charAt(0).toUpperCase()}
                      </Avatar>
                      {(isUserOnline(u) || u.username === user.username) && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: '#34C759',
                            border: '2px solid rgba(0, 0, 0, 0.95)',
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ color: '#fff' }}>
                        {u.username}
                        {u.username === user.username && (
                          <Chip
                            label="Du"
                            size="small"
                            sx={{
                              ml: 1,
                              height: 16,
                              fontSize: '0.7rem',
                              backgroundColor: 'rgba(0, 122, 255, 0.2)',
                              color: '#007AFF',
                            }}
                          />
                        )}
                      </Typography>
                      {(isUserOnline(u) || u.username === user.username) && (
                        <Typography sx={{ color: '#34C759', fontSize: '0.75rem' }}>
                          Online
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  <Tooltip title={u.email}>
                    <span>{u.email}</span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip
                    label={getRoleLabel(u.role)}
                    size="small"
                    sx={{
                      backgroundColor: `${getRoleColor(u.role)}20`,
                      color: getRoleColor(u.role),
                      border: `1px solid ${getRoleColor(u.role)}`,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.is_active ? 'Account aktiv' : 'Account gesperrt'}
                    size="small"
                    sx={{
                      backgroundColor: u.is_active ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                      color: u.is_active ? '#34C759' : '#FF3B30',
                      border: `1px solid ${u.is_active ? '#34C759' : '#FF3B30'}`,
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  <Tooltip title={u.last_login ? new Date(u.last_login).toLocaleString('de-DE') : 'Nie'}>
                    <span>{u.last_login ? new Date(u.last_login).toLocaleDateString('de-DE') : 'Nie'}</span>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ padding: '8px' }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Bearbeiten">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedUser(u);
                          setFormData({ username: u.username, email: u.email, password: '', role: u.role });
                          setEditDialog(true);
                        }}
                        sx={{ 
                          color: '#34C759',
                          backgroundColor: 'rgba(52, 199, 89, 0.1)',
                          border: '1px solid rgba(52, 199, 89, 0.2)',
                          '&:hover': {
                            backgroundColor: 'rgba(52, 199, 89, 0.2)',
                            borderColor: 'rgba(52, 199, 89, 0.4)',
                          }
                        }}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={u.is_active ? 'Account sperren' : 'Account aktivieren'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleActive(u.id, Boolean(u.is_active))}
                        sx={{ 
                          color: '#FF9500',
                          backgroundColor: 'rgba(255, 149, 0, 0.1)',
                          border: '1px solid rgba(255, 149, 0, 0.2)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 149, 0, 0.2)',
                            borderColor: 'rgba(255, 149, 0, 0.4)',
                          }
                        }}
                      >
                        {u.is_active ? <Lock size={16} /> : <Unlock size={16} />}
                      </IconButton>
                    </Tooltip>
                    {u.username !== user.username && (
                      <Tooltip title="Löschen">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUser(u.id)}
                          sx={{ 
                            color: '#FF3B30',
                            backgroundColor: 'rgba(255, 59, 48, 0.1)',
                            border: '1px solid rgba(255, 59, 48, 0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 59, 48, 0.2)',
                              borderColor: 'rgba(255, 59, 48, 0.4)',
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        width: { xs: '100vw', sm: `${panelWidth}px` },
        height: '100%',
        backgroundColor: 'rgba(118, 118, 128, 0.12)',
        backdropFilter: 'blur(30px) saturate(150%)',
        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
        borderLeft: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.08)' },
        display: 'flex',
        flexDirection: 'column',
        transition: isResizing ? 'none' : 'transform 0.3s ease',
        color: '#fff',
        overflow: 'hidden',
        boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '4px',
          height: '100%',
          cursor: 'col-resize',
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
          '&:active': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        }}
      >
        <GripVertical
          size={16}
          style={{
            color: 'rgba(255, 255, 255, 0.3)',
            marginLeft: '-8px',
          }}
        />
      </Box>

      {/* Header */}
      <UnifiedPanelHeader 
        title="Benutzerverwaltung" 
        icon={Users} 
        onClose={onClose} 
      />

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'transparent' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.7)',
              '&.Mui-selected': {
                color: '#fff',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#007AFF',
            },
          }}
        >
          <Tab label="Benutzer" />
          <Tab label="Rollen & Berechtigungen" />
          <Tab label="Statistiken" />
        </Tabs>
      </Box>

      {/* Swipeable Content */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <SwipeableViews
          index={tabValue}
          onChangeIndex={handleSwipeChange}
          enableMouseEvents
          resistance
          style={{ height: '100%' }}
          containerStyle={{ height: '100%' }}
          slideStyle={{ height: '100%', overflow: 'hidden' }}
        >
          {/* Users Tab */}
          <Box sx={{ p: { xs: 1, sm: 2 }, height: '100%', overflow: 'auto' }}>
            <Box sx={{ mb: 2, px: { xs: 1, sm: 0 } }}>
              {isAdmin() && (
                <Button
                  variant="contained"
                  startIcon={<UserPlus size={16} />}
                  onClick={() => setOpenDialog(true)}
                  sx={{
                    backgroundColor: '#007AFF',
                    '&:hover': {
                      backgroundColor: '#0051D5',
                    },
                  }}
                >
                  Benutzer hinzufügen
                </Button>
              )}
              {!isAdmin() && (
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Nur Administratoren können alle Benutzer sehen.
                </Typography>
              )}
            </Box>
            {renderUserTable()}
          </Box>

          {/* Roles Tab */}
          <Box sx={{ p: { xs: 1, sm: 2 }, height: '100%', overflow: 'auto' }}>
            <Grid container spacing={2}>
              {roles.map(role => (
                <Grid item xs={12} md={6} key={role.role}>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: 'var(--container-bg)',
                      border: '1px solid var(--container-border)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Chip
                        label={getRoleLabel(role.role)}
                        size="small"
                        sx={{
                          backgroundColor: `${getRoleColor(role.role)}20`,
                          color: getRoleColor(role.role),
                          border: `1px solid ${getRoleColor(role.role)}`,
                        }}
                      />
                    </Box>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Berechtigungen:
                    </Typography>
                    <Box sx={{ pl: 1 }}>
                      {role.permissions.map((perm, index) => (
                        <Typography key={index} variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}>
                          • {perm}
                        </Typography>
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Statistics Tab */}
          <Box sx={{ p: { xs: 1, sm: 2 }, height: '100%', overflow: 'auto' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    backgroundColor: 'var(--container-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--container-border)',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h3" sx={{ color: '#007AFF', fontWeight: 'bold' }}>
                    {users.length}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Gesamte Benutzer
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    backgroundColor: 'var(--container-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--container-border)',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h3" sx={{ color: '#34C759', fontWeight: 'bold' }}>
                    {users.filter(u => Boolean(u.is_active)).length}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Aktive Benutzer
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    backgroundColor: 'var(--container-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--container-border)',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="h3" sx={{ color: '#FF3B30', fontWeight: 'bold' }}>
                    {users.filter(u => u.role === 'Administrator').length}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Administratoren
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 3,
                    backgroundColor: 'var(--container-bg)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--container-border)',
                    borderRadius: '12px',
                  }}
                >
                  <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                    Rollenverteilung
                  </Typography>
                  {roles.map(role => {
                    const count = users.filter(u => u.role === role.role).length;
                    const percentage = users.length > 0 ? ((count / users.length) * 100).toFixed(1) : 0;
                    return (
                      <Box key={role.role} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {role.label}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {count} ({percentage}%)
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: '100%',
                            height: 8,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: getRoleColor(role.role),
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </SwipeableViews>
      </Box>

      {/* Create User Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--container-border)',
            borderRadius: '12px',
            color: '#fff',
          },
        }}
      >
        <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Benutzername"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                sx={{
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#007AFF' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                sx={{
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#007AFF' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Passwort"
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                sx={{
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#007AFF' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Rolle</InputLabel>
                <Select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  label="Rolle"
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#007AFF' },
                  }}
                >
                  {roles.map(role => (
                    <MenuItem key={role.role} value={role.role}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Abbrechen
          </Button>
          <Button onClick={handleCreateUser} variant="contained" sx={{ backgroundColor: '#007AFF' }}>
            Erstellen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--container-border)',
            borderRadius: '12px',
            color: '#fff',
          },
        }}
      >
        <DialogTitle>Benutzer bearbeiten</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Benutzername"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                sx={{
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#007AFF' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                sx={{
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#007AFF' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Neues Passwort (optional)"
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                helperText="Leer lassen, um das Passwort nicht zu ändern"
                sx={{
                  '& .MuiInputBase-root': { color: '#fff' },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255, 255, 255, 0.5)' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#007AFF' },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Rolle</InputLabel>
                <Select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  label="Rolle"
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#007AFF' },
                  }}
                >
                  {roles.map(role => (
                    <MenuItem key={role.role} value={role.role}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Abbrechen
          </Button>
          <Button onClick={handleUpdateUser} variant="contained" sx={{ backgroundColor: '#007AFF' }}>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserPanel;