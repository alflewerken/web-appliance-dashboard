import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SwipeableTabContainer, SwipeableTabPanel } from './SwipeableTabPanel';
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
  Card,
  CardContent,
} from '@mui/material';
import {
  X,
  GripVertical,
  UserPlus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Shield,
  Settings,
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

// Tab Panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box 
          sx={{ 
            p: { xs: 1, sm: 2 }, 
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {children}
        </Box>
      )}
    </div>
  );
}

const UserPanel = ({ onClose, onWidthChange }) => {
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
  
  // Debounce timer for fetchUsers
  const fetchUsersTimeoutRef = useRef(null);

  // Panel width state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('userPanelWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Refs
  const panelRef = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []); // Empty dependency array - only run once on mount

  // SSE Event Listeners für Echtzeit-Updates
  useEffect(() => {
    if (!addEventListener) return;

    const userEvents = [
      // CRUD Events
      'user_created',
      'user_updated',
      'user_deleted',
      // Status Events
      'user_activated',
      'user_deactivated',
      'user_status_changed',
      // Restore Events from Audit Log
      'user_restore',
      'user_restored',
      'user_reverted',
      // Login/Logout Events für Online-Status
      'user_login',
      'user_logout',
      'login',
      'logout',
    ];

    console.log('[UserPanel] Setting up SSE listeners for events:', userEvents);

    const unsubscribers = userEvents.map(eventType =>
      addEventListener(eventType, data => {
        console.log(`[UserPanel] Received SSE event: ${eventType}`, data);
        
        // Special handling for login/logout events
        if (['user_login', 'user_logout', 'login', 'logout'].includes(eventType)) {
          console.log(`[UserPanel] Processing ${eventType} event for user:`, data.username || data.id);
        }

        // Show success message for certain events
        if (['user_created', 'user_restored', 'user_activated'].includes(eventType)) {
          if (data.username) {
            setSuccess(`Benutzer "${data.username}" wurde ${
              eventType === 'user_created' ? 'erstellt' :
              eventType === 'user_restored' ? 'wiederhergestellt' :
              'aktiviert'
            }`);
          }
        }

        if (['user_deleted', 'user_deactivated'].includes(eventType)) {
          if (data.username || data.deleted_username) {
            setSuccess(`Benutzer "${data.username || data.deleted_username}" wurde ${
              eventType === 'user_deleted' ? 'gelöscht' : 'deaktiviert'
            }`);
          }
        }

        // Always refresh user list after any user-related event
        console.log(`[UserPanel] Refreshing user list after ${eventType} event`);
        debouncedFetchUsers();
      })
    );

    // Also listen for audit log events that might affect users
    const auditLogUnsubscriber = addEventListener('audit_log_created', data => {
      console.log('[UserPanel] Received audit_log_created event:', data);
      
      // Check if this audit log event is user-related
      const userRelatedActions = [
        'user_created', 'user_updated', 'user_deleted',
        'user_restored', 'user_reverted', 'user_activated',
        'user_deactivated', 'user_login', 'user_logout'
      ];
      
      if (data.resource_type === 'users' || data.resource_type === 'user' || 
          userRelatedActions.includes(data.action)) {
        console.log('[UserPanel] Audit log event is user-related, refreshing...');
        debouncedFetchUsers();
      }
    });

    // Cleanup
    return () => {
      console.log('[UserPanel] Cleaning up SSE listeners');
      
      // Clear any pending fetch timeout
      if (fetchUsersTimeoutRef.current) {
        clearTimeout(fetchUsersTimeoutRef.current);
      }
      
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      if (typeof auditLogUnsubscriber === 'function') {
        auditLogUnsubscriber();
      }
    };
  }, [addEventListener, debouncedFetchUsers]);

  // Notify parent of initial width
  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(panelWidth);
    }
  }, []); // Only on mount

  // Handle resize
  const handleMouseDown = useCallback(
    e => {
      e.preventDefault();
      setIsResizing(true);
      startX.current = e.clientX;
      startWidth.current = panelWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [panelWidth]
  );

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

        // Save to localStorage
        localStorage.setItem('userPanelWidth', panelWidth.toString());

        // Notify parent component
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
    console.log('Fetching users...');
    console.log('Current user:', user);
    console.log('Is admin:', isAdmin());
    
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'exists' : 'missing');
      
      // Decode token to check user role
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Token payload:', payload);
        } catch (e) {
          console.error('Error decoding token:', e);
        }
      }
      
      console.log('API URL:', `${API_BASE_URL}/api/auth/users`);
      
      // If not admin, just show current user
      if (!isAdmin()) {
        console.log('Not admin, showing only current user');
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
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Users data:', data);
        setUsers(data);
      } else {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        
        // If 403 (forbidden), show only current user
        if (response.status === 403) {
          console.log('Access forbidden, showing only current user');
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

  // Debounced version of fetchUsers to prevent multiple rapid calls
  const debouncedFetchUsers = useCallback(() => {
    // Clear any existing timeout
    if (fetchUsersTimeoutRef.current) {
      clearTimeout(fetchUsersTimeoutRef.current);
    }
    
    // Set a new timeout
    fetchUsersTimeoutRef.current = setTimeout(() => {
      console.log('[UserPanel] Executing debounced fetchUsers');
      fetchUsers();
    }, 300); // 300ms debounce
  }, [fetchUsers]);

  const fetchRoles = async () => {
    // Verwende statische Rollen mit Permissions wie in UserManagement
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
        setSuccess(
          data.message ||
            `Benutzer ${currentStatus ? 'deaktiviert' : 'aktiviert'}`
        );
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

  const getRoleColor = role => {
    switch (role) {
      case 'Administrator':
        return '#FF3B30';
      case 'Power User':
        return '#FF9500';
      case 'Benutzer':
        return '#007AFF';
      case 'Gast':
        return '#8E8E93';
      default:
        return '#007AFF';
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

  // Check if user is currently online (active within last 5 minutes)
  const isUserOnline = user => {
    // Check if backend already determined online status
    if (user.is_online !== undefined) {
      return user.is_online === 1;
    }

    // Fallback to checking last_activity
    const lastActivity = user.last_activity || user.lastActivity;
    if (!lastActivity) return false;

    const lastActivityTime = new Date(lastActivity).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return now - lastActivityTime < fiveMinutes;
  };

  // Determine if we should use compact mode based on panel width or mobile
  const isMobile = window.innerWidth <= 768;
  const isCompactMode = isMobile || panelWidth < 800;

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        width: { xs: '100vw', sm: `${panelWidth}px` },
        height: '100%',
        backgroundColor: 'rgba(118, 118, 128, 0.12)',  // Subtile Transparenz
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
      {' '}
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
          onChange={(e, newValue) => setTabValue(newValue)}
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
      {/* Content */}
      <SwipeableTabContainer
        currentTab={tabValue}
        onTabChange={(e, newValue) => setTabValue(newValue)}
        tabCount={3}
      >
        {/* Users Tab */}
        <Box sx={{ p: { xs: 1, sm: 2 }, height: '100%' }}>
          {/* Add User Button */}
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

          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mb: 2, p: 1, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                Debug: {users.length} users | Loading: {loading ? 'yes' : 'no'} | Error: {error || 'none'} | Compact: {isCompactMode ? 'yes' : 'no'} | Mobile: {isMobile ? 'yes' : 'no'}
              </Typography>
            </Box>
          )}

          {/* Users Display - Table or Cards based on width */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress sx={{ color: '#007AFF' }} />
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography sx={{ color: '#ff3b30', mb: 2 }}>
                {error}
              </Typography>
              <Button
                variant="contained"
                onClick={() => {
                  setError('');
                  setLoading(true);
                  fetchUsers();
                }}
                sx={{
                  backgroundColor: '#007AFF',
                  '&:hover': {
                    backgroundColor: '#0051D5',
                  },
                }}
              >
                Erneut versuchen
              </Button>
            </Box>
          ) : users.length === 0 ? (
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
          ) : isCompactMode ? (
            // Compact Card View for narrow panels
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                width: '100%',
                px: { xs: 1, sm: 0 }
              }}
            >
              {users.map(u => (
                <Paper
                  key={u.id}
                  sx={{
                    p: 2,
                    backgroundColor: 'var(--container-bg)',  // Gleiche Tönung wie Settings-Panel
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--container-border)',
                    borderRadius: '12px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ position: 'relative', mr: 2 }}>
                      <Avatar
                        sx={{ width: 40, height: 40, bgcolor: '#007AFF' }}
                      >
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
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
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
                      <Typography
                        sx={{
                          color: 'rgba(255, 255, 255, 0.6)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {u.email}
                      </Typography>
                      {(isUserOnline(u) || u.username === user.username) && (
                        <Typography
                          sx={{
                            color: '#34C759',
                            fontSize: '0.75rem',
                            mt: 0.5,
                          }}
                        >
                          Online
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box
                    sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}
                  >
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
                        backgroundColor: u.is_active
                          ? 'rgba(52, 199, 89, 0.2)'
                          : 'rgba(255, 59, 48, 0.2)',
                        color: u.is_active ? '#34C759' : '#FF3B30',
                        border: `1px solid ${u.is_active ? '#34C759' : '#FF3B30'}`,
                      }}
                    />
                  </Box>

                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.75rem',
                      mb: 1,
                    }}
                  >
                    Letzte Anmeldung:{' '}
                    {u.last_login
                      ? new Date(u.last_login).toLocaleString('de-DE')
                      : 'Nie'}
                  </Typography>

                  <Box
                    sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}
                  >
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
                          backdropFilter: 'blur(10px)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: 'rgba(52, 199, 89, 0.2)',
                            borderColor: 'rgba(52, 199, 89, 0.4)',
                            boxShadow: '0 0 20px rgba(52, 199, 89, 0.5), inset 0 0 20px rgba(52, 199, 89, 0.1)',
                            transform: 'translateY(-2px)',
                          },
                          '&:active': {
                            transform: 'translateY(0)',
                          },
                          '&:disabled': {
                            opacity: 0.5,
                            color: 'rgba(255, 255, 255, 0.3)',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                          }
                        }}
                        disabled={!isAdmin() && u.id !== user.id}
                      >
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    {isAdmin() && (
                      <>
                        <Tooltip
                          title={u.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleToggleActive(u.id, Boolean(u.is_active))
                            }
                            sx={{ 
                              color: '#FF9500',
                              backgroundColor: 'rgba(255, 149, 0, 0.1)',
                              border: '1px solid rgba(255, 149, 0, 0.2)',
                              backdropFilter: 'blur(10px)',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 149, 0, 0.2)',
                                borderColor: 'rgba(255, 149, 0, 0.4)',
                                boxShadow: '0 0 20px rgba(255, 149, 0, 0.5), inset 0 0 20px rgba(255, 149, 0, 0.1)',
                                transform: 'translateY(-2px)',
                              },
                              '&:active': {
                                transform: 'translateY(0)',
                              }
                            }}
                          >
                            {u.is_active ? (
                              <Lock size={16} />
                            ) : (
                              <Unlock size={16} />
                            )}
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
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  backgroundColor: 'rgba(255, 59, 48, 0.2)',
                                  borderColor: 'rgba(255, 59, 48, 0.4)',
                                  boxShadow: '0 0 20px rgba(255, 59, 48, 0.5), inset 0 0 20px rgba(255, 59, 48, 0.1)',
                                  transform: 'translateY(-2px)',
                                },
                                '&:active': {
                                  transform: 'translateY(0)',
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
          ) : (
            <TableContainer
              component={Paper}
              sx={{
                backgroundColor: 'var(--container-bg)',  // Gleiche Tönung wie Settings-Panel
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--container-border)',
                borderRadius: '12px',
                overflowX: 'auto',
                '&::-webkit-scrollbar': {
                  height: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'var(--container-bg)',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                },
              }}
            >
              <Table sx={{ minWidth: isCompactMode ? 500 : 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Benutzer
                    </TableCell>
                    <TableCell
                      sx={{ color: 'rgba(255, 255, 255, 0.7)', minWidth: 150 }}
                    >
                      E-Mail
                    </TableCell>
                    <TableCell
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Rolle
                    </TableCell>
                    <TableCell
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Account-Status
                    </TableCell>
                    <TableCell
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Letzte Anmeldung
                    </TableCell>
                    <TableCell
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        whiteSpace: 'nowrap',
                        width: 120,
                      }}
                    >
                      Aktionen
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          <Box sx={{ position: 'relative' }}>
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#007AFF',
                                flexShrink: 0,
                              }}
                            >
                              {u.username.charAt(0).toUpperCase()}
                            </Avatar>
                            {(isUserOnline(u) ||
                              u.username === user.username) && (
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
                            <Typography
                              sx={{
                                color: '#fff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
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
                            {(isUserOnline(u) ||
                              u.username === user.username) && (
                              <Typography
                                sx={{
                                  color: '#34C759',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Online
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
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
                          label={
                            u.is_active ? 'Account aktiv' : 'Account gesperrt'
                          }
                          size="small"
                          sx={{
                            backgroundColor: u.is_active
                              ? 'rgba(52, 199, 89, 0.2)'
                              : 'rgba(255, 59, 48, 0.2)',
                            color: u.is_active ? '#34C759' : '#FF3B30',
                            border: `1px solid ${u.is_active ? '#34C759' : '#FF3B30'}`,
                          }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Tooltip
                          title={
                            u.last_login
                              ? new Date(u.last_login).toLocaleString('de-DE')
                              : 'Nie'
                          }
                        >
                          <span>
                            {u.last_login
                              ? new Date(u.last_login).toLocaleDateString(
                                  'de-DE'
                                )
                              : 'Nie'}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ padding: '8px' }}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  backgroundColor: 'rgba(52, 199, 89, 0.2)',
                                  borderColor: 'rgba(52, 199, 89, 0.4)',
                                  boxShadow: '0 0 20px rgba(52, 199, 89, 0.5), inset 0 0 20px rgba(52, 199, 89, 0.1)',
                                  transform: 'translateY(-2px)',
                                },
                                '&:active': {
                                  transform: 'translateY(0)',
                                }
                              }}
                            >
                              <Edit size={16} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={
                              u.is_active
                                ? 'Account sperren'
                                : 'Account aktivieren'
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleToggleActive(u.id, Boolean(u.is_active))
                              }
                              sx={{ 
                                color: '#FF9500',
                                backgroundColor: 'rgba(255, 149, 0, 0.1)',
                                border: '1px solid rgba(255, 149, 0, 0.2)',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  backgroundColor: 'rgba(255, 149, 0, 0.2)',
                                  borderColor: 'rgba(255, 149, 0, 0.4)',
                                  boxShadow: '0 0 20px rgba(255, 149, 0, 0.5), inset 0 0 20px rgba(255, 149, 0, 0.1)',
                                  transform: 'translateY(-2px)',
                                },
                                '&:active': {
                                  transform: 'translateY(0)',
                                }
                              }}
                            >
                              {u.is_active ? (
                                <Lock size={16} />
                              ) : (
                                <Unlock size={16} />
                              )}
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
                                  backdropFilter: 'blur(10px)',
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255, 59, 48, 0.2)',
                                    borderColor: 'rgba(255, 59, 48, 0.4)',
                                    boxShadow: '0 0 20px rgba(255, 59, 48, 0.5), inset 0 0 20px rgba(255, 59, 48, 0.1)',
                                    transform: 'translateY(-2px)',
                                  },
                                  '&:active': {
                                    transform: 'translateY(0)',
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
          )}
        </Box>

        {/* Roles Tab */}
        <Box sx={{ p: { xs: 1, sm: 2 }, height: '100%' }}>
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
                  <Divider
                    sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}
                  >
                    Berechtigungen:
                  </Typography>
                  <Box sx={{ pl: 1 }}>
                    {role.permissions.map((perm, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}
                      >
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
        <Box sx={{ p: { xs: 1, sm: 2 }, height: '100%' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: 'var(--container-bg)',  // Gleiche Tönung wie Settings-Panel
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--container-border)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="h3"
                  sx={{ color: '#007AFF', fontWeight: 'bold' }}
                >
                  {users.length}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  Gesamte Benutzer
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: 'var(--container-bg)',  // Gleiche Tönung wie Settings-Panel
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--container-border)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="h3"
                  sx={{ color: '#34C759', fontWeight: 'bold' }}
                >
                  {users.filter(u => Boolean(u.is_active)).length}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  Aktive Benutzer
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: 'var(--container-bg)',  // Gleiche Tönung wie Settings-Panel
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--container-border)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="h3"
                  sx={{ color: '#FF3B30', fontWeight: 'bold' }}
                >
                  {users.filter(u => u.role === 'Administrator').length}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  Administratoren
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: 'var(--container-bg)',  // Gleiche Tönung wie Settings-Panel
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
                  const percentage =
                    users.length > 0
                      ? ((count / users.length) * 100).toFixed(1)
                      : 0;
                  return (
                    <Box key={role.role} sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
                          {role.label}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                        >
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
      </SwipeableTabContainer>
      {/* Create User Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(13, 17, 23, 0.95)',  // Dunkler Dialog
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
                onChange={e =>
                  setFormData({ ...formData, username: e.target.value })
                }
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007AFF',
                    },
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
                onChange={e =>
                  setFormData({ ...formData, email: e.target.value })
                }
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007AFF',
                    },
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
                onChange={e =>
                  setFormData({ ...formData, password: e.target.value })
                }
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007AFF',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Rolle
                </InputLabel>
                <Select
                  value={formData.role}
                  onChange={e =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  label="Rolle"
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#007AFF',
                    },
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
          <Button
            onClick={() => setOpenDialog(false)}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            sx={{ backgroundColor: '#007AFF' }}
          >
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
            backgroundColor: 'rgba(13, 17, 23, 0.95)',  // Dunkler Dialog
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
                onChange={e =>
                  setFormData({ ...formData, username: e.target.value })
                }
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007AFF',
                    },
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
                onChange={e =>
                  setFormData({ ...formData, email: e.target.value })
                }
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007AFF',
                    },
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
                onChange={e =>
                  setFormData({ ...formData, password: e.target.value })
                }
                helperText="Leer lassen, um das Passwort nicht zu ändern"
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#fff',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007AFF',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Rolle
                </InputLabel>
                <Select
                  value={formData.role}
                  onChange={e =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  label="Rolle"
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#007AFF',
                    },
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
          <Button
            onClick={() => setEditDialog(false)}
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleUpdateUser}
            variant="contained"
            sx={{ backgroundColor: '#007AFF' }}
          >
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
        <Alert
          onClose={() => setSuccess('')}
          severity="success"
          sx={{ width: '100%' }}
        >
          {success}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setError('')}
          severity="error"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserPanel;
