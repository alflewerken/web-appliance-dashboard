import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePanelResize, getPanelStyles, getResizeHandleStyles } from '../hooks/usePanelResize';
import UnifiedPanelHeader from './UnifiedPanelHeader';
import { useTranslation } from 'react-i18next';
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
import './UserPanel.css';

const UserPanel = ({ onClose, onWidthChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const { addEventListener } = useSSE();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null); // Store original data for comparison
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'Benutzer',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // EINHEITLICHER RESIZE-HOOK (ersetzt alten Code)
  const { panelWidth, isResizing, startResize, panelRef } = usePanelResize(
    'userPanelWidth',
    600,
    onWidthChange
  );
  
  const fetchUsersTimeoutRef = useRef(null);
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

    const handleUserEvent = (eventType) => (data) => {
      // Nur bei restore/revert Events zur Fehlersuche loggen
      // if (eventType.includes('restore') || eventType.includes('revert')) {
      //   // }
      debouncedFetchUsers();
    };

    const unsubscribers = userEvents.map(eventType =>
      addEventListener(eventType, handleUserEvent(eventType))
    );

    return () => {
      if (fetchUsersTimeoutRef.current) {
        clearTimeout(fetchUsersTimeoutRef.current);
      }
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, [addEventListener, debouncedFetchUsers]);

  const fetchUsers = useCallback(async () => {

    try {
      const token = localStorage.getItem('token');
      
      if (!isAdmin()) {

        setUsers([{
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: true,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }]);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/auth/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();

        setUsers(data);
      } else {
        console.error(`[UserPanel] Failed to fetch users: ${response.status}`);
        if (response.status === 403) {
          setUsers([{
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: true,
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }]);
        } else {
          const errorData = await response.text();
          setError(`${t('users.errors.loadFailed')}: ${response.status} - ${errorData}`);
        }
      }
    } catch (error) {
      console.error('[UserPanel] Error fetching users:', error);
      setError(t('users.errors.loadFailed') + ': ' + error.message);
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
    }, 100); // Reduziert von 300ms auf 100ms für schnellere Updates
  }, [fetchUsers]);

  const fetchRoles = async () => {
    setRoles([
      {
        value: 'Administrator',
        label: t('users.roles.administrator'),
        role: 'Administrator',
        permissions: [
          t('users.permissions.allPermissions'),
          t('users.permissions.systemManagement'),
          t('users.permissions.userManagement'),
          t('users.permissions.roleManagement')
        ],
      },
      {
        value: 'Power User',
        label: t('users.roles.powerUser'),
        role: 'Power User',
        permissions: [
          t('users.permissions.createEditAppliances'),
          t('users.permissions.advancedControl'),
          t('users.permissions.viewUsers')
        ],
      },
      {
        value: 'Benutzer',
        label: t('users.roles.user'),
        role: 'Benutzer',
        permissions: [
          t('users.permissions.viewAppliances'),
          t('users.permissions.controlAppliances')
        ],
      },
      {
        value: 'Gast',
        label: t('users.roles.guest'),
        role: 'Gast',
        permissions: [t('users.permissions.viewOnly')],
      },
    ]);
  };

  // Helper function to get only changed fields
  const getChangedFields = (original, current) => {
    if (!original) return current; // For new users, return all fields
    
    const changes = {};
    
    Object.keys(current).forEach(key => {
      // Skip password field if empty (no password change)
      if (key === 'password' && !current[key]) {
        return;
      }
      
      // Compare values
      let originalValue = original[key];
      let currentValue = current[key];
      
      // Normalize null/undefined to empty string for comparison
      if (originalValue === null || originalValue === undefined) originalValue = '';
      if (currentValue === null || currentValue === undefined) currentValue = '';
      
      // Convert to strings for comparison
      const originalStr = String(originalValue);
      const currentStr = String(currentValue);
      
      // Only include field if it has changed
      if (originalStr !== currentStr) {
        changes[key] = current[key];
      }
    });
    
    return changes;
  };

  const handleCreateUser = async () => {
    try {
      const response = await fetch(`/api/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(t('users.success.userCreated'));
        setOpenDialog(false);
        fetchUsers();
        setFormData({ username: '', email: '', password: '', role: 'Benutzer' });
      } else {
        const data = await response.json();
        setError(data.message || t('users.errors.createFailed'));
      }
    } catch (error) {
      setError(t('users.errors.createFailed'));
    }
  };

  const handleUpdateUser = async () => {
    try {
      // Get only changed fields
      const changedFields = getChangedFields(originalFormData, formData);
      
      // Check if there are any changes
      if (Object.keys(changedFields).length === 0) {
        setSuccess(t('users.success.noChanges'));
        setEditDialog(false);
        return;
      }
      
      // Remove password field if it's empty (no password change)
      if (changedFields.password === '') {
        delete changedFields.password;
      }

      const response = await fetch(
        `/api/auth/users/${selectedUser.id}`,
        {
          method: 'PATCH', // Use PATCH for partial updates
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(changedFields),
        }
      );

      if (response.ok) {
        setSuccess(t('users.success.userUpdated'));
        setEditDialog(false);
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.message || t('users.errors.updateFailed'));
      }
    } catch (error) {
      setError(t('users.errors.updateFailed'));
    }
  };

  const handleDeleteUser = async userId => {
    if (window.confirm(t('users.confirmDelete'))) {
      try {
        const response = await fetch(
          `/api/auth/users/${userId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (response.ok) {
          setSuccess(t('users.success.userDeleted'));
          fetchUsers();
        } else {
          setError(t('users.errors.deleteFailed'));
        }
      } catch (error) {
        setError(t('users.errors.deleteFailed'));
      }
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    // Verhindere, dass User sich selbst deaktivieren
    if (userId === user.id && currentStatus) {
      setError(t('users.errors.cannotDeactivateSelf'));
      return;
    }
    
    try {
      const response = await fetch(
        `/api/auth/users/${userId}/toggle-active`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || t(currentStatus ? 'users.success.userDeactivated' : 'users.success.userActivated'));
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || t('users.errors.statusChangeFailed'));
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError(t('users.errors.statusChangeFailed'));
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
      case 'Administrator': return t('users.roles.administrator');
      case 'Power User': return t('users.roles.powerUser');
      case 'Benutzer': return t('users.roles.user');
      case 'Gast': return t('users.roles.guest');
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
            {t('common.retry')}
          </Button>
        </Box>
      );
    }

    if (users.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
            {t('users.noUsersFound')}
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
            {t('common.refresh')}
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
                        label={t('users.you')}
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
                      {t('users.status.online')}
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
                  label={u.isActive ? t('users.status.accountActive') : t('users.status.accountLocked')}
                  size="small"
                  sx={{
                    backgroundColor: u.isActive ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                    color: u.isActive ? '#34C759' : '#FF3B30',
                    border: `1px solid ${u.isActive ? '#34C759' : '#FF3B30'}`,
                  }}
                />
              </Box>

              <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', mb: 1 }}>
                {t('users.fields.lastLogin')}: {u.lastLogin ? new Date(u.lastLogin).toLocaleString(t('common.locale')) : t('common.never')}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Tooltip title={t('common.edit')}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedUser(u);
                      const initialData = {
                        username: u.username,
                        email: u.email,
                        password: '',
                        role: u.role,
                      };
                      setFormData(initialData);
                      setOriginalFormData(initialData); // Store original for comparison
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
                    <Tooltip title={
                      u.id === user.id && u.isActive 
                        ? t('users.errors.cannotDeactivateSelf')
                        : (u.isActive ? t('users.actions.deactivate') : t('users.actions.activate'))
                    }>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleActive(u.id, Boolean(u.isActive))}
                          disabled={u.id === user.id && u.isActive}
                          sx={{ 
                            color: '#FF9500',
                            backgroundColor: 'rgba(255, 149, 0, 0.1)',
                            border: '1px solid rgba(255, 149, 0, 0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 149, 0, 0.2)',
                              borderColor: 'rgba(255, 149, 0, 0.4)',
                            },
                            '&:disabled': {
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            }
                          }}
                        >
                          {u.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    {u.username !== user.username && (
                      <Tooltip title={t('common.delete')}>
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
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.user')}</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.email')}</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.role')}</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.accountStatus')}</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.lastLogin')}</TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.actions')}</TableCell>
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
                            label={t('users.you')}
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
                          {t('users.status.online')}
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
                    label={u.isActive ? t('users.status.accountActive') : t('users.status.accountLocked')}
                    size="small"
                    sx={{
                      backgroundColor: u.isActive ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                      color: u.isActive ? '#34C759' : '#FF3B30',
                      border: `1px solid ${u.isActive ? '#34C759' : '#FF3B30'}`,
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  <Tooltip title={u.lastLogin ? new Date(u.lastLogin).toLocaleString(t('common.locale')) : t('common.never')}>
                    <span>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString(t('common.locale')) : t('common.never')}</span>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ padding: '8px' }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={t('common.edit')}>
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
                    <Tooltip title={
                      u.id === user.id && u.isActive 
                        ? t('users.errors.cannotDeactivateSelf')
                        : (u.isActive ? t('users.actions.lockAccount') : t('users.actions.unlockAccount'))
                    }>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleActive(u.id, Boolean(u.isActive))}
                          disabled={u.id === user.id && u.isActive}
                          sx={{ 
                            color: '#FF9500',
                            backgroundColor: 'rgba(255, 149, 0, 0.1)',
                            border: '1px solid rgba(255, 149, 0, 0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 149, 0, 0.2)',
                              borderColor: 'rgba(255, 149, 0, 0.4)',
                            },
                            '&:disabled': {
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            }
                          }}
                        >
                          {u.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    {u.username !== user.username && (
                      <Tooltip title={t('common.delete')}>
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
      style={{ width: `${panelWidth}px` }}  // Width als style für Safari/iPad
      sx={getPanelStyles(isResizing)}
    >
      {/* Resize Handle - einheitlich mit Touch-Support */}
      <Box
        onMouseDown={startResize}
        onTouchStart={startResize}
        onPointerDown={startResize}
        sx={getResizeHandleStyles()}
      />

      {/* Header */}
      <UnifiedPanelHeader 
        title={t('users.title')} 
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
          <Tab label={t('users.tabs.users')} />
          <Tab label={t('users.tabs.rolesPermissions')} />
          <Tab label={t('users.tabs.statistics')} />
        </Tabs>
      </Box>

      {/* Tab Content Container */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Users Tab */}
          <Box sx={{ 
            width: '100%', 
            p: { xs: 1, sm: 2 }, 
            height: '100%', 
            overflow: 'auto',
            display: tabValue === 0 ? 'block' : 'none'
          }}>
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
                  {t('users.addUser')}
                </Button>
              )}
              {!isAdmin() && (
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {t('users.onlyAdminsCanSeeAllUsers')}
                </Typography>
              )}
            </Box>
            {renderUserTable()}
          </Box>

          {/* Roles Tab */}
          <Box sx={{ 
            width: '100%', 
            p: { xs: 1, sm: 2 }, 
            height: '100%', 
            overflow: 'auto',
            display: tabValue === 1 ? 'block' : 'none'
          }}>
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
                      {t('users.fields.permissions')}:
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
          <Box sx={{ 
            width: '100%', 
            p: { xs: 1, sm: 2 }, 
            height: '100%', 
            overflow: 'auto',
            display: tabValue === 2 ? 'block' : 'none'
          }}>
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
                    {t('users.statistics.totalUsers')}
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
                    {users.filter(u => Boolean(u.isActive)).length}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {t('users.statistics.activeUsers')}
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
                    {t('users.statistics.administrators')}
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
                    {t('users.statistics.roleDistribution')}
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
        </Box>
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
        <DialogTitle>{t('users.dialogs.createUser')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('users.fields.username')}
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
                label={t('users.fields.email')}
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
                label={t('users.fields.password')}
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
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.role')}</InputLabel>
                <Select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  label={t('users.fields.role')}
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
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreateUser} variant="contained" sx={{ backgroundColor: '#007AFF' }}>
            {t('common.create')}
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
        <DialogTitle>{t('users.dialogs.editUser')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('users.fields.username')}
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
                label={t('users.fields.email')}
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
                label={t('users.fields.newPasswordOptional')}
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                helperText={t('users.fields.passwordHelp')}
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
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{t('users.fields.role')}</InputLabel>
                <Select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  label={t('users.fields.role')}
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
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUpdateUser} variant="contained" sx={{ backgroundColor: '#007AFF' }}>
            {t('common.save')}
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