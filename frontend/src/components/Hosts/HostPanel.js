import React, { useState, useEffect, useRef } from 'react';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import SSHKeyManagement from '../SettingsPanel/SSHKeyManagement';
import sseService from '../../services/sseService';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  Divider,
  FormControlLabel,
  Switch,
  CircularProgress,
  Slider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Card,
  CardContent,
  Tabs,
  Tab,
} from '@mui/material';
import {
  X,
  Save,
  Trash2,
  Settings,
  Edit,
  Copy,
  AlertCircle,
  Terminal,
  Monitor,
  Key,
  Plus,
  Edit2,
  Server,
  GripVertical,
} from 'lucide-react';
import SimpleIcon from '../SimpleIcon';
import IconSelector from '../IconSelector';
import RustDeskInstaller from '../RemoteDesktop/RustDeskInstaller';
import { COLOR_PRESETS } from '../../utils/constants';
import { getAvailableIcons } from '../../utils/iconMap';
import axios from '../../utils/axiosConfig';

const HostPanel = ({
  host,
  onClose,
  onSave,
  onDelete,
  adminMode = false,
  onWidthChange,
  defaultWidth = 600
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [registeringKey, setRegisteringKey] = useState(false);
  const [checkingRustDeskStatus, setCheckingRustDeskStatus] = useState(false);
  const [showRustDeskInstaller, setShowRustDeskInstaller] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    return parseInt(localStorage.getItem('hostPanelWidth')) || defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  // Store original data for comparison
  const [originalFormData, setOriginalFormData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hostname: '',
    port: 22,
    username: 'root',
    password: '',
    privateKey: '',
    sshKeyName: null,
    icon: 'Server',
    color: '#007AFF',
    transparency: 0.15,
    blur: 8,
    remoteDesktopEnabled: false,
    remoteDesktopType: 'guacamole',
    remoteProtocol: 'vnc',
    remotePort: null,
    remoteUsername: '',
    remotePassword: '',
    rustdeskId: '',
    rustdeskPassword: '',
    guacamolePerformanceMode: 'balanced',
  });

  // SSH Keys state
  const [sshKeys, setSshKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);

  // Initialize form data
  useEffect(() => {
    if (host && !host.isNew) {
      const initialData = {
        name: host.name || '',
        description: host.description || '',
        hostname: host.hostname || '',
        port: host.port || 22,
        username: host.username || 'root',
        password: host.password || '',
        privateKey: host.privateKey || '',
        sshKeyName: host.sshKeyName || null,
        icon: host.icon || 'Server',
        color: host.color || '#007AFF',
        transparency: host.transparency !== undefined ? host.transparency : 0.15,
        blur: host.blur !== undefined ? host.blur : 8,
        remoteDesktopEnabled: host.remoteDesktopEnabled || false,
        remoteDesktopType: host.remoteDesktopType || 'guacamole',
        remoteProtocol: host.remoteProtocol || 'vnc',
        remotePort: host.remotePort || null,
        remoteUsername: host.remoteUsername || '',
        remotePassword: host.remotePassword || '',
        rustdeskId: host.rustdeskId || '',
        rustdeskPassword: host.rustdeskPassword || '',
        guacamolePerformanceMode: host.guacamolePerformanceMode || 'balanced',
      };
      setFormData(initialData);
      setOriginalFormData(initialData); // Store original for comparison
      
      // Set selected key if host has one - wird in fetchSSHKeys nochmal validiert
      if (host.sshKeyName) {
        setSelectedKey(host.sshKeyName);
        console.log('Setting selectedKey from host:', host.sshKeyName);
      } else {
        setSelectedKey(null);
        console.log('No SSH key configured for this host');
      }
    } else if (host?.isNew) {
      // Bei neuen Hosts: Default-Werte setzen
      // Dashboard-Schlüssel wird in fetchSSHKeys gesetzt
      const defaultData = {
        name: '',
        description: '',
        hostname: '',
        username: 'root',
        port: 22,
        password: '',
        privateKey: '',
        sshKeyName: 'dashboard', // Default auf dashboard setzen
        icon: 'Server',
        color: '#007AFF',
        transparency: 0.15,
        blur: 8,
        remoteDesktopEnabled: false,
        remoteDesktopType: 'guacamole',
        remoteProtocol: 'vnc',
        remotePort: null,
        remoteUsername: '',
        remotePassword: '',
        rustdeskId: '',
        rustdeskPassword: '',
        guacamolePerformanceMode: 'balanced',
      };
      setFormData(defaultData);
      setOriginalFormData(defaultData);
      // Dashboard wird standardmäßig ausgewählt
      setSelectedKey('dashboard');
    }
  }, [host]);

  // Subscribe to SSE events for real-time updates
  useEffect(() => {
    if (!host || host.isNew) return; // Nur für existierende Hosts
    
    console.log('Setting up SSE listeners for host:', host.id, host.name);
    
    const handleHostUpdated = async (data) => {
      console.log('SSE host_updated event received:', data);
      
      // Wenn dieser Host aktualisiert wurde, lade die neuen Daten
      // Vergleiche IDs als Strings für Typ-Sicherheit
      if (data.id && String(data.id) === String(host.id)) {
        console.log('Host was updated via SSE, reloading data...', { 
          eventId: data.id, 
          hostId: host.id,
          eventName: data.name 
        });
        try {
          const response = await axios.get(`/api/hosts/${host.id}`);
          if (response.data.host) {
            const updatedHost = response.data.host;
            const updatedData = {
              name: updatedHost.name || '',
              description: updatedHost.description || '',
              hostname: updatedHost.hostname || '',
              port: updatedHost.port || 22,
              username: updatedHost.username || 'root',
              password: updatedHost.password || '',
              privateKey: updatedHost.privateKey || '',
              sshKeyName: updatedHost.sshKeyName || null,
              icon: updatedHost.icon || 'Server',
              color: updatedHost.color || '#007AFF',
              transparency: updatedHost.transparency !== undefined ? updatedHost.transparency : 0.15,
              blur: updatedHost.blur !== undefined ? updatedHost.blur : 8,
              remoteDesktopEnabled: updatedHost.remoteDesktopEnabled || false,
              remoteDesktopType: updatedHost.remoteDesktopType || 'guacamole',
              remoteProtocol: updatedHost.remoteProtocol || 'vnc',
              remotePort: updatedHost.remotePort || null,
              remoteUsername: updatedHost.remoteUsername || '',
              remotePassword: updatedHost.remotePassword || '',
              rustdeskId: updatedHost.rustdeskId || '',
              rustdeskPassword: updatedHost.rustdeskPassword || '',
              guacamolePerformanceMode: updatedHost.guacamolePerformanceMode || 'balanced',
            };
            setFormData(updatedData);
            setOriginalFormData(updatedData);
            setSuccess('Host wurde extern aktualisiert und neu geladen');
          }
        } catch (error) {
          console.error('Error reloading host data:', error);
          setError('Fehler beim Neuladen der Host-Daten');
        }
      }
    };
    
    const handleHostReverted = handleHostUpdated; // Gleiche Behandlung für revert
    
    const handleHostDeleted = (data) => {
      console.log('SSE host_deleted event received:', data);
      
      // Wenn dieser Host gelöscht wurde, schließe das Panel
      if (data.id && String(data.id) === String(host.id)) {
        console.log('This host was deleted externally, closing panel...');
        setError('Host wurde extern gelöscht');
        setTimeout(() => {
          if (onClose) onClose();
        }, 2000);
      }
    };
    
    // Connect to SSE and add event listeners
    sseService.connect().then(() => {
      console.log('SSE connected, adding listeners...');
      sseService.addEventListener('host_updated', handleHostUpdated);
      sseService.addEventListener('host_reverted', handleHostReverted);
      sseService.addEventListener('host_deleted', handleHostDeleted);
    }).catch(error => {
      console.error('Failed to connect to SSE:', error);
    });
    
    // Cleanup listeners on unmount
    return () => {
      console.log('Cleaning up SSE listeners for host:', host.id);
      sseService.removeEventListener('host_updated', handleHostUpdated);
      sseService.removeEventListener('host_reverted', handleHostReverted);
      sseService.removeEventListener('host_deleted', handleHostDeleted);
    };
  }, [host]);

  // Fetch SSH keys
  const fetchSSHKeys = async (forceSelectDashboard = false) => {
    try {
      const response = await axios.get('/api/sshKeys');
      if (response.data.success) {
        const keys = response.data.keys || [];
        setSshKeys(keys);
        
        // Wenn keine Keys vorhanden sind, dashboard Key erstellen
        if (keys.length === 0) {
          const token = localStorage.getItem('token');
          if (token) {
            console.log('No SSH keys found, creating dashboard key...');
            await createDashboardKey();
            return; // Nach Erstellung wird fetchSSHKeys erneut aufgerufen
          }
        }
        
        // Bei neuen Hosts oder wenn forceSelectDashboard: Dashboard-Schlüssel auswählen oder erstellen
        if (host?.isNew || forceSelectDashboard) {
          const dashboardKey = keys.find(k => k.keyName === 'dashboard');
          
          if (dashboardKey) {
            // Dashboard-Schlüssel existiert - auswählen
            setSelectedKey('dashboard');
            setFormData(prev => ({ ...prev, sshKeyName: 'dashboard' }));
          } else if (keys.length > 0) {
            // Kein Dashboard-Key aber andere Keys vorhanden - ersten auswählen
            setSelectedKey(keys[0].keyName);
            setFormData(prev => ({ ...prev, sshKeyName: keys[0].keyName }));
          }
        } else if (host && !host.isNew) {
          // Für bestehende Hosts: Den gespeicherten Key setzen
          const hostKeyName = host.sshKeyName || formData.sshKeyName;
          if (hostKeyName) {
            // Prüfen ob der gespeicherte Key existiert
            const existingKey = keys.find(k => k.keyName === hostKeyName);
            if (existingKey) {
              setSelectedKey(hostKeyName);
              console.log('Selected existing key for host:', hostKeyName);
            } else {
              // Key existiert nicht mehr - ersten verfügbaren Key auswählen
              console.warn(`SSH key "${hostKeyName}" not found, selecting first available key`);
              if (keys.length > 0) {
                setSelectedKey(keys[0].keyName);
                handleInputChange('sshKeyName', keys[0].keyName);
              }
            }
          } else if (keys.length > 0) {
            // Kein Key gespeichert aber Keys vorhanden - ersten auswählen
            console.log('No key configured for host, selecting first available');
            setSelectedKey(keys[0].keyName);
            handleInputChange('sshKeyName', keys[0].keyName);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SSH keys:', error);
    }
  };

  // Dashboard SSH-Schlüssel erstellen
  const createDashboardKey = async () => {
    try {
      const response = await axios.post('/api/sshKeys/generate', {
        keyName: 'dashboard',
        keyType: 'rsa',
        keySize: 2048,
        comment: 'Auto-generated dashboard SSH key (OpenSSL)'
      });
      
      if (response.data.success) {
        // SSH-Schlüssel neu laden
        const keysResponse = await axios.get('/api/sshKeys');
        if (keysResponse.data.success) {
          const newKeys = keysResponse.data.keys || [];
          setSshKeys(newKeys);
          // Dashboard-Schlüssel auswählen
          setSelectedKey('dashboard');
          setFormData(prev => ({ ...prev, sshKeyName: 'dashboard' }));
        }
      }
    } catch (error) {
      // Detaillierte Fehlerbehandlung
      if (error.response?.status === 400) {
        // Wahrscheinlich existiert der Schlüssel bereits
        console.log('Dashboard key might already exist, refreshing keys...');
        // Versuche die Keys neu zu laden
        try {
          const keysResponse = await axios.get('/api/sshKeys');
          if (keysResponse.data.success) {
            const newKeys = keysResponse.data.keys || [];
            setSshKeys(newKeys);
            const dashboardKey = newKeys.find(k => k.keyName === 'dashboard');
            if (dashboardKey) {
              setSelectedKey('dashboard');
              setFormData(prev => ({ ...prev, sshKeyName: 'dashboard' }));
            }
          }
        } catch (refreshError) {
          console.error('Error refreshing SSH keys:', refreshError);
        }
      } else if (error.response?.status === 401) {
        console.error('Authentication required for creating SSH keys');
        // User ist nicht eingeloggt
      } else {
        console.error('Error creating dashboard SSH key:', error);
      }
      // Kein Fehler anzeigen, da es im Hintergrund passiert
      // Benutzer kann immer noch manuell einen anderen Schlüssel wählen
    }
  };

  useEffect(() => {
    // Bei neuen Hosts immer Dashboard-Schlüssel auswählen
    const shouldForceSelect = host?.isNew === true;
    fetchSSHKeys(shouldForceSelect);
  }, [host]); // Neu laden wenn sich der Host ändert (wichtig für isNew Status)

  // Reload SSH keys when switching to the "Allgemein" tab
  useEffect(() => {
    if (activeTab === 0) {
      fetchSSHKeys();
    }
  }, [activeTab]);

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Register SSH key on host
  const registerSSHKeyOnHost = async () => {
    if (!selectedKey || !formData.password) {
      setError('Bitte wählen Sie einen Schlüssel und geben Sie das Passwort ein');
      return;
    }

    setRegisteringKey(true);
    try {
      const response = await axios.post('/api/ssh/setup', {
        hostname: formData.name,
        host: formData.hostname,
        username: formData.username,
        password: formData.password,
        port: formData.port,
        keyName: selectedKey,
      });

      if (response.data.success) {
        setSuccess('SSH-Schlüssel erfolgreich auf dem Host registriert');
        // Clear password after successful registration
        handleInputChange('password', '');
      }
    } catch (error) {
      console.error('Error registering SSH key:', error);
      setError(error.response?.data?.error || 'Fehler beim Registrieren des SSH-Schlüssels');
    } finally {
      setRegisteringKey(false);
    }
  };

  // Check RustDesk status and get ID
  const checkRustDeskStatus = async () => {
    if (!host || host.isNew) {
      setError('Host muss zuerst gespeichert werden');
      return;
    }

    setCheckingRustDeskStatus(true);
    try {
      const response = await axios.get(`/api/rustdeskInstall/host/${host.id}/status`);
      
      if (response.data) {
        const status = response.data;
        
        if (status.installed && (status.rustdeskId || status.rustdesk_id)) {
          // RustDesk is installed and we have the ID
          const rustdeskId = status.rustdeskId || status.rustdesk_id;
          handleInputChange('rustdeskId', rustdeskId);
          setSuccess(`RustDesk ID erfolgreich abgerufen: ${rustdeskId}`);
        } else if (status.installed) {
          // Installed but no ID
          setError('RustDesk ist installiert, aber keine ID gefunden. Bitte prüfen Sie die Installation.');
        } else {
          // Not installed - open installer dialog
          console.log('RustDesk not installed, opening installer dialog');
          setShowRustDeskInstaller(true);
        }
      }
    } catch (error) {
      console.error('Error checking RustDesk status:', error);
      // If we get a 404 or similar error, also open the installer
      if (error.response?.status === 404 || error.response?.data?.message?.includes('not installed')) {
        console.log('RustDesk not found, opening installer dialog');
        setShowRustDeskInstaller(true);
      } else {
        setError(error.response?.data?.error || 'Fehler beim Abrufen der RustDesk ID');
      }
    } finally {
      setCheckingRustDeskStatus(false);
    }
  };

  // Helper function to get only changed fields
  const getChangedFields = (original, current) => {
    if (!original) return current; // For new hosts, return all fields
    
    const changes = {};
    const passwordFields = ['password', 'privateKey', 'remotePassword', 'rustdeskPassword'];
    
    Object.keys(current).forEach(key => {
      // Skip password fields completely if they are empty
      // (they come back empty from backend for security, so empty = no change)
      if (passwordFields.includes(key)) {
        // Only include if user actually entered something new
        if (current[key] && current[key] !== '') {
          changes[key] = current[key];
        }
        return;
      }
      
      // Compare values for non-password fields
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

  // Handle save
  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate required fields
      if (!formData.name || !formData.hostname || !formData.username) {
        setError('Bitte füllen Sie alle erforderlichen Felder aus');
        setLoading(false);
        return;
      }

      let dataToSave;
      
      if (host?.isNew) {
        // For new hosts, prepare all fields
        dataToSave = {
          name: formData.name,
          description: formData.description,
          hostname: formData.hostname,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          privateKey: formData.privateKey,
          sshKeyName: selectedKey || null,
          icon: formData.icon,
          color: formData.color,
          transparency: parseFloat(formData.transparency) || 0,
          blur: parseInt(formData.blur) || 0,
          remoteDesktopEnabled: Boolean(formData.remoteDesktopEnabled),
          remoteDesktopType: formData.remoteDesktopType,
          remoteProtocol: formData.remoteProtocol,
          remotePort: formData.remotePort ? parseInt(formData.remotePort) : null,
          remoteUsername: formData.remoteUsername,
          remotePassword: formData.remotePassword,
          guacamolePerformanceMode: formData.guacamolePerformanceMode,
          rustdeskId: formData.rustdeskId,
          rustdeskPassword: formData.rustdeskPassword,
        };
        
        // Clean up empty fields
        if (!dataToSave.password) delete dataToSave.password;
        if (!dataToSave.privateKey) delete dataToSave.privateKey;
        if (!dataToSave.remotePassword) delete dataToSave.remotePassword;
        if (!dataToSave.rustdeskPassword) delete dataToSave.rustdeskPassword;
      } else {
        // For existing hosts, get only changed fields
        const changedFields = getChangedFields(originalFormData, formData);
        
        // Debug: Log what getChangedFields returns
        console.log('getChangedFields result:', changedFields);
        console.log('Original remotePassword:', originalFormData?.remotePassword);
        console.log('Current remotePassword:', formData.remotePassword);
        
        // Check if there are any changes
        if (Object.keys(changedFields).length === 0) {
          setSuccess(true);
          setError('Keine Änderungen vorhanden');
          setTimeout(() => setError(null), 2000);
          setLoading(false);
          return;
        }
        
        // Transform changed fields to backend format
        dataToSave = {};
        Object.keys(changedFields).forEach(key => {
          const value = changedFields[key];
          
          // Special handling for certain fields
          if (key === 'transparency') {
            dataToSave[key] = parseFloat(value) || 0;
          } else if (key === 'blur' || key === 'port' || key === 'remotePort') {
            dataToSave[key] = parseInt(value) || (key === 'port' ? 22 : 0);
          } else if (key === 'remoteDesktopEnabled') {
            dataToSave[key] = Boolean(value);
          } else {
            dataToSave[key] = value;
          }
        });
        
        // Add ssh key if changed
        if (selectedKey !== originalFormData.sshKeyName) {
          dataToSave.sshKeyName = selectedKey || null;
        }
        
        console.log('Saving host - changed fields:', Object.keys(dataToSave));
        console.log('Changed data:', dataToSave);
      }

      if (host?.isNew) {
        const response = await axios.post('/api/hosts', dataToSave);
        if (response.data.success) {
          setSuccess(true);
          onSave(response.data.host.id, response.data.host);
          // Panel bleibt offen - kein onClose()
        }
      } else {
        // Use PATCH for partial updates
        const response = await axios.patch(`/api/hosts/${host.id}`, dataToSave);
        if (response.data.success) {
          setSuccess(true);
          // Update original data after successful save
          setOriginalFormData({ ...formData, sshKeyName: selectedKey });
          const updatedHost = response.data.host || { ...host, ...dataToSave };
          onSave(host.id, updatedHost);
          // Panel bleibt offen - kein onClose()
        }
      }
    } catch (error) {
      console.error('Error saving host:', error);
      setError(error.response?.data?.error || 'Fehler beim Speichern des Hosts');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!host?.id || host.isNew) return;
    
    setLoading(true);
    try {
      await axios.delete(`/api/hosts/${host.id}`);
      onDelete(host);
      onClose();
    } catch (error) {
      console.error('Error deleting host:', error);
      setError('Fehler beim Löschen des Hosts');
      setLoading(false);
    }
  };

  // Handle resize
  const handleMouseDown = (e) => {
    setIsResizing(true);
    const startX = e.pageX;
    const startWidth = panelWidth;

    const handleMouseMove = (e) => {
      const newWidth = startWidth - (e.pageX - startX);
      const clampedWidth = Math.max(400, Math.min(1200, newWidth));
      setPanelWidth(clampedWidth);
      if (onWidthChange) {
        onWidthChange(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('hostPanelWidth', panelWidth);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Card styles
  const cardStyles = {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    mb: 3,
    '.theme-light &': {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
    },
  };

  const textFieldStyles = {
    '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
    '& .MuiInputBase-root': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--container-bg)',
    },
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
      '&.Mui-focused fieldset': { borderColor: 'var(--primary-color)' },
    },
  };

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        width: `${panelWidth}px`,
        height: '100%',
        backgroundColor: 'rgba(118, 118, 128, 0.12)',
        backdropFilter: 'blur(30px) saturate(150%)',
        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        transition: isResizing ? 'none' : 'transform 0.3s ease',
        boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          left: -5,
          top: 0,
          bottom: 0,
          width: 10,
          cursor: 'col-resize',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <GripVertical
          size={16}
          style={{
            position: 'absolute',
            opacity: isResizing ? 1 : 0.5,
            color: 'var(--text-secondary)',
            transition: 'opacity 0.2s',
          }}
        />
      </Box>

      {/* Header */}
      <UnifiedPanelHeader
        title={host?.isNew ? 'Neuer Host' : formData.name || 'Host bearbeiten'}
        icon={Server}
        onClose={onClose}
      />

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 48,
              color: 'var(--text-secondary)',
              '&.Mui-selected': {
                color: 'var(--primary-color)',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--primary-color)',
            },
          }}
        >
          <Tab label="Allgemein" />
          <Tab label="SSH-Schlüssel" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Tab 0: Allgemein */}
        {activeTab === 0 && (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            {/* Grundinformationen Card */}
            <Card sx={cardStyles}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  Grundinformationen
                </Typography>

                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  margin="normal"
                  required
                  placeholder="z.B. Mein Server"
                  sx={textFieldStyles}
                />

                <TextField
                  fullWidth
                  label="Beschreibung"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  margin="normal"
                  multiline
                  rows={2}
                  placeholder="Optionale Beschreibung des Hosts"
                  sx={textFieldStyles}
                />
              </CardContent>
            </Card>

            {/* Verbindungseinstellungen Card */}
            <Card sx={cardStyles}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  Verbindungseinstellungen
                </Typography>

                <TextField
                  fullWidth
                  label="Hostname / IP-Adresse"
                  value={formData.hostname}
                  onChange={(e) => handleInputChange('hostname', e.target.value)}
                  margin="normal"
                  required
                  placeholder="z.B. 192.168.1.100 oder server.local"
                  sx={textFieldStyles}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
                    margin="normal"
                    placeholder="22"
                    sx={{ width: '150px', ...textFieldStyles }}
                  />

                  <TextField
                    fullWidth
                    label="Benutzername"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    margin="normal"
                    required
                    placeholder="z.B. root"
                    sx={textFieldStyles}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Authentifizierung Card */}
            <Card sx={cardStyles}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  Authentifizierung
                </Typography>

                <FormControl fullWidth margin="normal">
                  <InputLabel 
                    id="ssh-key-select-label"
                    sx={{ 
                      color: 'var(--text-secondary)',
                      '&.Mui-focused': {
                        color: 'var(--primary-color)',
                      },
                    }}
                  >
                    SSH-Schlüssel
                  </InputLabel>
                  <Select
                    labelId="ssh-key-select-label"
                    label="SSH-Schlüssel"
                    value={selectedKey || ''}
                    onChange={(e) => {
                      const keyName = e.target.value;
                      setSelectedKey(keyName);
                      handleInputChange('sshKeyName', keyName);
                    }}
                    renderValue={(value) => {
                      if (!value) return <em>Bitte wählen...</em>;
                      const key = sshKeys.find(k => k.keyName === value);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Key size={16} />
                          <span>{value}</span>
                          {key?.isDefault && (
                            <Chip label="Standard" size="small" color="primary" sx={{ ml: 1, height: 20 }} />
                          )}
                        </Box>
                      );
                    }}
                    sx={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--container-bg)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--primary-color)',
                      },
                    }}
                  >
                    {sshKeys.map((key) => (
                      <MenuItem 
                        key={key.id} 
                        value={key.keyName}
                        sx={{ 
                          color: 'var(--text-primary)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <Key size={16} style={{ flexShrink: 0 }} />
                          <span style={{ flexGrow: 1 }}>{key.keyName}</span>
                          {key.isDefault && (
                            <Chip 
                              label="Standard" 
                              size="small" 
                              color="primary" 
                              sx={{ ml: 'auto', height: 20 }} 
                            />
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    label="Passwort"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    margin="normal"
                    placeholder="Optional - für Passwort-Authentifizierung oder Schlüssel-Registrierung"
                    helperText={selectedKey && formData.password ? "Klicken Sie auf 'Schlüssel registrieren' um den ausgewählten SSH-Schlüssel auf dem Host zu hinterlegen" : ""}
                    sx={textFieldStyles}
                  />
                  {formData.password && selectedKey && (
                    <Button
                      variant="outlined"
                      onClick={registerSSHKeyOnHost}
                      disabled={registeringKey}
                      startIcon={registeringKey ? <CircularProgress size={16} /> : <Key size={16} />}
                      sx={{ mt: 2.5, minWidth: '150px' }}
                    >
                      {registeringKey ? 'Registriere...' : 'Schlüssel registrieren'}
                    </Button>
                  )}
                </Box>

                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 2,
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    '& .MuiAlert-icon': {
                      color: 'var(--info-color, #2196f3)'
                    }
                  }}
                >
                  Das Passwort wird nicht gespeichert. Es wird nur zur Authentifizierung für den Schlüsselaustausch benötigt.
                </Alert>
              </CardContent>
            </Card>

            {/* Visuelle Einstellungen Card */}
            <Card sx={cardStyles}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  Visuelle Einstellungen
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom sx={{ color: 'var(--text-secondary)' }}>
                    Icon
                  </Typography>
                  <Box 
                    onClick={() => setShowIconSelector(true)}
                    sx={{
                      width: 60,
                      height: 60,
                      backgroundColor: formData.color || '#007AFF',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <SimpleIcon name={formData.icon} size={32} color="#FFFFFF" />
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography gutterBottom sx={{ color: 'var(--text-secondary)' }}>
                    Farbe
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {COLOR_PRESETS.map((color) => (
                      <IconButton
                        key={color}
                        onClick={() => handleInputChange('color', color)}
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: color,
                          border: formData.color === color ? '3px solid var(--primary-color)' : 'none',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom sx={{ color: 'var(--text-secondary)' }}>
                    Transparenz: {Math.round((1 - formData.transparency) * 100)}%
                  </Typography>
                  <Slider
                    value={formData.transparency}
                    onChange={(e, value) => handleInputChange('transparency', value)}
                    min={0}
                    max={1}
                    step={0.01}
                    sx={{
                      color: 'var(--primary-color)',
                      '& .MuiSlider-thumb': {
                        backgroundColor: 'var(--primary-color)',
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography gutterBottom sx={{ color: 'var(--text-secondary)' }}>
                    Unschärfe: {formData.blur}px
                  </Typography>
                  <Slider
                    value={formData.blur}
                    onChange={(e, value) => handleInputChange('blur', value)}
                    min={0}
                    max={20}
                    sx={{
                      color: 'var(--primary-color)',
                      '& .MuiSlider-thumb': {
                        backgroundColor: 'var(--primary-color)',
                      },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Remote Desktop Card */}
            <Card sx={cardStyles}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  Remote Desktop
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.remoteDesktopEnabled}
                      onChange={(e) => handleInputChange('remoteDesktopEnabled', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-track': {
                          backgroundColor: formData.remoteDesktopEnabled ? 'var(--success-color)' : 'var(--text-tertiary)',
                        },
                      }}
                    />
                  }
                  label="Remote Desktop aktivieren"
                  sx={{ mb: 2, color: 'var(--text-primary)' }}
                />

                {formData.remoteDesktopEnabled && (
                  <>
                    <FormControl fullWidth margin="normal">
                      <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                        Remote Desktop Typ
                      </InputLabel>
                      <Select
                        value={formData.remoteDesktopType}
                        onChange={(e) => handleInputChange('remoteDesktopType', e.target.value)}
                        sx={{
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        }}
                      >
                        <MenuItem value="guacamole">Guacamole</MenuItem>
                        <MenuItem value="rustdesk">RustDesk</MenuItem>
                      </Select>
                    </FormControl>

                    {formData.remoteDesktopType === 'guacamole' && (
                      <>
                        <FormControl fullWidth margin="normal">
                          <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                            Protokoll
                          </InputLabel>
                          <Select
                            value={formData.remoteProtocol}
                            onChange={(e) => handleInputChange('remoteProtocol', e.target.value)}
                            sx={{
                              color: 'var(--text-primary)',
                              backgroundColor: 'var(--container-bg)',
                            }}
                          >
                            <MenuItem value="vnc">VNC</MenuItem>
                            <MenuItem value="rdp">RDP</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          label="Remote Host"
                          value={formData.hostname}
                          disabled
                          margin="normal"
                          helperText="Verwendet den gleichen Host wie die SSH-Verbindung"
                          sx={textFieldStyles}
                        />

                        <TextField
                          fullWidth
                          label="Remote Port"
                          type="number"
                          value={formData.remotePort || (formData.remoteProtocol === 'rdp' ? 3389 : 5900)}
                          onChange={(e) => handleInputChange('remotePort', parseInt(e.target.value) || '')}
                          margin="normal"
                          placeholder={formData.remoteProtocol === 'rdp' ? '3389' : '5900'}
                          sx={textFieldStyles}
                        />

                        <TextField
                          fullWidth
                          label="Remote Benutzername"
                          value={formData.remoteUsername}
                          onChange={(e) => handleInputChange('remoteUsername', e.target.value)}
                          margin="normal"
                          helperText={formData.remoteProtocol === 'vnc' ? 'Optional für VNC' : 'Erforderlich für RDP'}
                          sx={textFieldStyles}
                        />

                        <TextField
                          fullWidth
                          label="Remote Passwort"
                          type="password"
                          value={formData.remotePassword}
                          onChange={(e) => handleInputChange('remotePassword', e.target.value)}
                          margin="normal"
                          helperText="Wird verschlüsselt gespeichert"
                          sx={textFieldStyles}
                        />
                      </>
                    )}

                    {formData.remoteDesktopType === 'rustdesk' && (
                      <>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                          <TextField
                            fullWidth
                            label="RustDesk ID"
                            value={formData.rustdeskId}
                            onChange={(e) => handleInputChange('rustdeskId', e.target.value)}
                            margin="normal"
                            placeholder="z.B. 123456789"
                            helperText="Die RustDesk ID des Remote-Geräts"
                            sx={textFieldStyles}
                          />
                          {!host?.isNew && (
                            <Button
                              variant="outlined"
                              onClick={checkRustDeskStatus}
                              disabled={checkingRustDeskStatus}
                              startIcon={checkingRustDeskStatus ? <CircularProgress size={16} /> : <Monitor size={16} />}
                              sx={{ mt: 2.5, minWidth: '150px' }}
                            >
                              {checkingRustDeskStatus ? 'Prüfe...' : 'RustDesk ID holen'}
                            </Button>
                          )}
                        </Box>

                        <TextField
                          fullWidth
                          label="RustDesk Passwort"
                          type="password"
                          value={formData.rustdeskPassword}
                          onChange={(e) => handleInputChange('rustdeskPassword', e.target.value)}
                          margin="normal"
                          helperText="Wird verschlüsselt gespeichert"
                          sx={textFieldStyles}
                        />

                        <Alert severity="info" sx={{ mt: 2 }}>
                          RustDesk nutzt eine ID-basierte Verbindung. Falls noch nicht installiert, 
                          wird RustDesk automatisch beim ersten Verbindungsversuch installiert.
                        </Alert>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSave}
                disabled={loading || !formData.name || !formData.hostname || !formData.username}
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                sx={{
                  backgroundColor: 'var(--primary-color)',
                  '&:hover': {
                    backgroundColor: 'var(--primary-color-dark)',
                  },
                }}
              >
                {loading ? 'Speichern...' : 'Speichern'}
              </Button>

              {adminMode && !host?.isNew && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  startIcon={<Trash2 />}
                  sx={{
                    borderColor: '#FF3B30',
                    color: '#FF3B30',
                    '&:hover': {
                      borderColor: '#FF3B30',
                      backgroundColor: 'rgba(255, 59, 48, 0.1)',
                    },
                  }}
                >
                  Löschen
                </Button>
              )}
            </Box>
          </Box>
        )}

        {/* Tab 1: SSH-Schlüssel */}
        {activeTab === 1 && (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            <SSHKeyManagement
              selectedKeyName={selectedKey}
              onKeyCreated={(keyName) => {
                fetchSSHKeys();
                // Automatisch den neu erstellten Schlüssel auswählen
                if (keyName) {
                  setSelectedKey(keyName);
                  handleInputChange('sshKeyName', keyName);
                }
              }}
              onKeyDeleted={() => {
                fetchSSHKeys();
                // Wenn der gelöschte Key der ausgewählte war, zurücksetzen
                setSelectedKey(null);
                handleInputChange('sshKeyName', null);
              }}
              adminMode={adminMode}
            />
          </Box>
        )}
      </Box>

      {/* Success/Error Messages */}
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccess(false)} severity="success">
          {typeof success === 'string' ? success : 'Host erfolgreich gespeichert!'}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <DialogTitle>Host löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie den Host "{formData.name}" wirklich löschen?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Icon Selector Modal */}
      {showIconSelector && (
        <IconSelector
          selectedIcon={formData.icon}
          onIconSelect={(icon) => {
            handleInputChange('icon', icon);
            setShowIconSelector(false);
          }}
          onClose={() => setShowIconSelector(false)}
        />
      )}

      {/* RustDesk Installer Dialog */}
      {showRustDeskInstaller && host && (
        <RustDeskInstaller
          open={showRustDeskInstaller}
          onClose={() => setShowRustDeskInstaller(false)}
          appliance={host}
          onSuccess={(rustdeskId) => {
            console.log('RustDesk installation successful, ID:', rustdeskId);
            handleInputChange('rustdeskId', rustdeskId);
            setSuccess(`RustDesk erfolgreich installiert! ID: ${rustdeskId}`);
            setShowRustDeskInstaller(false);
          }}
        />
      )}
    </Box>
  );
};

export default HostPanel;