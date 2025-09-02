import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import RustDeskInstaller from '../RemoteDesktop/RustDeskInstaller';
import RustDeskSetupDialog from '../RemoteDesktop/RustDeskSetupDialog';
import { usePanelResize, getPanelStyles, getResizeHandleStyles } from '../../hooks/usePanelResize';
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
  Command,
  GripVertical,
  Plus,
  Edit2,
  Play,
  Server,
  Search,
  Monitor,
} from 'lucide-react';
import SimpleIcon from '../SimpleIcon';
import IconSelector from '../IconSelector';
import { COLOR_PRESETS } from '../../utils/constants';
import { getAvailableIcons } from '../../utils/iconMap';
import AnsiToHtml from 'ansi-to-html';
import TTYDTerminal from './TTYDTerminal';
import axios from '../../utils/axiosConfig';
import './ServicePanel.css';

// ANSI to HTML converter for colored output
const ansiConverter = new AnsiToHtml({
  fg: '#FFF',
  bg: '#000',
  newline: true,
  escapeXML: true,
  stream: false,
  colors: {
    0: '#000000',
    1: '#CC0000',
    2: '#4E9A06',
    3: '#C4A000',
    4: '#3465A4',
    5: '#75507B',
    6: '#06989A',
    7: '#D3D7CF',
    8: '#555753',
    9: '#EF2929',
    10: '#8AE234',
    11: '#FCE94F',
    12: '#729FCF',
    13: '#AD7FA8',
    14: '#34E2E2',
    15: '#EEEEEC',
  },
});

const ServicePanel = ({
  appliance,
  initialTab,
  onClose,
  onSave,
  onDelete,
  onUpdateSettings,
  categories,
  allServices,
  sshHosts = [],
  isLoadingSSHHosts = false,
  adminMode = false,
  onWidthChange,
}) => {
  // Store original data for comparison
  const [originalFormData, setOriginalFormData] = useState(null);

  // Form state for service editing
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    icon: 'Server',
    color: '#007AFF',
    category: '',
    sshConnection: '',
    statusCommand: '',
    startCommand: '',
    stopCommand: '',
    isFavorite: false,
    openModeMini: 'browser_tab',
    openModeMobile: 'browser_tab',
    openModeDesktop: 'browser_tab',
    remoteDesktopEnabled: false,
    remoteDesktopType: 'guacamole',
    remoteProtocol: 'vnc',
    remoteHost: '',
    remotePort: null,
    remoteUsername: '',
    remotePassword: '',
    guacamolePerformanceMode: 'balanced',
    rustdeskId: '',
    rustdeskPassword: '',
  });

  // Visual settings state
  const [visualSettings, setVisualSettings] = useState({
    transparency: 10,
    blur: 5,
  });

  // UI state
  const [activeTabIndex, setActiveTabIndex] = useState(() => {
    // Map tab names to indices - nur noch 2 Tabs!
    const tabMap = { 'commands': 0, 'service': 1 };
    
    // Use initialTab if provided, otherwise default to 'commands' 
    if (initialTab && tabMap.hasOwnProperty(initialTab)) {
      return tabMap[initialTab];
    }
    // Always start with 'commands' tab (index 0) as default
    return 0;
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Custom Commands state
  const [commands, setCommands] = useState([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState(false);
  const [editingCommand, setEditingCommand] = useState(null);
  const [newCommand, setNewCommand] = useState({
    description: '',
    command: '',
    hostId: null,
  });
  const [executingCommandId, setExecutingCommandId] = useState(null);
  const [commandOutput, setCommandOutput] = useState({});
  const [defaultHostId, setDefaultHostId] = useState(null);
  const [showCommandSelection, setShowCommandSelection] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showNewCommandForm, setShowNewCommandForm] = useState(false);

  // Command Templates state
  const [availableCommands, setAvailableCommands] = useState([]);
  const [groupedCommands, setGroupedCommands] = useState({});
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // RustDesk state
  const [showRustDeskDialog, setShowRustDeskDialog] = useState(false);
  const [rustDeskStatus, setRustDeskStatus] = useState(null);
  const [checkingRustDeskStatus, setCheckingRustDeskStatus] = useState(false);

  // Theme state
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
      const adjustment = Math.round((tint / 100) * 50); // Max ±50 adjustment
      r = g = b = Math.max(0, Math.min(255, baseValue - adjustment));
    } else {
      // Dark mode: base is black  
      const baseValue = 0;
      const adjustment = Math.round((tint / 100) * 50); // Max ±50 adjustment
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
      const adjustment = Math.round((tint / 100) * 30); // Max ±30 adjustment for inputs
      r = g = b = Math.max(0, Math.min(255, baseValue - adjustment));
    } else {
      // Dark mode: base is black
      const baseValue = 0;
      const adjustment = Math.round((tint / 100) * 30); // Max ±30 adjustment for inputs
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

  // EINHEITLICHER RESIZE-HOOK (ersetzt alten Code)
  const { panelWidth, isResizing, startResize, panelRef } = usePanelResize(
    'servicePanelWidth',
    600,
    onWidthChange
  );

  // Refs
  const updateTimeoutRef = useRef(null);

  // Get current tab name from index
  const getTabFromIndex = (index) => {
    const tabs = ['commands', 'service'];
    return tabs[index] || 'commands';
  };

  // Helper function to get only changed fields
  const getChangedFields = (original, current) => {
    if (!original) return current; // If no original data, return all fields (new appliance)
    
    const changes = {};
    const skipFields = ['remotePassword', 'rustdeskPassword']; // Fields that should always be included if not empty
    
    Object.keys(current).forEach(key => {
      // Always include password fields if they have a value (user entered new password)
      if (skipFields.includes(key)) {
        if (current[key] && current[key] !== '') {
          changes[key] = current[key];
        }
        return;
      }
      
      // Compare values - handle different types
      let originalValue = original[key];
      let currentValue = current[key];
      
      // Normalize null/undefined to empty string for comparison
      if (originalValue === null || originalValue === undefined) originalValue = '';
      if (currentValue === null || currentValue === undefined) currentValue = '';
      
      // Convert both to strings for comparison (handles number/string differences)
      const originalStr = String(originalValue);
      const currentStr = String(currentValue);
      
      // Only include field if it has changed
      if (originalStr !== currentStr) {
        changes[key] = current[key];
      }
    });
    
    return changes;
  };

  // Extract host from URL
  const extractHostFromUrl = (url) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      // If URL parsing fails, try to extract manually
      const match = url.match(/^(?:https?:\/\/)?([^\/\:]+)/i);
      return match ? match[1] : '';
    }
  };

  // Initialize form data when appliance changes
  useEffect(() => {

    if (appliance) {

      const initialData = {
        name: appliance.name || '',
        url: appliance.url || '',
        description: appliance.description || '',
        icon: appliance.icon || 'Server',
        color: appliance.color || '#007AFF',
        category: appliance.category || '',
        sshConnection: appliance.sshConnection || '',
        statusCommand: appliance.statusCommand || '',
        startCommand: appliance.startCommand || '',
        stopCommand: appliance.stopCommand || '',
        isFavorite: appliance.isFavorite || false,
        openModeMini: appliance.openModeMini || 'browser_tab',
        openModeMobile: appliance.openModeMobile || 'browser_tab',
        openModeDesktop: appliance.openModeDesktop || 'browser_tab',
        remoteDesktopEnabled: appliance.remoteDesktopEnabled || false,
        remoteDesktopType: appliance.remoteDesktopType || 'guacamole',
        remoteProtocol: appliance.remoteProtocol || 'vnc',
        remoteHost: appliance.remoteHost || extractHostFromUrl(appliance.url) || '',
        remotePort: appliance.remotePort || null,
        remoteUsername: appliance.remoteUsername || '',
        remotePassword: '', // Passwort wird nicht vom Server zurückgegeben
        guacamolePerformanceMode: appliance.guacamolePerformanceMode || appliance.guacamole_performance_mode || 'balanced',
        rustdeskId: appliance.rustdeskId || appliance.rustdesk_id || '',
        rustdeskPassword: '', // RustDesk Passwort wird nicht vom Server zurückgegeben
        rustdeskInstalled: appliance.rustdeskInstalled || appliance.rustdesk_installed || false,
        transparency: appliance.transparency ?? 0.85,
        blur: appliance.blur !== undefined ? appliance.blur : 8,
      };

      setFormData(initialData);
      
      // Store original data for comparison when saving (including visual settings)
      setOriginalFormData({
        ...initialData,
        transparency: initialData.transparency ?? 0.85,
        blur: initialData.blur !== undefined ? initialData.blur : 8
      });

      // Convert transparency from 0-1 range to 0-100 percentage
      // Note: In ApplianceCard, 1 = fully opaque, 0 = fully transparent
      // In our slider, 100 = fully opaque, 0 = fully transparent
      const transparencyPercentage = Math.round(
        (appliance.transparency || 0.85) * 100
      );

      setVisualSettings({
        transparency: transparencyPercentage,
        blur: appliance.blur !== undefined ? appliance.blur : 8,
      });

      // Set default SSH host based on appliance's SSH connection
      if (appliance.sshConnection && sshHosts.length > 0) {
        const matchingHost = sshHosts.find(host => {
          const hostValue = `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
          return hostValue === appliance.sshConnection;
        });
        if (matchingHost) {
          setDefaultHostId(matchingHost.id);
          if (!newCommand.hostId) {
            setNewCommand(prev => ({ ...prev, hostId: matchingHost.id }));
          }
        }
      }

      // Switch to the requested tab if initialTab is provided
      if (
        initialTab &&
        ['service', 'visual', 'commands'].includes(initialTab) &&
        !appliance.isNew
      ) {
        const tabMap = { 'commands': 0, 'service': 1 };
        setActiveTabIndex(tabMap[initialTab]);
      }
    }
  }, [appliance, sshHosts, initialTab]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Subscribe to SSE events for real-time updates
  useEffect(() => {
    if (!appliance || appliance.isNew) return; // Only for existing appliances

    const handleApplianceUpdated = async (data) => {

      // Check if this appliance was updated - compare IDs as strings for type safety
      if (data.id && String(data.id) === String(appliance.id)) {

        try {
          const response = await axios.get(`/api/appliances/${appliance.id}`);
          if (response.data) {
            const updatedAppliance = response.data;
            const updatedData = {
              name: updatedAppliance.name || '',
              url: updatedAppliance.url || '',
              description: updatedAppliance.description || '',
              icon: updatedAppliance.icon || 'Server',
              color: updatedAppliance.color || '#007AFF',
              category: updatedAppliance.category || '',
              sshConnection: updatedAppliance.sshConnection || '',
              statusCommand: updatedAppliance.statusCommand || '',
              startCommand: updatedAppliance.startCommand || '',
              stopCommand: updatedAppliance.stopCommand || '',
              isFavorite: updatedAppliance.isFavorite || false,
              openModeMini: updatedAppliance.openModeMini || 'browser_tab',
              openModeMobile: updatedAppliance.openModeMobile || 'browser_tab',
              openModeDesktop: updatedAppliance.openModeDesktop || 'browser_tab',
              remoteDesktopEnabled: updatedAppliance.remoteDesktopEnabled || false,
              remoteDesktopType: updatedAppliance.remoteDesktopType || 'guacamole',
              remoteProtocol: updatedAppliance.remoteProtocol || 'vnc',
              remoteHost: updatedAppliance.remoteHost || extractHostFromUrl(updatedAppliance.url) || '',
              remotePort: updatedAppliance.remotePort || null,
              remoteUsername: updatedAppliance.remoteUsername || '',
              remotePassword: '', // Password not returned from server
              guacamolePerformanceMode: updatedAppliance.guacamolePerformanceMode || 'balanced',
              rustdeskId: updatedAppliance.rustdeskId || '',
              rustdeskPassword: '', // Password not returned from server
              rustdeskInstalled: updatedAppliance.rustdeskInstalled || false,
              transparency: updatedAppliance.transparency ?? 0.85,
              blur: updatedAppliance.blur !== undefined ? updatedAppliance.blur : 8,
            };
            
            setFormData(updatedData);
            setOriginalFormData(updatedData);
            
            // Update visual settings
            const transparencyPercentage = Math.round(
              (updatedAppliance.transparency || 0.85) * 100
            );
            setVisualSettings({
              transparency: transparencyPercentage,
              blur: updatedAppliance.blur !== undefined ? updatedAppliance.blur : 8,
            });
            
            setSuccess('Appliance wurde extern aktualisiert und neu geladen');
          }
        } catch (error) {
          console.error('Error reloading appliance data:', error);
          setError(t('services.errorReloadingApplianceData'));
        }
      }
    };
    
    const handleApplianceDeleted = (data) => {

      // Check if this appliance was deleted
      if (data.id && String(data.id) === String(appliance.id)) {

        setError('Appliance wurde extern gelöscht');
        setTimeout(() => {
          if (onClose) onClose();
        }, 2000);
      }
    };
    
    const handleApplianceRestored = handleApplianceUpdated; // Same treatment as update
    
    // Connect to SSE and add event listeners
    sseService.connect().then(() => {

      sseService.addEventListener('appliance_updated', handleApplianceUpdated);
      sseService.addEventListener('appliance_deleted', handleApplianceDeleted);
      sseService.addEventListener('appliance_restored', handleApplianceRestored);
      sseService.addEventListener('appliance_patched', handleApplianceUpdated); // PATCH also triggers update
    }).catch(error => {
      console.error('Failed to connect to SSE:', error);
    });
    
    // Cleanup listeners on unmount
    return () => {

      sseService.removeEventListener('appliance_updated', handleApplianceUpdated);
      sseService.removeEventListener('appliance_deleted', handleApplianceDeleted);
      sseService.removeEventListener('appliance_restored', handleApplianceRestored);
      sseService.removeEventListener('appliance_patched', handleApplianceUpdated);
    };
  }, [appliance, onClose]);

  // Load commands when switching to commands tab
  useEffect(() => {
    const currentTab = getTabFromIndex(activeTabIndex);
    if (currentTab === 'commands' && appliance?.id && !appliance?.isNew) {
      fetchCommands();
      fetchAvailableCommands();
    }
  }, [activeTabIndex, appliance?.id]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-update remote host when URL changes
      if (field === 'url') {
        updated.remoteHost = extractHostFromUrl(value);
      }
      
      return updated;
    });
  };

  // Handle visual settings changes
  const handleVisualChange = (field, value) => {
    setVisualSettings(prev => ({ ...prev, [field]: value }));
  };

  // Debounced update function - DEAKTIVIERT um SSE-Flooding zu vermeiden
  // Die Updates erfolgen jetzt nur noch beim Loslassen des Sliders
  /*
  const debouncedUpdate = useCallback(
    settings => {
      // Clear any existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set new timeout for update
      updateTimeoutRef.current = setTimeout(() => {
        if (onUpdateSettings) {
          onUpdateSettings(appliance.id, settings);
        }
      }, 50); // 50ms debounce
    },
    [appliance?.id, onUpdateSettings]
  );
  */

  // Save service data
  const handleSaveService = async () => {
    try {
      setLoading(true);
      setError('');

      // Convert transparency from percentage (0-100) to fraction (0-1)
      const transparencyValue = visualSettings.transparency / 100;
      
      // Merge visual settings into form data
      const dataWithVisualSettings = {
        ...formData,
        transparency: transparencyValue,
        blur: visualSettings.blur
      };

      // Get only changed fields for existing appliances
      let dataToSave;
      if (appliance?.isNew) {
        // For new appliances, send all fields
        dataToSave = { ...dataWithVisualSettings };
      } else {
        // For existing appliances, send only changed fields
        console.log('[ServicePanel] Original form data:', originalFormData);
        console.log('[ServicePanel] Current data with visual:', dataWithVisualSettings);
        dataToSave = getChangedFields(originalFormData, dataWithVisualSettings);
        console.log('[ServicePanel] Changed fields detected:', dataToSave);
        
        // Check if there are any changes
        if (Object.keys(dataToSave).length === 0) {
          setSuccess('Keine Änderungen vorhanden');
          setLoading(false);
          return;
        }
      }
      
      // If RustDesk ID is provided, mark as installed
      if (dataToSave.rustdeskId) {
        dataToSave.rustdeskInstalled = true;
      }
      
      // Debug logging to see what fields are being sent
      console.log('[ServicePanel] Sending data to save:', dataToSave);
      console.log('[ServicePanel] Visual settings:', visualSettings);
      console.log('[ServicePanel] Merged data:', dataWithVisualSettings);

      await onSave(appliance?.id, dataToSave);
      
      // Update original data after successful save (for existing appliances)
      if (!appliance?.isNew) {
        setOriginalFormData({ ...dataWithVisualSettings });
      }

      setSuccess(
        appliance?.isNew
          ? t('services.serviceCreated')
          : t('services.serviceUpdated')
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err.message ||
          (appliance?.isNew
            ? t('services.errorCreatingService')
            : t('services.errorSavingService'))
      );
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Save visual settings
  const handleSaveVisual = async () => {
    try {
      setLoading(true);
      setError('');

      if (onUpdateSettings) {
        await onUpdateSettings(appliance.id, {
          ...formData,
          transparency: visualSettings.transparency,
          blur: visualSettings.blur,
        });
      }

      setSuccess(t('services.visualSettingsSaved'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || t('services.errorSavingSettings'));
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      setLoading(true);
      await onDelete(appliance);
      onClose();
    } catch (err) {
      setError(err.message || t('services.errorDeletingService'));
      setLoading(false);
    }
  };

  // Check RustDesk installation status
  const handleCheckRustDeskStatus = async () => {
    if (!appliance || appliance.isNew) {
      setError(t('services.serviceMustBeSavedFirst'));
      return;
    }

    // If we already have a RustDesk ID in the form, show it directly
    if (formData.rustdeskId) {
      alert(`${t('services.rustdeskAlreadyInstalled')}\nID: ${formData.rustdeskId}`);
      return;
    }
    
    setCheckingRustDeskStatus(true);
    try {
      // Get SSH connection details
      let sshConnectionId = null;
      
      if (formData.sshConnection) {
        // Find matching SSH host
        const matchingHost = sshHosts.find(host => {
          const hostValue = `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
          return hostValue === formData.sshConnection;
        });
        if (matchingHost) {
          sshConnectionId = matchingHost.id;
        }
      }
      
      if (!sshConnectionId) {
        setError(t('services.noSshConnectionConfigured'));
        return;
      }

      const response = await axios.get(`/api/rustdeskInstall/${appliance.id}/status`);

      if (response.data) {
        const status = response.data;
        
        if (status.installed) {
          // RustDesk is installed
          if (status.rustdeskId || status.rustdesk_id) {
            // Show status with ID
            setSuccess(true);
            setError(null);
            const rustdeskId = status.rustdeskId || status.rustdesk_id;
            alert(`${t('services.rustdeskIsInstalled')}\nID: ${rustdeskId}`);
            
            // Update the form with the ID
            handleFieldChange('rustdeskId', rustdeskId);
          } else {
            // Installed but no ID - show setup dialog for manual entry
            setShowRustDeskDialog(true);
          }
        } else {
          // Not installed - show installer dialog
          setShowRustDeskDialog(true);
        }
      }
    } catch (err) {
      console.error('Error checking RustDesk status:', err);
      setError(t('services.errorCheckingRustdeskStatus'));
    } finally {
      setCheckingRustDeskStatus(false);
    }
  };

  // Handle RustDesk installation
  const handleRustDeskInstall = async () => {
    try {
      // Get SSH connection details
      let sshConnectionId = null;
      
      if (formData.sshConnection) {
        const matchingHost = sshHosts.find(host => {
          const hostValue = `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
          return hostValue === formData.sshConnection;
        });
        if (matchingHost) {
          sshConnectionId = matchingHost.id;
        }
      }
      
      if (!sshConnectionId) {
        throw new Error('Keine SSH-Verbindung konfiguriert');
      }

      const response = await axios.post(`/api/rustdeskInstall/${sshConnectionId}`, {});
      
      if (response.data.success) {
        if (response.data.rustdeskId || response.data.rustdesk_id) {
          const rustdeskId = response.data.rustdeskId || response.data.rustdesk_id;
          handleFieldChange('rustdeskId', rustdeskId);
          setSuccess(true);
          return true;
        } else if (response.data.manual_id_required) {
          // Manual ID entry required
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('RustDesk installation error:', err);
      throw err;
    }
  };

  // Handle manual RustDesk ID save
  const handleRustDeskManualSave = async (id, password) => {
    try {
      handleFieldChange('rustdeskId', id);
      if (password) {
        handleFieldChange('rustdeskPassword', password);
      }
      
      // Get SSH connection details
      let sshConnectionId = null;
      
      if (formData.sshConnection) {
        const matchingHost = sshHosts.find(host => {
          const hostValue = `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
          return hostValue === formData.sshConnection;
        });
        if (matchingHost) {
          sshConnectionId = matchingHost.id;
        }
      }
      
      if (!sshConnectionId) {
        throw new Error('Keine SSH-Verbindung konfiguriert');
      }

      // Save to backend
      const response = await axios.put(`/api/rustdeskInstall/${sshConnectionId}/id`, {
        rustdeskId: id
      });
      
      if (response.data) {
        setSuccess(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error saving RustDesk ID:', err);
      throw err;
    }
  };

  // Get available icons
  const availableIcons = getAvailableIcons();

  // Custom Commands Functions
  const fetchCommands = async () => {
    try {
      setIsLoadingCommands(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/commands/${appliance.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCommands(data);
      }
    } catch (error) {
      console.error('Error fetching commands:', error);
    } finally {
      setIsLoadingCommands(false);
    }
  };

  const handleCreateCommand = async () => {
    if (!newCommand.description || !newCommand.command) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/commands/${appliance.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: newCommand.description,
          command: newCommand.command,
          host_id: newCommand.hostId,
        }),
      });

      if (response.ok) {
        const createdCommand = await response.json();
        setCommands([createdCommand, ...commands]);
        setNewCommand({
          description: '',
          command: '',
          host_id: defaultHostId,
        });
        setSuccess(t('services.commandAddedSuccess'));
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error creating command:', error);
      setError(t('services.errorCreatingCommand'));
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleUpdateCommand = async (commandId, updatedData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/commands/${appliance.id}/${commandId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedData),
        }
      );

      if (response.ok) {
        const updatedCommand = await response.json();
        setCommands(
          commands.map(cmd => (cmd.id === commandId ? updatedCommand : cmd))
        );
        setEditingCommand(null);
      }
    } catch (error) {
      console.error('Error updating command:', error);
    }
  };

  const handleDeleteCommand = async commandId => {
    if (!window.confirm(t('services.confirmDeleteCommand'))) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/commands/${appliance.id}/${commandId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setCommands(commands.filter(cmd => cmd.id !== commandId));
        // Clear output if exists
        const newOutput = { ...commandOutput };
        delete newOutput[commandId];
        setCommandOutput(newOutput);
      }
    } catch (error) {
      console.error('Error deleting command:', error);
    }
  };

  const handleExecuteCommand = async command => {
    try {
      setExecutingCommandId(command.id);
      const token = localStorage.getItem('token');
      const executeUrl = `/api/commands/${appliance.id}/${command.id}/execute`;
      const executeInfo = {
        applianceId: appliance.id,
        commandId: command.id,
        url: executeUrl,
        fullUrl: window.location.origin + executeUrl
      };
      
      const response = await fetch(
        executeUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Command execution failed:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        throw new Error(`Command execution failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Ensure we have output to convert
      const outputText = result.output || result.error || 'Keine Ausgabe';

      // Force color output by adding color flag if needed
      let coloredOutput;
      try {
        // Try to convert ANSI codes to HTML
        coloredOutput = ansiConverter.toHtml(outputText);

        // If no HTML tags were added, it might not have ANSI codes
        if (coloredOutput === outputText) {
          // Add some basic formatting based on theme
          const textColor = currentTheme === 'light' 
            ? (result.success ? '#059212' : '#d32f2f')  // Darker colors for light mode
            : (result.success ? '#0f0' : '#f00');  // Bright colors for dark mode
            
          coloredOutput = `<span style="color: ${textColor}">${outputText}</span>`;
        }
      } catch (e) {
        console.error('Error converting ANSI to HTML:', e);
        coloredOutput = `<span>${outputText}</span>`;
      }

      setCommandOutput({
        ...commandOutput,
        [command.id]: {
          success: result.success,
          output: outputText,
          htmlOutput: coloredOutput,
          executedAt: result.executedAt,
        },
      });
    } catch (error) {
      console.error('Error executing command:', error);
      const errorColor = currentTheme === 'light' ? '#d32f2f' : 'red';
      setCommandOutput({
        ...commandOutput,
        [command.id]: {
          success: false,
          output: t('services.errorExecutingCommand'),
          htmlOutput:
            `<span style="color: ${errorColor}">${t('services.errorExecutingCommand')}</span>`,
          executedAt: new Date().toISOString(),
        },
      });
    } finally {
      setExecutingCommandId(null);
    }
  };

  const handleOpenTerminal = command => {
    // Use the global terminal handler or the passed prop
    const terminalHandler = window.handleTerminalOpen;

    if (terminalHandler && appliance) {
      // Create appliance object with pre-typed command
      const applianceWithCommand = {
        ...appliance,
        initialCommand: command.command, // Command will be typed but not executed
      };

      // If command has a specific SSH host, update the connection
      if (command.host_id) {
        const sshHost = sshHosts.find(h => h.id === command.host_id);
        if (sshHost) {
          applianceWithCommand.sshConnection = `${sshHost.username}@${sshHost.hostname}:${sshHost.port}`;
        }
      }

      terminalHandler(applianceWithCommand);
      onClose(); // Close the panel after opening terminal
    }
  };

  // Template functions
  const fetchAvailableCommands = async () => {
    try {
      setIsLoadingTemplates(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/commands/available/${appliance.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableCommands(data);

        // Group commands by appliance
        const grouped = data.reduce((acc, command) => {
          if (!acc[command.appliance_name]) {
            acc[command.appliance_name] = [];
          }
          acc[command.appliance_name].push(command);
          return acc;
        }, {});
        setGroupedCommands(grouped);
      }
    } catch (error) {
      console.error('Error fetching available commands:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = template => {
    setNewCommand({
      description: template.description,
      command: template.command,
      host_id: template.host_id || defaultHostId,
    });
    setSelectedTemplate(template);
    setShowCommandSelection(false);
  };

  const filteredTemplates = Object.entries(groupedCommands).reduce(
    (acc, [applianceName, commands]) => {
      const filtered = commands.filter(
        cmd =>
          cmd.description
            .toLowerCase()
            .includes(templateSearchTerm.toLowerCase()) ||
          cmd.command
            .toLowerCase()
            .includes(templateSearchTerm.toLowerCase()) ||
          applianceName.toLowerCase().includes(templateSearchTerm.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[applianceName] = filtered;
      }
      return acc;
    },
    {}
  );

  const { t } = useTranslation();

  // Tab components - Visual Tab entfernt
  const tabs = ['commands', 'service'];
  const tabLabels = {
    commands: { icon: Command, label: t('services.commands') },
    service: { icon: Edit, label: t('services.serviceSettings') },
  };

  // Debug logging
  useEffect(() => {

  }, [activeTabIndex]);

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
      {console.log('[ServicePanel Render] formData.name:', formData.name, 'appliance.name:', appliance?.name)}
      <UnifiedPanelHeader 
        title={appliance?.isNew ? t('services.newService') : formData.name || appliance?.name || t('services.editService')}
        icon={Edit}
        onClose={onClose}
      />

      {/* Tab Buttons */}
      <Box
        className="service-panel-tabs"
        sx={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'transparent',
          flexShrink: 0,
          height: '48px',
        }}
      >
        {tabs.map((tab, index) => {
          const TabIcon = tabLabels[tab].icon;
          const isActive = activeTabIndex === index;
          const isDisabled = appliance?.isNew && tab === 'commands';
          
          return (
            <Button
              key={tab}
              className={isActive ? 'active-tab' : ''}
              onClick={() => setActiveTabIndex(index)}
              disabled={isDisabled}
              sx={{
                flex: 1,
                py: 1.5,
                borderRadius: 0,
                color: isActive
                  ? 'var(--primary-color)'
                  : 'var(--text-secondary)',
                borderBottom: isActive
                  ? '2px solid var(--primary-color)'
                  : 'none',
                '&:hover': {
                  backgroundColor: isDisabled
                    ? 'transparent'
                    : 'var(--container-bg)',
                },
                '&.Mui-disabled': {
                  color: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              <TabIcon size={18} style={{ marginRight: 8 }} />
              {tabLabels[tab].label}
            </Button>
          );
        })}
      </Box>

      {/* Tab Content Container */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Commands Tab - Index 0 */}
          <Box key="commands-tab" sx={{ 
            width: '100%', 
            height: '100%', 
            overflow: 'auto', 
            p: 3,
            display: activeTabIndex === 0 ? 'block' : 'none'
          }}>
            {showCommandSelection ? (
              <Box>
                {/* Back button and title */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 3,
                    gap: 2,
                  }}
                >
                  <IconButton
                    onClick={() => {
                      setShowCommandSelection(false);
                      setTemplateSearchTerm('');
                      setSelectedTemplate(null);
                    }}
                    sx={{
                      color: 'var(--text-secondary)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    <X />
                  </IconButton>
                  <Typography
                    variant="h5"
                    sx={{
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Copy size={24} />
                    {t('services.selectFromTemplates')}
                  </Typography>
                </Box>

                {/* Search bar */}
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    placeholder={t('services.searchTemplates')}
                    value={templateSearchTerm}
                    onChange={e => setTemplateSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <Search
                          size={20}
                          style={{
                            marginRight: 8,
                            color: 'var(--text-secondary)',
                          }}
                        />
                      ),
                    }}
                    sx={getInputStyles()}
                    autoFocus
                  />
                </Box>

                {/* Template list */}
                {isLoadingTemplates ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 6 }}
                  >
                    <CircularProgress size={48} />
                  </Box>
                ) : Object.keys(filteredTemplates).length === 0 ? (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 8,
                      px: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: 3,
                      border: '2px dashed rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Typography
                      sx={{
                        color: 'var(--text-secondary)',
                        fontSize: '1.1rem',
                      }}
                    >
                      {templateSearchTerm
                        ? t('services.noTemplatesFound')
                        : t('services.noCommandTemplatesAvailable')}
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                  >
                    {Object.entries(filteredTemplates)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([applianceName, commands]) => (
                        <Box key={applianceName}>
                          <Typography
                            variant="h6"
                            sx={{
                              mb: 2,
                              color: 'var(--text-secondary)',
                              fontWeight: 500,
                            }}
                          >
                            {applianceName}
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                            }}
                          >
                            {commands.map(command => (
                              <Box
                                key={command.id}
                                className="command-card"
                                onClick={() => handleSelectTemplate(command)}
                                sx={{
                                  ...(selectedTemplate?.id === command.id
                                    ? {
                                        backgroundColor: 'rgba(0, 122, 255, 0.2)',
                                        border: '2px solid var(--primary-color)',
                                      }
                                    : {}),
                                  p: 3,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    backgroundColor: currentTheme === 'light'
                                      ? 'rgba(255, 255, 255, 0.8)'
                                      : 'rgba(0, 0, 0, 0.25)',
                                    borderColor: currentTheme === 'light'
                                      ? 'rgba(0, 0, 0, 0.2)'
                                      : 'rgba(255, 255, 255, 0.2)',
                                  },
                                }}
                              >
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    mb: 1,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'pre-line',
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {command.description}
                                </Typography>
                                <Typography
                                  component="code"
                                  sx={{
                                    display: 'block',
                                    mb: 2,
                                    fontFamily: 'Monaco, Consolas, monospace',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)',
                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                    p: 1.5,
                                    borderRadius: 1,
                                    overflowX: 'auto',
                                  }}
                                >
                                  {command.command}
                                </Typography>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <Server
                                    size={14}
                                    style={{ color: 'var(--text-secondary)' }}
                                  />
                                  <Typography
                                    variant="body2"
                                    sx={{ color: 'var(--text-secondary)' }}
                                  >
                                    {command.host_id
                                      ? `${command.ssh_hostname || 'SSH Host'} (${command.ssh_connection_string})`
                                      : 'Lokal'}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      ))}
                  </Box>
                )}
              </Box>
            ) : (
              /* Normal commands view */
              <>
                {/* New Command Form */}
                <Box
                  className="command-card"
                  sx={{
                    p: 4,
                    mb: 4,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <Box
                    onClick={() => setShowNewCommandForm(!showNewCommandForm)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      mb: showNewCommandForm ? 3 : 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        background:
                          'linear-gradient(135deg, #007AFF 0%, #0051D5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: showNewCommandForm ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                      }}
                    >
                      <Plus size={24} color="#FFFFFF" />
                    </Box>
                    <Typography
                      variant="h5"
                      sx={{
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        flex: 1,
                      }}
                    >
                      {t('services.createNewCommand')}
                    </Typography>
                  </Box>
                  {showNewCommandForm && (
                    <Box
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
                    >
                    <TextField
                      fullWidth
                      label={t('services.commandDescription')}
                      value={newCommand.description}
                      onChange={e =>
                        setNewCommand({
                          ...newCommand,
                          description: e.target.value,
                        })
                      }
                      placeholder={t('services.commandDescriptionPlaceholder')}
                      multiline
                      rows={3}
                      sx={getInputStyles()}
                    />
                    <TextField
                      fullWidth
                      label={t('services.command')}
                      value={newCommand.command}
                      onChange={e =>
                        setNewCommand({
                          ...newCommand,
                          command: e.target.value,
                        })
                      }
                      placeholder={t('services.commandPlaceholder')}
                      sx={getInputStyles()}
                    />
                    <FormControl fullWidth>
                      <InputLabel>
                        {t('services.sshHost')}
                      </InputLabel>
                      <Select
                        value={newCommand.host_id || ''}
                        onChange={e =>
                          setNewCommand({
                            ...newCommand,
                            host_id: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          })
                        }
                        label={t('services.sshHost')}
                        sx={getSelectStyles()}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              bgcolor: 'var(--bg-primary)',
                              border: '1px solid var(--container-border)',
                              '& .MuiMenuItem-root': {
                                color: 'var(--text-primary)',
                                '&:hover': {
                                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                                },
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="">{t('services.runLocally')}</MenuItem>
                        {sshHosts.map((host, index) => (
                          <MenuItem
                            key={`${host.hostname}-${index}`}
                            value={host.id}
                          >
                            {host.name ||
                              `${host.username || 'root'}@${host.hostname}:${host.port || 22}`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handleCreateCommand}
                        disabled={
                          !newCommand.description || !newCommand.command
                        }
                        startIcon={<Plus />}
                        sx={{
                          backgroundColor: 'var(--primary-color)',
                          py: 1.5,
                          px: 3,
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)',
                          '&:hover': {
                            backgroundColor: 'var(--primary-color-dark)',
                            boxShadow: '0 6px 16px rgba(0, 122, 255, 0.4)',
                          },
                          '&:disabled': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          },
                        }}
                      >
                        {t('services.addCommand')}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => setShowCommandSelection(true)}
                        startIcon={<Copy />}
                        sx={{
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                          color: 'var(--text-primary)',
                          py: 1.5,
                          px: 3,
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: 'var(--primary-color)',
                            backgroundColor: 'rgba(0, 122, 255, 0.1)',
                          },
                        }}
                      >
                        {t('services.fromTemplates')}
                      </Button>
                    </Box>
                  </Box>
                  )}
                </Box>

                {/* Commands List */}
                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 3,
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        background:
                          'linear-gradient(135deg, #34C759 0%, #2CA048 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Command size={24} color="#FFFFFF" />
                    </Box>
                    {t('services.savedCommands')}
                    {commands.length > 0 && (
                      <Chip
                        label={commands.length}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(52, 199, 89, 0.2)',
                          color: '#34C759',
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Typography>

                  {isLoadingCommands ? (
                    <Box
                      sx={{ display: 'flex', justifyContent: 'center', py: 6 }}
                    >
                      <CircularProgress size={48} />
                    </Box>
                  ) : commands.length === 0 ? (
                    <Box
                      sx={{
                        textAlign: 'center',
                        py: 8,
                        px: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 3,
                        border: '2px dashed rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <Command
                        size={48}
                        style={{
                          color: 'var(--text-secondary)',
                          opacity: 0.5,
                          marginBottom: 16,
                        }}
                      />
                      <Typography
                        sx={{
                          color: 'var(--text-secondary)',
                          fontSize: '1.1rem',
                        }}
                      >
                        {t('services.noCommandsSaved')}
                      </Typography>
                      <Typography
                        sx={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.9rem',
                          mt: 1,
                          opacity: 0.7,
                        }}
                      >
                        Erstellen Sie Ihr erstes Kommando mit dem Formular oben
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      {commands
                        .sort((a, b) =>
                          a.description.localeCompare(b.description)
                        )
                        .map((command, index) => (
                          <Box
                            key={command.id}
                            className="command-card"
                            sx={{
                              p: 3,
                              transition:
                                'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'relative',
                              overflow: 'hidden',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                borderColor: currentTheme === 'light' 
                                  ? 'rgba(0, 0, 0, 0.2)'
                                  : 'rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                                background: currentTheme === 'light'
                                  ? 'linear-gradient(135deg, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.02) 100%)'
                                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                              },
                            }}
                          >
                            {editingCommand === command.id ? (
                              /* Edit Mode */
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                }}
                              >
                                <TextField
                                  fullWidth
                                  value={command.description}
                                  onChange={e =>
                                    setCommands(
                                      commands.map(cmd =>
                                        cmd.id === command.id
                                          ? {
                                              ...cmd,
                                              description: e.target.value,
                                            }
                                          : cmd
                                      )
                                    )
                                  }
                                  multiline
                                  rows={3}
                                  sx={getInputStyles()}
                                />
                                <TextField
                                  fullWidth
                                  value={command.command}
                                  onChange={e =>
                                    setCommands(
                                      commands.map(cmd =>
                                        cmd.id === command.id
                                          ? { ...cmd, command: e.target.value }
                                          : cmd
                                      )
                                    )
                                  }
                                  sx={getInputStyles()}
                                />
                                <FormControl fullWidth>
                                  <Select
                                    value={command.host_id || ''}
                                    onChange={e =>
                                      setCommands(
                                        commands.map(cmd =>
                                          cmd.id === command.id
                                            ? {
                                                ...cmd,
                                                host_id: e.target.value
                                                  ? parseInt(e.target.value)
                                                  : null,
                                              }
                                            : cmd
                                        )
                                      )
                                    }
                                    sx={{
                                      color: 'var(--text-primary)',
                                      backgroundColor:
                                        'var(--container-bg)',
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: 'rgba(255, 255, 255, 0.2)',
                                      },
                                      '& .MuiSvgIcon-root': {
                                        color: 'var(--text-secondary)',
                                      },
                                    }}
                                  >
                                    <MenuItem value="">
                                      Lokal ausführen
                                    </MenuItem>
                                    {sshHosts.map((host, index) => (
                                      <MenuItem
                                        key={`${host.hostname}-${index}`}
                                        value={host.id}
                                      >
                                        {host.name ||
                                          `${host.username || 'root'}@${host.hostname}:${host.port || 22}`}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    gap: 1,
                                    justifyContent: 'flex-end',
                                  }}
                                >
                                  <IconButton
                                    onClick={() =>
                                      handleUpdateCommand(command.id, command)
                                    }
                                    sx={{
                                      color: '#FFFFFF',
                                      backgroundColor: '#34C759',
                                      '&:hover': {
                                        backgroundColor: '#2CA048',
                                      },
                                    }}
                                  >
                                    <Save size={20} />
                                  </IconButton>
                                  <IconButton
                                    onClick={() => setEditingCommand(null)}
                                    sx={{
                                      color: 'var(--text-secondary)',
                                      backgroundColor:
                                        'rgba(255, 255, 255, 0.1)',
                                      '&:hover': {
                                        backgroundColor:
                                          'rgba(255, 255, 255, 0.2)',
                                      },
                                    }}
                                  >
                                    <X size={20} />
                                  </IconButton>
                                </Box>
                              </Box>
                            ) : (
                              /* View Mode */
                              <>
                                {/* Command Description - with wrap */}
                                <Typography
                                  variant="body1"
                                  sx={{
                                    color: 'var(--text-primary)',
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-line',
                                    minWidth: 0,
                                    mb: 2,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {command.description}
                                </Typography>

                                {/* Action Buttons */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    gap: 1,
                                  }}
                                >
                                  <IconButton
                                    onClick={() =>
                                      handleExecuteCommand(command)
                                    }
                                    disabled={executingCommandId === command.id}
                                    sx={{
                                      color: '#34C759',
                                      backgroundColor: 'rgba(52, 199, 89, 0.3)',
                                      '&:hover': {
                                        backgroundColor: 'rgba(52, 199, 89, 0.4)',
                                        transform: 'scale(1.05)',
                                      },
                                      '&:disabled': {
                                        color: 'rgba(52, 199, 89, 0.5)',
                                        backgroundColor:
                                          'rgba(52, 199, 89, 0.15)',
                                      },
                                      transition: 'all 0.2s ease',
                                    }}
                                    title={t('common.execute')}
                                  >
                                    {executingCommandId === command.id ? (
                                      <CircularProgress size={20} sx={{ color: '#34C759' }} />
                                    ) : (
                                      <Play size={20} />
                                    )}
                                  </IconButton>
                                  <IconButton
                                    onClick={() => handleOpenTerminal(command)}
                                    sx={{
                                      color: '#AF52DE',
                                      backgroundColor: 'rgba(175, 82, 222, 0.3)',
                                      '&:hover': {
                                        backgroundColor:
                                          'rgba(175, 82, 222, 0.4)',
                                        transform: 'scale(1.05)',
                                      },
                                      transition: 'all 0.2s ease',
                                    }}
                                    title={t('terminal.title')}
                                  >
                                    <Terminal size={20} />
                                  </IconButton>
                                  <IconButton
                                    onClick={() =>
                                      setEditingCommand(command.id)
                                    }
                                    sx={{
                                      color: '#FFD60A',
                                      backgroundColor: 'rgba(255, 214, 10, 0.3)',
                                      '&:hover': {
                                        backgroundColor:
                                          'rgba(255, 214, 10, 0.4)',
                                        transform: 'scale(1.05)',
                                      },
                                      transition: 'all 0.2s ease',
                                    }}
                                    title={t('common.edit')}
                                  >
                                    <Edit2 size={20} />
                                  </IconButton>
                                  <IconButton
                                    onClick={() =>
                                      handleDeleteCommand(command.id)
                                    }
                                    sx={{
                                      color: '#FF3B30',
                                      backgroundColor: 'rgba(255, 59, 48, 0.3)',
                                      '&:hover': {
                                        backgroundColor:
                                          'rgba(255, 59, 48, 0.4)',
                                        transform: 'scale(1.05)',
                                      },
                                      transition: 'all 0.2s ease',
                                    }}
                                    title={t('common.delete')}
                                  >
                                    <Trash2 size={20} />
                                  </IconButton>
                                </Box>

                                {/* Command Output */}
                                {commandOutput[command.id] && (
                                  <Box
                                    sx={{
                                      mt: 2,
                                      backgroundColor: '#1a1a1a',
                                      borderRadius: 2,
                                      border: commandOutput[command.id].success
                                        ? '1px solid rgba(52, 199, 89, 0.5)'
                                        : '1px solid rgba(255, 59, 48, 0.5)',
                                      boxShadow: commandOutput[command.id]
                                        .success
                                        ? '0 0 20px rgba(52, 199, 89, 0.2)'
                                        : '0 0 20px rgba(255, 59, 48, 0.2)',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        px: 2,
                                        py: 1,
                                        borderBottom:
                                          '1px solid rgba(255, 255, 255, 0.1)',
                                        backgroundColor: commandOutput[
                                          command.id
                                        ].success
                                          ? 'rgba(52, 199, 89, 0.1)'
                                          : 'rgba(255, 59, 48, 0.1)',
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: commandOutput[command.id]
                                            .success
                                            ? '#34C759'
                                            : '#FF3B30',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {commandOutput[command.id].success
                                          ? `✓ ${t('services.successLabel')}`
                                          : `✗ ${t('services.errorLabel')}`}{' '}
                                        •{' '}
                                        {new Date(
                                          commandOutput[command.id].executedAt
                                        ).toLocaleTimeString()}
                                      </Typography>
                                      <IconButton
                                        onClick={() => {
                                          const newOutput = {
                                            ...commandOutput,
                                          };
                                          delete newOutput[command.id];
                                          setCommandOutput(newOutput);
                                        }}
                                        sx={{
                                          color: 'var(--text-secondary)',
                                          padding: '4px',
                                          '&:hover': {
                                            color: '#ff4444',
                                            backgroundColor:
                                              'rgba(255, 68, 68, 0.1)',
                                          },
                                        }}
                                      >
                                        <X size={16} />
                                      </IconButton>
                                    </Box>
                                    <Box
                                      sx={{
                                        p: 2,
                                        fontFamily:
                                          'Monaco, Consolas, monospace',
                                        fontSize: '13px',
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                        wordWrap: 'break-word',
                                        color: currentTheme === 'light' ? '#000000' : '#ffffff',
                                        backgroundColor: currentTheme === 'light' 
                                          ? 'rgba(255, 255, 255, 0.9)' 
                                          : 'rgba(0, 0, 0, 0.5)',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        '&::-webkit-scrollbar': {
                                          width: '8px',
                                        },
                                        '&::-webkit-scrollbar-track': {
                                          background:
                                            'var(--container-bg)',
                                        },
                                        '&::-webkit-scrollbar-thumb': {
                                          background:
                                            'rgba(255, 255, 255, 0.2)',
                                          borderRadius: '4px',
                                          '&:hover': {
                                            background:
                                              'rgba(255, 255, 255, 0.3)',
                                          },
                                        },
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          commandOutput[command.id].htmlOutput,
                                      }}
                                    />
                                  </Box>
                                )}
                              </>
                            )}
                          </Box>
                        ))}
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Box>

          {/* Service Tab - Index 1 (war vorher Index 2) */}
          <Box key="service-tab" sx={{ 
            width: '100%', 
            height: '100%', 
            overflow: 'auto', 
            p: 3,
            display: activeTabIndex === 1 ? 'block' : 'none'
          }}>
            {/* Grundinformationen Card */}
            <Box
              className="settings-card"
              sx={{
                ...getCardStyles(),
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                {t('services.basicInformation')}
              </Typography>

              <TextField
                fullWidth
                label={t('services.serviceName')}
                value={(() => {

                  return formData.name;
                })()}
                onChange={e => handleFieldChange('name', e.target.value)}
                margin="normal"
                required
                sx={getInputStyles()}
              />

              <TextField
                fullWidth
                label={t('services.serviceUrl')}
                value={formData.url}
                onChange={e => handleFieldChange('url', e.target.value)}
                margin="normal"
                required
                placeholder="https://example.com"
                sx={getInputStyles()}
              />

              <TextField
                fullWidth
                label={t('services.serviceDescription')}
                value={formData.description}
                onChange={e => handleFieldChange('description', e.target.value)}
                margin="normal"
                multiline
                rows={3}
                sx={getInputStyles()}
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>
                  {t('services.serviceCategory')}
                </InputLabel>
                <Select
                  value={formData.category}
                  onChange={e => handleFieldChange('category', e.target.value)}
                  label={t('services.serviceCategory')}
                  sx={getSelectStyles()}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: 'var(--bg-primary)',
                        border: '1px solid var(--container-border)',
                        '& .MuiMenuItem-root': {
                          color: 'var(--text-primary)',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                          },
                          '&.Mui-selected': {
                            bgcolor: 'rgba(255, 255, 255, 0.15)',
                            '&:hover': {
                              bgcolor: 'rgba(255, 255, 255, 0.2)',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="">Keine Kategorie</MenuItem>
                  {categories?.map(category => (
                    <MenuItem key={category.name} value={category.name}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Symbol und Farbe Card */}
            <Box
              className="settings-card"
              sx={{
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                {t('services.symbolAndColor')}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box
                  onClick={() => setShowIconSelector(true)}
                  sx={{
                    width: 60,
                    height: 60,
                    backgroundColor: formData.color,
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

                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'var(--text-secondary)', mb: 1 }}
                  >
                    {t('services.clickToChange')}
                  </Typography>

                  {/* Color Presets */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {COLOR_PRESETS.map(color => (
                      <Box
                        key={color}
                        onClick={() => handleFieldChange('color', color)}
                        sx={{
                          width: 32,
                          height: 32,
                          backgroundColor: color,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border:
                            formData.color === color
                              ? '2px solid white'
                              : 'none',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* Live Preview mit Transparenz und Unschärfe */}
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  backgroundColor: 'var(--container-bg)',
                  borderRadius: 2,
                  border: '1px solid var(--container-border)',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ mb: 2, color: 'var(--text-secondary)' }}
                >
                  {t('common.preview')}
                </Typography>

                <Box
                  sx={{
                    width: '100%',
                    height: 120,
                    backgroundColor: formData.color,
                    opacity: visualSettings.transparency / 100,
                    backdropFilter: `blur(${visualSettings.blur}px)`,
                    WebkitBackdropFilter: `blur(${visualSettings.blur}px)`,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <SimpleIcon name={formData.icon} size={50} color="#FFFFFF" />
                </Box>
              </Box>

              {/* Transparency Slider */}
              <Box sx={{ mt: 3 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 1, color: 'var(--text-secondary)' }}
                >
                  {t('settings.transparency')}: {visualSettings.transparency}%
                </Typography>
                <Slider
                  value={visualSettings.transparency}
                  onChange={(e, value) => {
                    // Nur lokale State-Änderung, wird erst beim Speichern übernommen
                    handleVisualChange('transparency', value);
                    // Auch in formData speichern für den Save-Button
                    handleFieldChange('transparency', value / 100);
                  }}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  sx={{
                    color: 'var(--primary-color)',
                    '& .MuiSlider-thumb': {
                      backgroundColor: 'var(--primary-color)',
                    },
                  }}
                />
              </Box>

              {/* Blur Slider */}
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 1, color: 'var(--text-secondary)' }}
                >
                  {t('services.unsharpness')}: {visualSettings.blur}px
                </Typography>
                <Slider
                  value={visualSettings.blur}
                  onChange={(e, value) => {
                    // Nur lokale State-Änderung, wird erst beim Speichern übernommen
                    handleVisualChange('blur', value);
                    // Auch in formData speichern für den Save-Button
                    handleFieldChange('blur', value);
                  }}
                  min={0}
                  max={20}
                  valueLabelDisplay="auto"
                  sx={{
                    color: 'var(--primary-color)',
                    '& .MuiSlider-thumb': {
                      backgroundColor: 'var(--primary-color)',
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Öffnungsmodus Card */}
            <Box
              className="settings-card"
              sx={{
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                {t('services.openBehavior')}
              </Typography>

            <FormControl fullWidth margin="normal">
              <InputLabel>
                {t('services.miniWidgetMode')}
              </InputLabel>
              <Select
                value={formData.openModeMini || 'browser_tab'}
                onChange={e =>
                  handleFieldChange('openModeMini', e.target.value)
                }
                label={t('services.miniWidgetMode')}
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
                    borderColor: 'var(--accent-color)',
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'var(--text-secondary)',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: 'var(--bg-primary)',
                      border: '1px solid var(--container-border)',
                      '& .MuiMenuItem-root': {
                        color: 'var(--text-primary)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="browser_tab">{t('services.browserNewTab')}</MenuItem>
                <MenuItem value="browser_window">
                  {t('services.browserNewWindow')}
                </MenuItem>
                <MenuItem value="safari_pwa">{t('services.safariPwaMode')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>
                {t('services.mobileiPadMode')}
              </InputLabel>
              <Select
                value={formData.openModeMobile || 'browser_tab'}
                onChange={e =>
                  handleFieldChange('openModeMobile', e.target.value)
                }
                label={t('services.mobileiPadMode')}
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
                    borderColor: 'var(--accent-color)',
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'var(--text-secondary)',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: 'var(--bg-primary)',
                      border: '1px solid var(--container-border)',
                      '& .MuiMenuItem-root': {
                        color: 'var(--text-primary)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="browser_tab">{t('services.browserNewTab')}</MenuItem>
                <MenuItem value="browser_window">
                  {t('services.browserNewWindow')}
                </MenuItem>
                <MenuItem value="safari_pwa">{t('services.safariPwaMode')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>
                {t('services.desktopMode')}
              </InputLabel>
              <Select
                value={formData.openModeDesktop || 'browser_tab'}
                onChange={e =>
                  handleFieldChange('openModeDesktop', e.target.value)
                }
                label={t('services.desktopMode')}
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
                    borderColor: 'var(--accent-color)',
                  },
                  '& .MuiSvgIcon-root': {
                    color: 'var(--text-secondary)',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: 'var(--bg-primary)',
                      border: '1px solid var(--container-border)',
                      '& .MuiMenuItem-root': {
                        color: 'var(--text-primary)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                          '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="browser_tab">{t('services.browserNewTab')}</MenuItem>
                <MenuItem value="browser_window">
                  {t('services.browserNewWindow')}
                </MenuItem>
                <MenuItem value="safari_pwa">{t('services.safariPwaMode')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* SSH-Einstellungen Card */}
          {adminMode && (
            <Box
              className="settings-card"
              sx={{
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                {t('services.sshSettings')}
              </Typography>

                <FormControl fullWidth margin="normal">
                  <InputLabel>
                    {t('services.sshConnection')}
                  </InputLabel>
                  <Select
                    value={formData.sshConnection || ''}
                    onChange={e =>
                      handleFieldChange('sshConnection', e.target.value)
                    }
                    label={t('services.sshConnection')}
                    disabled={isLoadingSSHHosts}
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
                        borderColor: 'var(--accent-color)',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'var(--text-secondary)',
                      },
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          bgcolor: 'var(--bg-primary)',
                          border: '1px solid var(--container-border)',
                          '& .MuiMenuItem-root': {
                            color: 'var(--text-primary)',
                            '&:hover': {
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                            },
                            '&.Mui-selected': {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.2)',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="">{t('services.noSshConnection')}</MenuItem>
                    {sshHosts.map((host, index) => {
                      const hostValue = `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
                      return (
                        <MenuItem
                          key={`${host.hostname}-${index}`}
                          value={hostValue}
                        >
                          {host.name || host.hostname || hostValue}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                {sshHosts.length === 0 && !isLoadingSSHHosts && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'var(--text-secondary)',
                      display: 'block',
                      mt: 1,
                    }}
                  >
                    {t('services.sshConnectionsCanBeConfigured')}
                  </Typography>
                )}

                <TextField
                  fullWidth
                  label={t('services.statusCheckCommand')}
                  value={formData.statusCommand}
                  onChange={e =>
                    handleFieldChange('statusCommand', e.target.value)
                  }
                  margin="normal"
                  placeholder="systemctl is-active servicename"
                  sx={{
                    '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                    '& .MuiInputBase-root': {
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--container-bg)',
                    },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-color)',
                      },
                    },
                  }}
                  helperText={t('services.commandShouldOutputRunningOrStopped')}
                  FormHelperTextProps={{
                    sx: { color: 'var(--text-secondary)' },
                  }}
                />

                <TextField
                  fullWidth
                  label={t('services.startCommand')}
                  value={formData.startCommand}
                  onChange={e =>
                    handleFieldChange('startCommand', e.target.value)
                  }
                  margin="normal"
                  placeholder="systemctl start servicename"
                  sx={{
                    '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                    '& .MuiInputBase-root': {
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--container-bg)',
                    },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-color)',
                      },
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label={t('services.stopCommand')}
                  value={formData.stopCommand}
                  onChange={e =>
                    handleFieldChange('stopCommand', e.target.value)
                  }
                  margin="normal"
                  placeholder="systemctl stop servicename"
                  sx={{
                    '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                    '& .MuiInputBase-root': {
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--container-bg)',
                    },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-color)',
                      },
                    },
                  }}
                />
            </Box>
          )}

        {/* Remote Desktop Card */}
        <Box
          className="settings-card"
          sx={{
            p: 3,
            mb: 3,
          }}
        >
          <Typography
            variant="h6"
            sx={{ mb: 2, color: 'var(--text-primary)' }}
          >
            {t('settings.remoteDesktop')}
          </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.remoteDesktopEnabled || false}
                  onChange={e => handleFieldChange('remoteDesktopEnabled', e.target.checked)}
                  sx={{
                    '& .MuiSwitch-track': {
                      backgroundColor: formData.remoteDesktopEnabled ? 'var(--success-color)' : 'var(--text-tertiary)',
                    },
                  }}
                />
              }
              label={t('services.enableRemoteDesktop')}
              sx={{ mb: 2, color: 'var(--text-primary)' }}
            />

            {formData.remoteDesktopEnabled && (
              <>
                <FormControl fullWidth margin="normal">
                  <InputLabel>
                    {t('services.remoteDesktopType')}
                  </InputLabel>
                  <Select
                    value={formData.remoteDesktopType || 'guacamole'}
                    onChange={e => handleFieldChange('remoteDesktopType', e.target.value)}
                    label={t('services.remoteDesktopType')}
                    sx={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--container-bg)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  >
                    <MenuItem value="guacamole">{t('services.guacamoleClassic')}</MenuItem>
                    <MenuItem value="rustdesk">{t('services.rustdeskFaster')}</MenuItem>
                  </Select>
                </FormControl>

                {/* Guacamole Performance Mode Selector */}
                {formData.remoteDesktopType === 'guacamole' && (
                  <Box sx={{ my: 2 }}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel>
                        {t('services.performanceMode')}
                      </InputLabel>
                      <Select
                        value={formData.guacamolePerformanceMode || 'balanced'}
                        onChange={e => handleFieldChange('guacamolePerformanceMode', e.target.value)}
                        label={t('services.performanceMode')}
                        sx={{
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                          },
                        }}
                      >
                        <MenuItem value="high-quality">{t('services.highQuality')}</MenuItem>
                        <MenuItem value="balanced">{t('services.balanced')}</MenuItem>
                        <MenuItem value="performance">{t('services.performance')}</MenuItem>
                        <MenuItem value="low-bandwidth">{t('services.lowBandwidth')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* Protokoll nur für Guacamole anzeigen */}
                {formData.remoteDesktopType !== 'rustdesk' && (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>
                      {t('services.protocol')}
                    </InputLabel>
                    <Select
                      value={formData.remoteProtocol || 'vnc'}
                      onChange={e => handleFieldChange('remoteProtocol', e.target.value)}
                      label={t('services.protocol')}
                      sx={{
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--container-bg)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                      }}
                    >
                      <MenuItem value="vnc">VNC</MenuItem>
                      <MenuItem value="rdp">RDP (Windows)</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {/* Verbindungsdetails nur für Guacamole anzeigen */}
                {formData.remoteDesktopType !== 'rustdesk' && (
                  <>
                    <TextField
                      fullWidth
                      label={t('services.hostAddress')}
                      value={formData.remoteHost || ''}
                      onChange={e => handleFieldChange('remoteHost', e.target.value)}
                      margin="normal"
                      placeholder={extractHostFromUrl(formData.url) || t('services.ipPlaceholder')}
                      helperText={t('services.ipAddressOrHostname')}
                      sx={{
                        '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiFormHelperText-root': { color: 'var(--text-tertiary)' },
                      }}
                    />

                    <TextField
                      fullWidth
                      label={t('services.port')}
                      type="number"
                      value={formData.remotePort || (formData.remoteProtocol === 'rdp' ? 3389 : 5900)}
                      onChange={e => handleFieldChange('remotePort', parseInt(e.target.value) || '')}
                      margin="normal"
                      placeholder={formData.remoteProtocol === 'rdp' ? t('services.rdpPort') : t('services.vncPort')}
                      sx={{
                        '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      label={t('services.username')}
                      value={formData.remoteUsername || ''}
                      onChange={e => handleFieldChange('remoteUsername', e.target.value)}
                      margin="normal"
                      placeholder={formData.remoteProtocol === 'rdp' ? t('services.administratorPlaceholder') : t('services.usernamePlaceholder')}
                      helperText={formData.remoteProtocol === 'vnc' ? t('services.optionalForVnc') : t('services.requiredForRdp')}
                      sx={{
                        '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiFormHelperText-root': { color: 'var(--text-tertiary)' },
                      }}
                    />

                    <TextField
                      fullWidth
                      label={t('services.passwordLabel')}
                      type="password"
                      value={formData.remotePassword || ''}
                      onChange={e => handleFieldChange('remotePassword', e.target.value)}
                      margin="normal"
                      helperText={t('services.passwordStoredEncrypted')}
                      sx={{
                        '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiFormHelperText-root': { color: 'var(--text-tertiary)' },
                      }}
                    />
                  </>
                )}

                {/* RustDesk-spezifische Felder */}
                {formData.remoteDesktopType === 'rustdesk' && (
                  <>
                    <TextField
                      fullWidth
                      label="RustDesk ID"
                      value={formData.rustdeskId || ''}
                      onChange={e => handleFieldChange('rustdeskId', e.target.value)}
                      margin="normal"
                      placeholder={t('services.examplePlaceholder', { example: t('services.rustdeskIdExample') })}
                      helperText={t('services.rustdeskIdPlaceholder')}
                      sx={{
                        '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiFormHelperText-root': { color: 'var(--text-tertiary)' },
                      }}
                    />

                    <TextField
                      fullWidth
                      label="RustDesk Passwort"
                      type="password"
                      value={formData.rustdeskPassword || ''}
                      onChange={e => handleFieldChange('rustdeskPassword', e.target.value)}
                      margin="normal"
                      helperText={t('services.rustdeskPasswordPlaceholder')}
                      sx={{
                        '& .MuiInputLabel-root': { color: 'var(--text-secondary)' },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiFormHelperText-root': { color: 'var(--text-tertiary)' },
                      }}
                    />

                    <Alert severity="info" sx={{ mt: 2 }}>
                      {t('services.rustdeskInfo')}
                    </Alert>

                    {/* RustDesk Installation Status Button */}
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={checkingRustDeskStatus ? <CircularProgress size={20} /> : <Monitor />}
                      onClick={handleCheckRustDeskStatus}
                      disabled={checkingRustDeskStatus || !formData.sshConnection}
                      fullWidth
                      sx={{ mt: 2 }}
                    >
                      {checkingRustDeskStatus ? t('services.checkingStatus') : t('services.rustdeskInstallationStatus')}
                    </Button>

                    {!formData.sshConnection && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        {t('services.selectSshConnectionFirst')}
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}
          </Box>

          {/* Save Button */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSaveService}
                disabled={loading || !formData.name || !formData.url}
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                sx={{
                  backgroundColor: 'var(--primary-color)',
                  '&:hover': {
                    backgroundColor: 'var(--primary-color-dark)',
                  },
                }}
              >
                {t('services.saveChanges')}
              </Button>

              {adminMode && !appliance?.isNew && (
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
        </Box>
      </Box>

      {/* Icon Selector Modal */}
      {showIconSelector && (
        <IconSelector
          selectedIcon={formData.icon}
          onIconSelect={icon => {
            handleFieldChange('icon', icon);
            setShowIconSelector(false);
          }}
          onClose={() => setShowIconSelector(false)}
        />
      )}

      {/* Terminal Modal */}
      {showTerminal && (
        <TTYDTerminal
          appliance={appliance}
          open={showTerminal}
          onClose={() => setShowTerminal(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Snackbar
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={6000}
      >
        <Alert
          severity="warning"
          action={
            <>
              <Button
                color="inherit"
                size="small"
                onClick={handleDelete}
                disabled={loading}
              >
                {t('services.deleteButton')}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t('services.cancelButton')}
              </Button>
            </>
          }
        >
          {t('services.deleteConfirmMessage')}
        </Alert>
      </Snackbar>

      {/* RustDesk Setup Dialog */}
      {showRustDeskDialog && (
        <RustDeskSetupDialog
          isOpen={showRustDeskDialog}
          onClose={() => setShowRustDeskDialog(false)}
          applianceName={appliance?.name || formData.name}
          applianceId={appliance?.id}
          sshHost={sshHosts.find(host => {
            const hostValue = `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
            return hostValue === formData.sshConnection;
          })}
          onInstall={handleRustDeskInstall}
          onManualSave={handleRustDeskManualSave}
          currentRustDeskId={formData.rustdeskId}
        />
      )}

      {/* Success/Error Snackbar */}
      <Snackbar
        open={!!success || !!error}
        autoHideDuration={5000}
        onClose={() => {
          setSuccess('');
          setError('');
        }}
      >
        <Alert
          severity={success ? 'success' : 'error'}
          onClose={() => {
            setSuccess('');
            setError('');
          }}
        >
          {success || error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ServicePanel;
