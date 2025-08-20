import React, { useState, useEffect, useCallback, useRef } from 'react';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import RustDeskInstaller from '../RemoteDesktop/RustDeskInstaller';
import RustDeskSetupDialog from '../RemoteDesktop/RustDeskSetupDialog';
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

  // Panel width state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('servicePanelWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Refs
  const updateTimeoutRef = useRef(null);
  const panelRef = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

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
    console.log('[ServicePanel] useEffect triggered with appliance:', appliance);
    if (appliance) {
      console.log('[ServicePanel] Appliance fields:', {
        id: appliance.id,
        name: appliance.name,
        description: appliance.description,
        url: appliance.url,
        icon: appliance.icon,
        color: appliance.color,
        category: appliance.category,
        isFavorite: appliance.isFavorite,
        sshConnection: appliance.sshConnection,
        statusCommand: appliance.statusCommand,
        startCommand: appliance.startCommand,
        stopCommand: appliance.stopCommand,
        remoteDesktopEnabled: appliance.remoteDesktopEnabled,
        rustdeskId: appliance.rustdeskId,
      });
      
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
        transparency: appliance.transparency || 0.85,
        blur: appliance.blur || 8,
      };
      
      console.log('[ServicePanel] Initial form data set:', initialData);
      setFormData(initialData);
      
      // Store original data for comparison when saving
      setOriginalFormData(initialData);

      // Convert transparency from 0-1 range to 0-100 percentage
      // Note: In ApplianceCard, 1 = fully opaque, 0 = fully transparent
      // In our slider, 100 = fully opaque, 0 = fully transparent
      const transparencyPercentage = Math.round(
        (appliance.transparency || 0.85) * 100
      );

      setVisualSettings({
        transparency: transparencyPercentage,
        blur: appliance.blur || 8,
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

  // Load commands when switching to commands tab
  useEffect(() => {
    const currentTab = getTabFromIndex(activeTabIndex);
    if (currentTab === 'commands' && appliance?.id && !appliance?.isNew) {
      fetchCommands();
      fetchAvailableCommands();
    }
  }, [activeTabIndex, appliance?.id]);

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
        localStorage.setItem('servicePanelWidth', panelWidth.toString());

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
  }, [isResizing, panelWidth]);

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

      // Get only changed fields for existing appliances
      let dataToSave;
      if (appliance?.isNew) {
        // For new appliances, send all fields
        dataToSave = { ...formData };
      } else {
        // For existing appliances, send only changed fields
        dataToSave = getChangedFields(originalFormData, formData);
        
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
      console.log('Saving appliance - changed fields:', Object.keys(dataToSave));
      console.log('Changed data:', dataToSave);

      await onSave(appliance?.id, dataToSave);
      
      // Update original data after successful save (for existing appliances)
      if (!appliance?.isNew) {
        setOriginalFormData({ ...formData });
      }

      setSuccess(
        appliance?.isNew
          ? 'Service erfolgreich erstellt'
          : 'Service erfolgreich gespeichert'
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err.message ||
          (appliance?.isNew
            ? 'Fehler beim Erstellen des Services'
            : 'Fehler beim Speichern des Services')
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

      setSuccess('Visuelle Einstellungen gespeichert');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern der Einstellungen');
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
      setError(err.message || 'Fehler beim Löschen des Services');
      setLoading(false);
    }
  };

  // Check RustDesk installation status
  const handleCheckRustDeskStatus = async () => {
    if (!appliance || appliance.isNew) {
      setError('Service muss zuerst gespeichert werden');
      return;
    }

    
    // If we already have a RustDesk ID in the form, show it directly
    if (formData.rustdeskId) {
      alert(`RustDesk ist bereits installiert!\nID: ${formData.rustdeskId}`);
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
        setError('Keine SSH-Verbindung konfiguriert. Bitte wählen Sie zuerst eine SSH-Verbindung aus.');
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
            alert(`RustDesk ist installiert!\nID: ${rustdeskId}`);
            
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
      setError('Fehler beim Prüfen des RustDesk-Status');
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
        setSuccess('Kommando erfolgreich erstellt');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error creating command:', error);
      setError('Fehler beim Erstellen des Kommandos');
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
    if (!window.confirm('Wirklich löschen?')) return;

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
          // Add some basic formatting
          coloredOutput = `<span style="color: ${result.success ? '#0f0' : '#f00'}">${outputText}</span>`;
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
      setCommandOutput({
        ...commandOutput,
        [command.id]: {
          success: false,
          output: 'Fehler beim Ausführen des Kommandos',
          htmlOutput:
            '<span style="color: red">Fehler beim Ausführen des Kommandos</span>',
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

  // Tab components - Visual Tab entfernt
  const tabs = ['commands', 'service'];
  const tabLabels = {
    commands: { icon: Command, label: 'Kommandos' },
    service: { icon: Edit, label: 'Service-Einstellungen' },
  };

  // Debug logging
  useEffect(() => {

  }, [activeTabIndex]);

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        width: `${panelWidth}px`,
        height: '100%',
        backgroundColor: 'rgba(118, 118, 128, 0.12)',  // Gleich wie Audit Log
        backdropFilter: 'blur(30px) saturate(150%)',   // Gleich wie Audit Log
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
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2,
            height: 40,
            backgroundColor: isResizing
              ? 'var(--primary-color)'
              : 'rgba(255, 255, 255, 0.3)',
            borderRadius: 1,
            transition: 'background-color 0.2s',
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
      {console.log('[ServicePanel Render] formData.name:', formData.name, 'appliance.name:', appliance?.name)}
      <UnifiedPanelHeader 
        title={appliance?.isNew ? 'Neuer Service' : formData.name || appliance?.name || 'Service bearbeiten'}
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
                    Kommando aus Vorlagen wählen
                  </Typography>
                </Box>

                {/* Search bar */}
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    placeholder="Suche nach Service oder Kommando..."
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
                    sx={{
                      '& .MuiInputBase-root': {
                        backgroundColor: 'var(--container-bg)',
                      },
                    }}
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
                        ? 'Keine Kommandos gefunden.'
                        : 'Keine verfügbaren Kommandos zum Kopieren.'}
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
                                onClick={() => handleSelectTemplate(command)}
                                sx={{
                                  background:
                                    selectedTemplate?.id === command.id
                                      ? 'rgba(0, 122, 255, 0.2)'
                                      : 'var(--container-bg)',  
                                  backdropFilter: 'blur(10px)',
                                  border:
                                    selectedTemplate?.id === command.id
                                      ? '2px solid var(--primary-color)'
                                      : '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '12px',
                                  p: 3,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    backgroundColor:
                                      'var(--container-bg)',
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
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
                  sx={{
                    background: 'var(--container-bg)',  
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    p: 4,
                    mb: 4,
                    border: '1px solid var(--container-border)',
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
                      Neues Kommando erstellen
                    </Typography>
                  </Box>
                  {showNewCommandForm && (
                    <Box
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
                    >
                    <TextField
                      fullWidth
                      label="Beschreibung"
                      value={newCommand.description}
                      onChange={e =>
                        setNewCommand({
                          ...newCommand,
                          description: e.target.value,
                        })
                      }
                      placeholder="Beschreibung des Befehls (z.B. was macht dieser Befehl, wann wird er verwendet)"
                      multiline
                      rows={3}
                      sx={{
                        '& .MuiInputLabel-root': {
                          color: 'var(--text-secondary)',
                        },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'var(--primary-color)',
                          },
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Kommando"
                      value={newCommand.command}
                      onChange={e =>
                        setNewCommand({
                          ...newCommand,
                          command: e.target.value,
                        })
                      }
                      placeholder="z.B. systemctl restart nginx"
                      sx={{
                        '& .MuiInputLabel-root': {
                          color: 'var(--text-secondary)',
                        },
                        '& .MuiInputBase-root': {
                          color: 'var(--text-primary)',
                          fontFamily: 'Monaco, Consolas, monospace',
                          backgroundColor: 'var(--container-bg)',
                        },
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: 'var(--primary-color)',
                          },
                        },
                      }}
                    />
                    <FormControl fullWidth>
                      <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                        SSH-Host
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
                        label="SSH-Host"
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
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="">Lokal ausführen</MenuItem>
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
                        Hinzufügen
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
                        Aus Vorlagen
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
                    Gespeicherte Kommandos
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
                        Noch keine Kommandos gespeichert
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
                            sx={{
                              background: 'var(--container-bg)',  
                              backdropFilter: 'blur(10px)',
                              border: '1px solid var(--container-border)',
                              borderRadius: '12px',
                              p: 3,
                              transition:
                                'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'relative',
                              overflow: 'hidden',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                                background:
                                  'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
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
                                  sx={{
                                    '& .MuiInputBase-root': {
                                      color: 'var(--text-primary)',
                                      backgroundColor:
                                        'var(--container-bg)',
                                    },
                                    '& .MuiOutlinedInput-root': {
                                      '& fieldset': {
                                        borderColor: 'rgba(255, 255, 255, 0.2)',
                                      },
                                    },
                                  }}
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
                                  sx={{
                                    '& .MuiInputBase-root': {
                                      color: 'var(--text-primary)',
                                      fontFamily: 'Monaco, Consolas, monospace',
                                      backgroundColor:
                                        'var(--container-bg)',
                                    },
                                    '& .MuiOutlinedInput-root': {
                                      '& fieldset': {
                                        borderColor: 'rgba(255, 255, 255, 0.2)',
                                      },
                                    },
                                  }}
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
                                    title="Ausführen"
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
                                    title="Terminal"
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
                                    title="Bearbeiten"
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
                                    title="Löschen"
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
                                          ? '✓ Erfolgreich'
                                          : '✗ Fehler'}{' '}
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
                                        color: '#ffffff',
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
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                Grundinformationen
              </Typography>

              <TextField
                fullWidth
                label="Name"
                value={(() => {
                  console.log('[ServicePanel TextField] formData.name value:', formData.name);
                  return formData.name;
                })()}
                onChange={e => handleFieldChange('name', e.target.value)}
                margin="normal"
                required
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
                label="URL"
                value={formData.url}
                onChange={e => handleFieldChange('url', e.target.value)}
                margin="normal"
                required
                placeholder="https://example.com"
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
                label="Beschreibung"
                value={formData.description}
                onChange={e => handleFieldChange('description', e.target.value)}
                margin="normal"
                multiline
                rows={3}
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

              <FormControl fullWidth margin="normal">
                <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                  Kategorie
                </InputLabel>
                <Select
                  value={formData.category}
                  onChange={e => handleFieldChange('category', e.target.value)}
                  label="Kategorie"
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
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                Symbol und Farbe
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
                    Klicken Sie auf das Symbol, um es zu ändern
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
                  Vorschau mit Effekten
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
                  Transparenz: {visualSettings.transparency}%
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
                  Unschärfe: {visualSettings.blur}px
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
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                Öffnungsmodus
              </Typography>

            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                Mini-Widget Modus
              </InputLabel>
              <Select
                value={formData.openModeMini || 'browser_tab'}
                onChange={e =>
                  handleFieldChange('openModeMini', e.target.value)
                }
                label="Mini-Widget Modus"
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
                <MenuItem value="browser_tab">Browser neuer Tab</MenuItem>
                <MenuItem value="browser_window">
                  Browser neues Fenster
                </MenuItem>
                <MenuItem value="safari_pwa">Safari PWA Modus</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                Mobile/iPad Modus
              </InputLabel>
              <Select
                value={formData.openModeMobile || 'browser_tab'}
                onChange={e =>
                  handleFieldChange('openModeMobile', e.target.value)
                }
                label="Mobile/iPad Modus"
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
                <MenuItem value="browser_tab">Browser neuer Tab</MenuItem>
                <MenuItem value="browser_window">
                  Browser neues Fenster
                </MenuItem>
                <MenuItem value="safari_pwa">Safari PWA Modus</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                Desktop Modus
              </InputLabel>
              <Select
                value={formData.openModeDesktop || 'browser_tab'}
                onChange={e =>
                  handleFieldChange('openModeDesktop', e.target.value)
                }
                label="Desktop Modus"
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
                <MenuItem value="browser_tab">Browser neuer Tab</MenuItem>
                <MenuItem value="browser_window">
                  Browser neues Fenster
                </MenuItem>
                <MenuItem value="safari_pwa">Safari PWA Modus</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* SSH-Einstellungen Card */}
          {adminMode && (
            <Box
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                p: 3,
                mb: 3,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: 'var(--text-primary)' }}
              >
                SSH-Einstellungen
              </Typography>

                <FormControl fullWidth margin="normal">
                  <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                    SSH-Verbindung
                  </InputLabel>
                  <Select
                    value={formData.sshConnection || ''}
                    onChange={e =>
                      handleFieldChange('sshConnection', e.target.value)
                    }
                    label="SSH-Verbindung"
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
                    <MenuItem value="">Keine SSH-Verbindung</MenuItem>
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
                    SSH-Verbindungen können in den Einstellungen konfiguriert
                    werden.
                  </Typography>
                )}

                <TextField
                  fullWidth
                  label="Status-Prüfbefehl"
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
                  helperText="Das Kommando sollte 'status: running' oder 'status: stopped' ausgeben"
                  FormHelperTextProps={{
                    sx: { color: 'var(--text-secondary)' },
                  }}
                />

                <TextField
                  fullWidth
                  label="Start-Befehl"
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
                  label="Stopp-Befehl"
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
            )}
          </Box>
        )}

        {/* Remote Desktop Card */}
        <Box
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            p: 3,
            mb: 3,
          }}
        >
          <Typography
            variant="h6"
            sx={{ mb: 2, color: 'var(--text-primary)' }}
          >
            Remote Desktop
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
                    value={formData.remoteDesktopType || 'guacamole'}
                    onChange={e => handleFieldChange('remoteDesktopType', e.target.value)}
                    label="Remote Desktop Typ"
                    sx={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--container-bg)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  >
                    <MenuItem value="guacamole">Guacamole (Classic)</MenuItem>
                    <MenuItem value="rustdesk">RustDesk (Schneller)</MenuItem>
                  </Select>
                </FormControl>

                {/* Guacamole Performance Mode Selector */}
                {formData.remoteDesktopType === 'guacamole' && (
                  <Box sx={{ my: 2 }}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                        Performance Mode
                      </InputLabel>
                      <Select
                        value={formData.guacamolePerformanceMode || 'balanced'}
                        onChange={e => handleFieldChange('guacamolePerformanceMode', e.target.value)}
                        label="Performance Mode"
                        sx={{
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--container-bg)',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                          },
                        }}
                      >
                        <MenuItem value="high-quality">High Quality - Beste visuelle Qualität</MenuItem>
                        <MenuItem value="balanced">Balanced - Gute Balance zwischen Qualität und Performance</MenuItem>
                        <MenuItem value="performance">Performance - Niedrigere Qualität, schnellere Reaktion</MenuItem>
                        <MenuItem value="low-bandwidth">Low Bandwidth - Minimale Bandbreite</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {/* Protokoll nur für Guacamole anzeigen */}
                {formData.remoteDesktopType !== 'rustdesk' && (
                  <FormControl fullWidth margin="normal">
                    <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                      Protokoll
                    </InputLabel>
                    <Select
                      value={formData.remoteProtocol || 'vnc'}
                      onChange={e => handleFieldChange('remoteProtocol', e.target.value)}
                      label="Protokoll"
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
                      label="Host-Adresse"
                      value={formData.remoteHost || ''}
                      onChange={e => handleFieldChange('remoteHost', e.target.value)}
                      margin="normal"
                      placeholder={extractHostFromUrl(formData.url) || '192.168.1.100'}
                      helperText="IP-Adresse oder Hostname des Remote Desktop Servers"
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
                      label="Port"
                      type="number"
                      value={formData.remotePort || (formData.remoteProtocol === 'rdp' ? 3389 : 5900)}
                      onChange={e => handleFieldChange('remotePort', parseInt(e.target.value) || '')}
                      margin="normal"
                      placeholder={formData.remoteProtocol === 'rdp' ? '3389' : '5900'}
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
                      label="Benutzername"
                      value={formData.remoteUsername || ''}
                      onChange={e => handleFieldChange('remoteUsername', e.target.value)}
                      margin="normal"
                      placeholder={formData.remoteProtocol === 'rdp' ? 'Administrator' : 'alflewerken'}
                      helperText={formData.remoteProtocol === 'vnc' ? 'Optional für VNC (z.B. für macOS)' : 'Erforderlich für RDP'}
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
                      label="Passwort"
                      type="password"
                      value={formData.remotePassword || ''}
                      onChange={e => handleFieldChange('remotePassword', e.target.value)}
                      margin="normal"
                      helperText="Wird verschlüsselt gespeichert"
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
                      placeholder="z.B. 196611"
                      helperText="Die RustDesk ID des Remote-Geräts (wird automatisch erkannt oder kann manuell eingegeben werden)"
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
                      helperText="Das Passwort für die RustDesk-Verbindung (wird verschlüsselt gespeichert)"
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
                      RustDesk nutzt eine ID-basierte Verbindung. Falls noch nicht installiert, wird RustDesk automatisch beim ersten Klick auf den Remote Desktop Button installiert.
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
                      {checkingRustDeskStatus ? 'Prüfe Status...' : 'RustDesk Installations Status'}
                    </Button>

                    {!formData.sshConnection && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        Bitte wählen Sie zuerst eine SSH-Verbindung aus, um den RustDesk-Status zu prüfen.
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
                Änderungen speichern
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
                  Löschen
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
                Löschen
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Abbrechen
              </Button>
            </>
          }
        >
          Möchten Sie diesen Service wirklich löschen?
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
