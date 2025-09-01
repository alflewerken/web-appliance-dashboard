import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import SSHKeyManagement from '../SettingsPanel/SSHKeyManagement';
import sseService from '../../services/sseService';
import { usePanelResize, getPanelStyles, getResizeHandleStyles } from '../../hooks/usePanelResize';
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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [registeringKey, setRegisteringKey] = useState(false);
  const [checkingRustDeskStatus, setCheckingRustDeskStatus] = useState(false);
  const [showRustDeskInstaller, setShowRustDeskInstaller] = useState(false);
  
  // Use the unified resize hook
  const { panelWidth, isResizing, startResize, panelRef } = usePanelResize(
    'hostPanelWidth',
    defaultWidth,
    onWidthChange
  );

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

  // Theme and UI Settings state
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [uiSettings, setUiSettings] = useState({
    cardTransparency: 85,
    cardBlur: 5,
    cardTint: 0,
    inputTransparency: 95,
    inputTint: 0
  });

  // Monitor theme changes
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.body.classList.contains('theme-light')
        ? 'light'
        : 'dark';
      setCurrentTheme(theme);
    };

    checkTheme();

    // Observer für Theme-Änderungen
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Monitor UI settings changes
  useEffect(() => {
    const loadUISettings = () => {
      try {
        const stored = localStorage.getItem('ui_settings');
        if (stored) {
          setUiSettings(JSON.parse(stored));
        }
      } catch (e) {
        // Use defaults if parsing fails
      }
    };

    loadUISettings();

    // Listen for storage events
    const handleStorageChange = (e) => {
      if (e.key === 'ui_settings') {
        loadUISettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events from same window
    const handleUISettingsChange = () => {
      loadUISettings();
    };
    
    window.addEventListener('uiSettingsChanged', handleUISettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('uiSettingsChanged', handleUISettingsChange);
    };
  }, []);

  // Helper function for card styles based on theme and UI settings
  const getCardStyles = () => {
    const isLight = currentTheme === 'light';
    
    const transparency = uiSettings.cardTransparency / 100;
    const blurAmount = uiSettings.cardBlur || 5;
    const tint = uiSettings.cardTint;
    
    // Calculate RGB values based on tint
    let r, g, b;
    if (isLight) {
      // Light mode: base is white
      const baseValue = 255;
      const adjustment = Math.round((tint / 100) * 50);
      r = g = b = Math.max(0, Math.min(255, baseValue - adjustment));
    } else {
      // Dark mode: base is black  
      const baseValue = 0;
      const adjustment = Math.round((tint / 100) * 50);
      r = g = b = Math.max(0, Math.min(255, baseValue + adjustment));
    }
    
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${transparency})`,
      backdropFilter: `blur(${blurAmount}px)`,
      WebkitBackdropFilter: `blur(${blurAmount}px)`,
      borderRadius: '12px',
      border: isLight
        ? '1px solid rgba(0, 0, 0, 0.1)'
        : '1px solid rgba(255, 255, 255, 0.08)',
    };
  };

  // Helper function for input styles based on theme and UI settings
  const getInputStyles = () => {
    const isLight = currentTheme === 'light';
    
    const transparency = uiSettings.inputTransparency / 100;
    const tint = uiSettings.inputTint;
    
    // Calculate RGB values based on tint
    let r, g, b;
    if (isLight) {
      // Light mode: base is white
      const baseValue = 255;
      const adjustment = Math.round((tint / 100) * 30);
      r = g = b = Math.max(0, Math.min(255, baseValue - adjustment));
    } else {
      // Dark mode: base is black
      const baseValue = 0;
      const adjustment = Math.round((tint / 100) * 30);
      r = g = b = Math.max(0, Math.min(255, baseValue + adjustment));
    }
    
    return {
      '& .MuiInputLabel-root': { 
        color: 'var(--text-secondary)' 
      },
      '& .MuiInputBase-root': {
        color: 'var(--text-primary)',
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${transparency})`,
      },
      '& .MuiOutlinedInput-root': {
        '& fieldset': {
          borderColor: isLight 
            ? 'rgba(0, 0, 0, 0.23)'
            : 'rgba(255, 255, 255, 0.2)',
        },
        '&:hover fieldset': {
          borderColor: isLight 
            ? 'rgba(0, 0, 0, 0.3)'
            : 'rgba(255, 255, 255, 0.3)',
        },
        '&.Mui-focused fieldset': {
          borderColor: 'var(--accent-color)',
        },
      },
      '& .MuiFormHelperText-root': { 
        color: 'var(--text-tertiary)' 
      },
    };
  };

  // Helper for Select components
  const getSelectStyles = () => {
    const isLight = currentTheme === 'light';
    
    const transparency = uiSettings.inputTransparency / 100;
    const tint = uiSettings.inputTint;
    
    // Calculate RGB values based on tint
    let r, g, b;
    if (isLight) {
      const baseValue = 255;
      const adjustment = Math.round((tint / 100) * 30);
      r = g = b = Math.max(0, Math.min(255, baseValue - adjustment));
    } else {
      const baseValue = 0;
      const adjustment = Math.round((tint / 100) * 30);
      r = g = b = Math.max(0, Math.min(255, baseValue + adjustment));
    }
    
    return {
      color: 'var(--text-primary)',
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${transparency})`,
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: isLight 
          ? 'rgba(0, 0, 0, 0.23)'
          : 'rgba(255, 255, 255, 0.2)',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: isLight 
          ? 'rgba(0, 0, 0, 0.3)'
          : 'rgba(255, 255, 255, 0.3)',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--accent-color)',
      },
      '& .MuiSvgIcon-root': {
        color: 'var(--text-secondary)',
      },
    };
  };

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

      } else {
        setSelectedKey(null);

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

    const handleHostUpdated = async (data) => {

      // Wenn dieser Host aktualisiert wurde, lade die neuen Daten
      // Vergleiche IDs als Strings für Typ-Sicherheit
      if (data.id && String(data.id) === String(host.id)) {

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
            setSuccess(t('hosts.success.hostReloadedExternally'));
          }
        } catch (error) {
          console.error('Error reloading host data:', error);
          setError(t('hosts.errors.reloadFailed'));
        }
      }
    };
    
    const handleHostReverted = handleHostUpdated; // Gleiche Behandlung für revert
    
    const handleHostDeleted = (data) => {

      // Wenn dieser Host gelöscht wurde, schließe das Panel
      if (data.id && String(data.id) === String(host.id)) {

        setError(t('hosts.errors.hostDeletedExternally'));
        setTimeout(() => {
          if (onClose) onClose();
        }, 2000);
      }
    };
    
    // Connect to SSE and add event listeners
    sseService.connect().then(() => {

      sseService.addEventListener('host_updated', handleHostUpdated);
      sseService.addEventListener('host_reverted', handleHostReverted);
      sseService.addEventListener('host_deleted', handleHostDeleted);
    }).catch(error => {
      console.error('Failed to connect to SSE:', error);
    });
    
    // Cleanup listeners on unmount
    return () => {

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

            } else {
              // Key existiert nicht mehr - ersten verfügbaren Key auswählen

              if (keys.length > 0) {
                setSelectedKey(keys[0].keyName);
                handleInputChange('sshKeyName', keys[0].keyName);
              }
            }
          } else if (keys.length > 0) {
            // Kein Key gespeichert aber Keys vorhanden - ersten auswählen

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
      setError(t('hosts.errors.selectKeyAndPassword'));
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
        setSuccess(t('hosts.success.sshKeyRegistered'));
        // Clear password after successful registration
        handleInputChange('password', '');
      }
    } catch (error) {
      console.error('Error registering SSH key:', error);
      setError(error.response?.data?.error || t('hosts.errors.registerKeyFailed'));
    } finally {
      setRegisteringKey(false);
    }
  };

  // Check RustDesk status and get ID
  const checkRustDeskStatus = async () => {
    if (!host || host.isNew) {
      setError(t('hosts.errors.hostMustBeSaved'));
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

          setShowRustDeskInstaller(true);
        }
      }
    } catch (error) {
      console.error('Error checking RustDesk status:', error);
      // If we get a 404 or similar error, also open the installer
      if (error.response?.status === 404 || error.response?.data?.message?.includes('not installed')) {

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
      setError(error.response?.data?.error || t('hosts.errors.saveFailed'));
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
      setError(t('hosts.errors.deleteFailed'));
      setLoading(false);
    }
  };

  // Card styles
  const cardStyles = {
    ...getCardStyles(),
    mb: 3,
    '.theme-light &': {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
    },
  };

  const textFieldStyles = getInputStyles();

  return (
    <Box
      ref={panelRef}
      style={{ width: `${panelWidth}px` }} // Width als style für Safari-Kompatibilität
      sx={getPanelStyles(isResizing)}
    >
      {/* Resize Handle mit Touch-Support */}
      <Box
        onMouseDown={startResize}
        onTouchStart={startResize}
        onPointerDown={startResize}
        sx={getResizeHandleStyles()}
      />

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
          <Tab label={t('hosts.tabs.general')} />
          <Tab label={t('hosts.tabs.sshKeys')} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Tab 0: Allgemein */}
        {activeTab === 0 && (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            {/* Grundinformationen Card */}
            <Card className="settings-card" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  {t('hosts.sections.basicInfo')}
                </Typography>

                <TextField
                  fullWidth
                  label={t('hosts.name')}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  margin="normal"
                  required
                  placeholder={t('hosts.placeholders.name')}
                  sx={textFieldStyles}
                />

                <TextField
                  fullWidth
                  label={t('hosts.description')}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  margin="normal"
                  multiline
                  rows={2}
                  placeholder={t('hosts.placeholders.description')}
                  sx={textFieldStyles}
                />
              </CardContent>
            </Card>

            {/* Verbindungseinstellungen Card */}
            <Card className="settings-card" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  {t('hosts.sections.connectionSettings')}
                </Typography>

                <TextField
                  fullWidth
                  label={t('hosts.hostname')}
                  value={formData.hostname}
                  onChange={(e) => handleInputChange('hostname', e.target.value)}
                  margin="normal"
                  required
                  placeholder={t('hosts.placeholders.hostname')}
                  sx={textFieldStyles}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label={t('hosts.port')}
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
                    margin="normal"
                    placeholder="22"
                    sx={{ width: '150px', ...textFieldStyles }}
                  />

                  <TextField
                    fullWidth
                    label={t('hosts.username')}
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    margin="normal"
                    required
                    placeholder={t('hosts.placeholders.username')}
                    sx={textFieldStyles}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Authentifizierung Card */}
            <Card className="settings-card" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  {t('hosts.sections.authentication')}
                </Typography>

                <FormControl fullWidth margin="normal">
                  <InputLabel 
                    id="ssh-key-select-label"
                  >
                  >
                    {t('hosts.sshKey')}
                  </InputLabel>
                  <Select
                    labelId="ssh-key-select-label"
                    label={t('hosts.sshKey')}
                    value={selectedKey || ''}
                    onChange={(e) => {
                      const keyName = e.target.value;
                      setSelectedKey(keyName);
                      handleInputChange('sshKeyName', keyName);
                    }}
                    renderValue={(value) => {
                      if (!value) return <em>{t('common.pleaseSelect')}</em>;
                      const key = sshKeys.find(k => k.keyName === value);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Key size={16} />
                          <span>{value}</span>
                          {key?.isDefault && (
                            <Chip label={t('common.default')} size="small" color="primary" sx={{ ml: 1, height: 20 }} />
                          )}
                        </Box>
                      );
                    }}
                    sx={getSelectStyles()}
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
                              label={t('common.default')}
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
                    label={t('hosts.password')}
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    margin="normal"
                    placeholder={t('hosts.placeholders.passwordOptional')}
                    helperText={selectedKey && formData.password ? t('hosts.registerKeyHint') : ""}
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
                      {registeringKey ? t('common.registering') : t('hosts.buttons.registerKey')}
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
                  {t('hosts.passwordNotSaved')}
                </Alert>
              </CardContent>
            </Card>

            {/* Visuelle Einstellungen Card */}
            <Card className="settings-card" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  {t('hosts.sections.appearance')}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography gutterBottom sx={{ color: 'var(--text-secondary)' }}>
                    {t('common.icon')}
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
                    {t('common.color')}
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
                    {t('hosts.appearance.transparency')}: {Math.round((1 - formData.transparency) * 100)}%
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
                    {t('hosts.appearance.blur')}: {formData.blur}px
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
            <Card className="settings-card" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'var(--text-primary)' }}>
                  {t('hosts.sections.remoteDesktop')}
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
                  label={t('hosts.remoteDesktop.enable')}
                  sx={{ mb: 2, color: 'var(--text-primary)' }}
                />

                {formData.remoteDesktopEnabled && (
                  <>
                    <FormControl fullWidth margin="normal">
                      <InputLabel>
                        {t('hosts.remoteDesktop.type')}
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
                          <InputLabel>
                            {t('hosts.remoteDesktop.protocol')}
                          </InputLabel>
                          <Select
                            value={formData.remoteProtocol}
                            onChange={(e) => handleInputChange('remoteProtocol', e.target.value)}
                            sx={getSelectStyles()}
                          >
                            <MenuItem value="vnc">VNC</MenuItem>
                            <MenuItem value="rdp">RDP</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          label={t('hosts.remoteDesktop.remoteHost')}
                          value={formData.hostname}
                          disabled
                          margin="normal"
                          helperText={t('hosts.remoteDesktop.useSameHost')}
                          sx={textFieldStyles}
                        />

                        <TextField
                          fullWidth
                          label={t('hosts.remoteDesktop.remotePort')}
                          type="number"
                          value={formData.remotePort || (formData.remoteProtocol === 'rdp' ? 3389 : 5900)}
                          onChange={(e) => handleInputChange('remotePort', parseInt(e.target.value) || '')}
                          margin="normal"
                          placeholder={formData.remoteProtocol === 'rdp' ? '3389' : '5900'}
                          sx={textFieldStyles}
                        />

                        <TextField
                          fullWidth
                          label={t('hosts.remoteDesktop.remoteUsername')}
                          value={formData.remoteUsername}
                          onChange={(e) => handleInputChange('remoteUsername', e.target.value)}
                          margin="normal"
                          helperText={formData.remoteProtocol === 'vnc' ? t('hosts.remoteDesktop.optionalForVNC') : t('hosts.remoteDesktop.requiredForRDP')}
                          sx={textFieldStyles}
                        />

                        <TextField
                          fullWidth
                          label={t('hosts.remoteDesktop.remotePassword')}
                          type="password"
                          value={formData.remotePassword}
                          onChange={(e) => handleInputChange('remotePassword', e.target.value)}
                          margin="normal"
                          helperText={t('hosts.remoteDesktop.encryptedStorage')}
                          sx={textFieldStyles}
                        />
                      </>
                    )}

                    {formData.remoteDesktopType === 'rustdesk' && (
                      <>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                          <TextField
                            fullWidth
                            label={t('hosts.remoteDesktop.rustDeskId')}
                            value={formData.rustdeskId}
                            onChange={(e) => handleInputChange('rustdeskId', e.target.value)}
                            margin="normal"
                            placeholder={t('hosts.placeholders.rustdeskId')}
                            helperText={t('hosts.remoteDesktop.rustDeskIdHelp')}
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
                              {checkingRustDeskStatus ? t('common.checking') : t('hosts.remoteDesktop.getRustDeskId')}
                            </Button>
                          )}
                        </Box>

                        <TextField
                          fullWidth
                          label={t('hosts.remoteDesktop.rustDeskPassword')}
                          type="password"
                          value={formData.rustdeskPassword}
                          onChange={(e) => handleInputChange('rustdeskPassword', e.target.value)}
                          margin="normal"
                          helperText={t('hosts.remoteDesktop.encryptedStorage')}
                          sx={textFieldStyles}
                        />

                        <Alert severity="info" sx={{ mt: 2 }}>
                          {t('hosts.remoteDesktop.rustDeskInfo')}
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
                {loading ? t('common.saving') : t('common.save')}
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
                  {t('common.delete')}
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
        <DialogTitle>{t('hosts.confirmDelete.title')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('hosts.confirmDelete.message', { name: formData.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {t('common.delete')}
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

            handleInputChange('rustdeskId', rustdeskId);
            setSuccess(t('hosts.success.rustDeskInstalled', { id: rustdeskId }));
            setShowRustDeskInstaller(false);
          }}
        />
      )}
    </Box>
  );
};

export default HostPanel;