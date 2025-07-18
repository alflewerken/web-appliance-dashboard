import React, { useState, useEffect } from 'react';
import SwipeableViews from 'react-swipeable-views';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  VpnKey as VpnKeyIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import API_BASE_URL from '../config';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AppliancePermissions = ({
  open,
  onClose,
  applianceId,
  applianceName,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [visibility, setVisibility] = useState('authenticated');
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open && applianceId) {
      fetchData();
    }
  }, [open, applianceId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch appliance details
      const appResponse = await fetch(
        `${API_BASE_URL}/api/appliances/${applianceId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (appResponse.ok) {
        const appData = await appResponse.json();
        setVisibility(appData.visibility || 'authenticated');
      }

      // Fetch users
      const usersResponse = await fetch(`${API_BASE_URL}/api/roles/users`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);

        // Fetch permissions for each user
        const perms = {};
        for (const user of usersData) {
          const permResponse = await fetch(
            `${API_BASE_URL}/api/roles/users/${user.id}/appliances`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            }
          );
          if (permResponse.ok) {
            const permData = await permResponse.json();
            const appPerm = permData.appliances.find(a => a.id === applianceId);
            if (appPerm) {
              perms[user.id] = {
                can_view: appPerm.custom_view || appPerm.can_view,
                can_execute: appPerm.custom_execute || appPerm.can_execute,
                inherited_view: appPerm.can_view && !appPerm.custom_view,
                inherited_execute:
                  appPerm.can_execute && !appPerm.custom_execute,
              };
            }
          }
        }
        setPermissions(perms);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityChange = async newVisibility => {
    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/roles/appliances/${applianceId}/visibility`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ visibility: newVisibility }),
        }
      );

      if (response.ok) {
        setVisibility(newVisibility);
        setSuccess('Sichtbarkeit erfolgreich aktualisiert');
      } else {
        setError('Fehler beim Aktualisieren der Sichtbarkeit');
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      setError('Fehler beim Aktualisieren der Sichtbarkeit');
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionChange = async (userId, permType, value) => {
    setSaving(true);
    try {
      const currentPerms = permissions[userId] || {};
      const response = await fetch(
        `${API_BASE_URL}/api/roles/users/${userId}/appliances/${applianceId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            can_view: permType === 'view' ? value : currentPerms.can_view,
            can_execute:
              permType === 'execute' ? value : currentPerms.can_execute,
          }),
        }
      );

      if (response.ok) {
        setPermissions({
          ...permissions,
          [userId]: {
            ...currentPerms,
            [`can_${permType}`]: value,
            [`inherited_${permType}`]: false,
          },
        });
        setSuccess('Berechtigungen erfolgreich aktualisiert');
      } else {
        setError('Fehler beim Aktualisieren der Berechtigungen');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      setError('Fehler beim Aktualisieren der Berechtigungen');
    } finally {
      setSaving(false);
    }
  };

  const getVisibilityIcon = vis => {
    switch (vis) {
      case 'public':
        return <PublicIcon />;
      case 'authenticated':
        return <LockIcon />;
      case 'power_user':
        return <VpnKeyIcon />;
      case 'admin':
        return <AdminIcon />;
      default:
        return <LockIcon />;
    }
  };

  const getVisibilityLabel = vis => {
    switch (vis) {
      case 'public':
        return 'Öffentlich (Gäste können sehen)';
      case 'authenticated':
        return 'Authentifizierte Benutzer';
      case 'power_user':
        return 'Power User und höher';
      case 'admin':
        return 'Nur Administratoren';
      default:
        return vis;
    }
  };

  const getRoleBasedAccess = user => {
    if (!user.role) return { view: false, execute: false };

    switch (user.role) {
      case 'admin':
        return { view: true, execute: true };
      case 'power_user':
        return {
          view: ['public', 'authenticated', 'power_user'].includes(visibility),
          execute: true,
        };
      case 'user':
        return {
          view: ['public', 'authenticated'].includes(visibility),
          execute: ['public', 'authenticated'].includes(visibility),
        };
      case 'guest':
        return {
          view: visibility === 'public',
          execute: false,
        };
      default:
        return { view: false, execute: false };
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Berechtigungen für: {applianceName}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
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

        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
        >
          <Tab label="Allgemeine Sichtbarkeit" />
          <Tab label="Benutzerspezifische Berechtigungen" />
        </Tabs>

        <SwipeableViews
          index={tabValue}
          onChangeIndex={setTabValue}
          style={{ marginTop: '16px' }}
        >
          {/* General Visibility Tab */}
          <Box>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Basis-Sichtbarkeitseinstellung
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Diese Einstellung bestimmt, welche Benutzergruppen standardmäßig
                  Zugriff auf diese Appliance haben.
                </Typography>

                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Sichtbarkeit</InputLabel>
                  <Select
                    value={visibility}
                    onChange={e => handleVisibilityChange(e.target.value)}
                    label="Sichtbarkeit"
                    disabled={saving}
                  >
                  <MenuItem value="public">
                    <Box display="flex" alignItems="center">
                      <PublicIcon sx={{ mr: 1 }} />
                      Öffentlich (Alle, auch Gäste)
                    </Box>
                  </MenuItem>
                  <MenuItem value="authenticated">
                    <Box display="flex" alignItems="center">
                      <LockIcon sx={{ mr: 1 }} />
                      Authentifizierte Benutzer
                    </Box>
                  </MenuItem>
                  <MenuItem value="power_user">
                    <Box display="flex" alignItems="center">
                      <VpnKeyIcon sx={{ mr: 1 }} />
                      Power User und Administratoren
                    </Box>
                  </MenuItem>
                  <MenuItem value="admin">
                    <Box display="flex" alignItems="center">
                      <AdminIcon sx={{ mr: 1 }} />
                      Nur Administratoren
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Aktuelle Einstellung bedeutet:
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    {getVisibilityIcon(visibility)}{' '}
                    {getVisibilityLabel(visibility)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* User-specific Permissions Tab */}
        <Box>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Benutzer</TableCell>
                    <TableCell>Rolle</TableCell>
                    <TableCell align="center">Ansehen</TableCell>
                    <TableCell align="center">Ausführen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map(user => {
                    const roleAccess = getRoleBasedAccess(user);
                    const userPerms = permissions[user.id] || {};

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Typography variant="body2">
                            {user.username}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {user.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.role}
                            size="small"
                            color={user.role === 'admin' ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={userPerms.can_view || roleAccess.view}
                                onChange={e =>
                                  handlePermissionChange(
                                    user.id,
                                    'view',
                                    e.target.checked
                                  )
                                }
                                disabled={roleAccess.view || saving}
                              />
                            }
                            label={
                              userPerms.inherited_view || roleAccess.view ? (
                                <Typography
                                  variant="caption"
                                  color="textSecondary"
                                >
                                  (Vererbt)
                                </Typography>
                              ) : null
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <FormControlLabel
                            control={
                              <Switch
                                checked={
                                  userPerms.can_execute || roleAccess.execute
                                }
                                onChange={e =>
                                  handlePermissionChange(
                                    user.id,
                                    'execute',
                                    e.target.checked
                                  )
                                }
                                disabled={
                                  roleAccess.execute ||
                                  saving ||
                                  user.role === 'guest'
                                }
                              />
                            }
                            label={
                              userPerms.inherited_execute ||
                              roleAccess.execute ? (
                                <Typography
                                  variant="caption"
                                  color="textSecondary"
                                >
                                  (Vererbt)
                                </Typography>
                              ) : null
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </SwipeableViews>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Schließen</Button>
    </DialogActions>
    </Dialog>
  );
};

export default AppliancePermissions;
