import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  InputAdornment,
  Collapse,
} from '@mui/material';
import {
  FolderOpen,
  Users,
  Server,
  Key,
  BarChart,
  Settings,
  Image,
  ChevronDown,
  Search,
  CheckCircle,
  Circle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const SelectiveImportDialog = ({ open, onClose, backupData }) => {
  const { t } = useTranslation();
  const [selectedItems, setSelectedItems] = useState({});
  const [itemNames, setItemNames] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerms, setSearchTerms] = useState({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [existingNames, setExistingNames] = useState({});
  const [duplicateNames, setDuplicateNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [existingHosts, setExistingHosts] = useState([]);
  const [hostMappings, setHostMappings] = useState({});

  // Fetch existing names from database
  useEffect(() => {
    if (open && !loading) {
      fetchExistingNames();
      fetchExistingHosts();
    }
  }, [open]);

  const fetchExistingNames = async () => {
    if (loading) return; // Prevent duplicate calls
    
    setLoading(true);
    try {
      // Get auth token
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: { 'Authorization': `Bearer ${token}` }
      } : {};

      // Fetch existing names for each category
      const [categoriesRes, usersRes, hostsRes, appliancesRes] = await Promise.all([
        axios.get('/api/categories', config).catch((err) => {
          console.error('Error fetching categories:', err);
          return { data: { categories: [] } };
        }),
        // The correct endpoint for users is /api/auth/users
        axios.get('/api/auth/users', config).catch((err) => {
          console.error('Error fetching users:', err);
          return { data: [] };
        }),
        axios.get('/api/hosts', config).catch((err) => {
          console.error('Error fetching hosts:', err);
          return { data: { hosts: [] } };
        }),
        axios.get('/api/appliances', config).catch((err) => {
          console.error('Error fetching appliances:', err);
          return { data: { appliances: [] } };
        }),
      ]);

      // Handle different response structures
      const categories = categoriesRes.data?.categories || categoriesRes.data || [];
      // Users endpoint returns array directly
      const users = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.users || []);
      const hosts = hostsRes.data?.hosts || hostsRes.data || [];
      const appliances = appliancesRes.data?.appliances || appliancesRes.data || [];

      const existing = {
        categories: categories.map(c => (c.name || '').toLowerCase().trim()).filter(n => n),
        users: users.map(u => (u.username || '').toLowerCase().trim()).filter(n => n),
        hosts: hosts.map(h => (h.name || '').toLowerCase().trim()).filter(n => n),
        appliances: appliances.map(a => (a.name || '').toLowerCase().trim()).filter(n => n),
        // SSH keys and background images typically use unique identifiers
        sshKeys: [],
        backgroundImages: [],
      };

      console.log('Loaded existing names:', {
        categories: existing.categories,
        users: existing.users,
        hosts: existing.hosts,
        appliances: existing.appliances,
        rawResponses: {
          categories,
          users,
          hosts,
          appliances
        }
      });
      
      setExistingNames(existing);
    } catch (error) {
      console.error('Error fetching existing names:', error);
      // Set empty arrays to prevent errors
      setExistingNames({
        categories: [],
        users: [],
        hosts: [],
        appliances: [],
        sshKeys: [],
        backgroundImages: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingHosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? {
        headers: { 'Authorization': `Bearer ${token}` }
      } : {};

      const response = await axios.get('/api/hosts', config);
      const hosts = response.data?.hosts || response.data || [];
      setExistingHosts(hosts);
      console.log('Loaded existing hosts for mapping:', hosts);
    } catch (error) {
      console.error('Error fetching existing hosts:', error);
      setExistingHosts([]);
    }
  };

  // Initialize selection state when backup data changes
  useEffect(() => {
    if (backupData && Object.keys(existingNames).length > 0) {
      console.log('Initializing with backupData and existingNames:', {
        backupData: backupData.data,
        existingNames
      });
      
      const items = {
        categories: {},
        users: {},
        hosts: {},
        sshKeys: {},
        appliances: {},
        backgroundImages: {},
        hostMetrics: {}, // Per-host metrics selection
      };
      
      const names = {
        categories: {},
        users: {},
        hosts: {},
        sshKeys: {},
        appliances: {},
        backgroundImages: {},
      };
      
      const duplicates = {
        categories: {},
        users: {},
        hosts: {},
        sshKeys: {},
        appliances: {},
        backgroundImages: {},
      };
      
      const mappings = {}; // Host mappings for SNMP metrics
      
      // Initialize all items as unselected with original names and check for duplicates
      backupData.data?.categories?.forEach(cat => {
        const id = cat.id || cat.name;
        items.categories[id] = false;
        names.categories[id] = cat.name;
        // Check if name already exists (case-insensitive with trim)
        const normalizedName = (cat.name || '').toLowerCase().trim();
        duplicates.categories[id] = (existingNames.categories || []).includes(normalizedName);
        if (duplicates.categories[id]) {
          console.log(`Duplicate found for category "${cat.name}": normalized="${normalizedName}"`);
        }
      });
      
      backupData.data?.users?.forEach(user => {
        const id = user.id || user.username;
        items.users[id] = false;
        names.users[id] = user.username;
        // Check if username already exists (case-insensitive with trim)
        const normalizedName = (user.username || '').toLowerCase().trim();
        duplicates.users[id] = (existingNames.users || []).includes(normalizedName);
        if (duplicates.users[id]) {
          console.log(`Duplicate found for user "${user.username}": normalized="${normalizedName}"`);
        }
      });
      
      backupData.data?.hosts?.forEach(host => {
        const id = host.id || host.name;
        items.hosts[id] = false;
        names.hosts[id] = host.name;
        // Check if host name already exists (case-insensitive with trim)
        const normalizedName = (host.name || '').toLowerCase().trim();
        duplicates.hosts[id] = (existingNames.hosts || []).includes(normalizedName);
        if (duplicates.hosts[id]) {
          console.log(`Duplicate found for host "${host.name}": normalized="${normalizedName}"`);
        }
        // Initialize metrics selection per host with mapping
        if (backupData.data?.snmp_metrics?.length > 0) {
          const hostMetrics = backupData.data.snmp_metrics.filter(m => 
            (m.host_id || m.hostId) === host.id
          );
          if (hostMetrics.length > 0) {
            items.hostMetrics[host.id] = false;
            // Initialize mapping to first existing host by default
            if (existingHosts.length > 0) {
              mappings[host.id] = existingHosts[0].id;
            }
          }
        }
      });
      
      backupData.data?.ssh_keys?.forEach(key => {
        const id = key.id || key.key_name || key.keyName;
        items.sshKeys[id] = false;
        names.sshKeys[id] = key.key_name || key.keyName;
        // SSH keys typically don't have duplicate name restrictions
        duplicates.sshKeys[id] = false;
      });
      
      backupData.data?.appliances?.forEach(app => {
        const id = app.id || app.name;
        items.appliances[id] = false;
        names.appliances[id] = app.name;
        // Check if appliance name already exists (case-insensitive with trim)
        const normalizedName = (app.name || '').toLowerCase().trim();
        duplicates.appliances[id] = (existingNames.appliances || []).includes(normalizedName);
        if (duplicates.appliances[id]) {
          console.log(`Duplicate found for appliance "${app.name}": normalized="${normalizedName}"`);
        }
      });
      
      backupData.data?.background_images?.forEach(img => {
        const id = img.id || img.filename;
        items.backgroundImages[id] = false;
        names.backgroundImages[id] = img.filename;
        // Background images typically use unique filenames
        duplicates.backgroundImages[id] = false;
      });
      
      setSelectedItems(items);
      setItemNames(names);
      setDuplicateNames(duplicates);
      setHostMappings(mappings);
      
      console.log('Initialization complete:', {
        items,
        names,
        duplicates
      });
      
      // Initially expand categories with few items
      const expanded = {};
      if (backupData.data?.categories?.length <= 5) expanded.categories = true;
      if (backupData.data?.users?.length <= 5) expanded.users = true;
      if (backupData.data?.ssh_keys?.length <= 5) expanded.sshKeys = true;
      setExpandedCategories(expanded);
    }
  }, [backupData, existingNames]);

  const handleToggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleToggleItem = (category, itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [itemId]: !prev[category]?.[itemId]
      }
    }));
  };

  const handleNameChange = (category, itemId, newName) => {
    setItemNames(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [itemId]: newName
      }
    }));

    // Check for duplicates
    checkForDuplicate(category, itemId, newName);
  };

  const checkForDuplicate = (category, itemId, newName) => {
    const existing = existingNames[category] || [];
    const normalizedNewName = newName.toLowerCase().trim();
    
    // Simply check if the new name exists in the database
    const isDuplicate = existing.includes(normalizedNewName);
    
    console.log(`Checking duplicate for ${category}/${itemId}: "${newName}"`, {
      existing,
      isDuplicate,
      normalizedName: normalizedNewName
    });
    
    setDuplicateNames(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [itemId]: isDuplicate
      }
    }));
  };

  const handleToggleAll = (category) => {
    const allSelected = Object.values(selectedItems[category] || {}).every(v => v);
    const newState = !allSelected;
    
    setSelectedItems(prev => ({
      ...prev,
      [category]: Object.keys(prev[category] || {}).reduce((acc, key) => {
        acc[key] = newState;
        return acc;
      }, {})
    }));
  };

  const handleSearch = (category, term) => {
    setSearchTerms(prev => ({
      ...prev,
      [category]: term
    }));
  };

  const filterItems = (items, category) => {
    const searchTerm = searchTerms[category]?.toLowerCase() || '';
    if (!searchTerm) return items;
    
    return items.filter(item => {
      const searchableText = (
        item.name || 
        item.username || 
        item.key_name || 
        item.keyName || 
        item.filename || 
        item.hostname || 
        item.description || 
        ''
      ).toLowerCase();
      
      return searchableText.includes(searchTerm);
    });
  };

  const hasAnyDuplicates = () => {
    // Only check duplicates for selected items
    return Object.keys(duplicateNames).some(category => {
      const categoryDuplicates = duplicateNames[category] || {};
      const categorySelections = selectedItems[category] || {};
      
      // Check if any selected item is a duplicate
      return Object.keys(categoryDuplicates).some(itemId => 
        categorySelections[itemId] && categoryDuplicates[itemId]
      );
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');

    try {
      // Get current user for ownership
      const authToken = localStorage.getItem('token');
      const currentUserId = localStorage.getItem('userId');
      
      // Prepare filtered backup data with renamed items
      const filteredData = {
        ...backupData,
        data: {},
        // Include encryption key for decryption
        decryption_key: encryptionKey,
        // Flag to indicate this is a selective import
        selectiveImport: true,
        createNewIds: true,
        // Current user becomes the owner
        importUserId: currentUserId,
      };

      // Add selected categories with new names
      if (selectedItems.categories) {
        const selectedCats = backupData.data.categories.filter(cat => {
          const id = cat.id || cat.name;
          return selectedItems.categories[id];
        }).map(cat => {
          const id = cat.id || cat.name;
          return {
            ...cat,
            name: itemNames.categories[id] || cat.name
          };
        });
        if (selectedCats.length > 0) {
          filteredData.data.categories = selectedCats;
        }
      }

      // Add selected users with their settings and new names
      if (selectedItems.users) {
        const selectedUsers = backupData.data.users.filter(user => {
          const id = user.id || user.username;
          return selectedItems.users[id];
        }).map(user => {
          const id = user.id || user.username;
          return {
            ...user,
            username: itemNames.users[id] || user.username
          };
        });
        if (selectedUsers.length > 0) {
          filteredData.data.users = selectedUsers;
          
          // Automatically include user settings for selected users
          if (backupData.data.user_settings || backupData.data.settings) {
            const userSettings = (backupData.data.user_settings || backupData.data.settings);
            const selectedUserIds = selectedUsers.map(u => u.id);
            filteredData.data.user_settings = userSettings.filter(setting => 
              selectedUserIds.includes(setting.user_id)
            );
          }
        }
      }

      // Add selected hosts with new names
      if (selectedItems.hosts) {
        const selectedHosts = backupData.data.hosts.filter(host => {
          const id = host.id || host.name;
          return selectedItems.hosts[id];
        }).map(host => {
          const id = host.id || host.name;
          return {
            ...host,
            name: itemNames.hosts[id] || host.name
          };
        });
        if (selectedHosts.length > 0) {
          filteredData.data.hosts = selectedHosts;
        }
      }

      // Add selected SSH keys with new names
      if (selectedItems.sshKeys) {
        const selectedKeys = backupData.data.ssh_keys.filter(key => {
          const id = key.id || key.key_name || key.keyName;
          return selectedItems.sshKeys[id];
        }).map(key => {
          const id = key.id || key.key_name || key.keyName;
          const newName = itemNames.sshKeys[id] || key.key_name || key.keyName;
          return {
            ...key,
            key_name: newName,
            keyName: newName
          };
        });
        if (selectedKeys.length > 0) {
          filteredData.data.ssh_keys = selectedKeys;
        }
      }

      // Add selected appliances with new names
      if (selectedItems.appliances) {
        const selectedApps = backupData.data.appliances.filter(app => {
          const id = app.id || app.name;
          return selectedItems.appliances[id];
        }).map(app => {
          const id = app.id || app.name;
          return {
            ...app,
            name: itemNames.appliances[id] || app.name
          };
        });
        if (selectedApps.length > 0) {
          filteredData.data.appliances = selectedApps;
          
          // WICHTIG: Commands für die ausgewählten Appliances hinzufügen!
          // Commands sind in der separaten appliance_commands Tabelle
          if (backupData.data.appliance_commands) {
            const selectedAppIds = selectedApps.map(app => app.id);
            const selectedCommands = backupData.data.appliance_commands.filter(cmd => 
              selectedAppIds.includes(cmd.appliance_id || cmd.applianceId)
            );
            if (selectedCommands.length > 0) {
              filteredData.data.appliance_commands = selectedCommands;
              console.log(`Including ${selectedCommands.length} commands for selected appliances`);
            }
          }
          
          // WICHTIG: Hosts NICHT automatisch hinzufügen!
          // Nur die explizit ausgewählten Hosts sollen importiert werden
          // Aber: Host-Informationen für das Mapping bereitstellen
          
          // Füge Host-Mapping-Informationen hinzu (NUR für Referenzen, nicht zum Import!)
          if (backupData.data.hosts && backupData.data.hosts.length > 0) {
            // Diese werden NUR für das Mapping verwendet, NICHT importiert!
            filteredData.hostMappingInfo = backupData.data.hosts;
            console.log(`Providing ${backupData.data.hosts.length} hosts for mapping (not for import)`);
          }
        }
      }

      // Add selected background images with new names
      if (selectedItems.backgroundImages) {
        const selectedImages = backupData.data.background_images.filter(img => {
          const id = img.id || img.filename;
          return selectedItems.backgroundImages[id];
        }).map(img => {
          const id = img.id || img.filename;
          return {
            ...img,
            filename: itemNames.backgroundImages[id] || img.filename
          };
        });
        if (selectedImages.length > 0) {
          filteredData.data.background_images = selectedImages;
        }
      }

      // Add metrics for selected hosts with mapping to existing hosts
      if (selectedItems.hostMetrics && backupData.data.snmp_metrics) {
        const metricsToImport = [];
        const hostMappingInfo = {};
        
        Object.keys(selectedItems.hostMetrics).forEach(backupHostId => {
          if (selectedItems.hostMetrics[backupHostId]) {
            const targetHostId = hostMappings[backupHostId];
            if (targetHostId) {
              // Store mapping info
              hostMappingInfo[backupHostId] = targetHostId;
              
              // Filter metrics for this host
              const hostMetrics = backupData.data.snmp_metrics.filter(metric => 
                String(metric.host_id || metric.hostId) === String(backupHostId)
              );
              
              // Update metrics with new host ID
              hostMetrics.forEach(metric => {
                metricsToImport.push({
                  ...metric,
                  host_id: targetHostId,
                  hostId: targetHostId,
                  // Mark as imported
                  imported: true,
                  importedAt: new Date().toISOString()
                });
              });
            }
          }
        });
        
        if (metricsToImport.length > 0) {
          filteredData.data.snmp_metrics = metricsToImport;
          filteredData.hostMappings = hostMappingInfo;
          
          // Also include monitoring data with mapped host IDs
          if (backupData.data.host_monitoring_data) {
            const monitoringData = [];
            backupData.data.host_monitoring_data.forEach(data => {
              const backupHostId = String(data.host_id || data.hostId);
              if (hostMappingInfo[backupHostId]) {
                monitoringData.push({
                  ...data,
                  host_id: hostMappingInfo[backupHostId],
                  hostId: hostMappingInfo[backupHostId]
                });
              }
            });
            if (monitoringData.length > 0) {
              filteredData.data.host_monitoring_data = monitoringData;
            }
          }
        }
      }

      // Call the selective import API endpoint
      const response = await axios.post('/api/selective-import', filteredData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        console.log('Selective import successful:', response.data);
        setImporting(false);
        onClose();
        // Refresh the page to show new data
        window.location.reload();
      } else {
        throw new Error(response.data.error || 'Import failed');
      }

    } catch (err) {
      setError(err.message || t('settings.errors.importFailed'));
      setImporting(false);
    }
  };

  const getSelectedCount = (category) => {
    if (!selectedItems[category]) return 0;
    return Object.values(selectedItems[category]).filter(v => v).length;
  };

  const getTotalCount = (category) => {
    if (!selectedItems[category]) return 0;
    return Object.keys(selectedItems[category]).length;
  };

  const renderCategoryAccordion = (category, label, icon, color, items = []) => {
    const selectedCount = getSelectedCount(category);
    const totalCount = getTotalCount(category);
    const filteredItems = filterItems(items, category);
    
    if (totalCount === 0) return null;
    
    return (
      <Accordion
        key={category}
        expanded={expandedCategories[category] || false}
        onChange={() => handleToggleCategory(category)}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          '&:before': { display: 'none' },
          mb: 1,
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown />}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color }}>
              {icon}
              <Typography variant="body1">{label}</Typography>
            </Box>
            <Chip
              label={`${selectedCount} / ${totalCount}`}
              size="small"
              sx={{
                backgroundColor: selectedCount > 0 ? color : 'rgba(255, 255, 255, 0.1)',
                color: selectedCount > 0 ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              }}
            />
          </Box>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleAll(category);
            }}
            sx={{ mr: 1 }}
          >
            {selectedCount === totalCount ? t('common.deselectAll') : t('common.selectAll')}
          </Button>
        </AccordionSummary>
        
        <AccordionDetails>
          {totalCount > 5 && (
            <TextField
              fullWidth
              size="small"
              placeholder={t('common.search')}
              value={searchTerms[category] || ''}
              onChange={(e) => handleSearch(category, e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
          )}
          
          <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredItems.map((item) => {
              const itemId = item.id || item.name || item.username || 
                           item.key_name || item.keyName || item.filename;
              const isSelected = selectedItems[category]?.[itemId] || false;
              const currentName = itemNames[category]?.[itemId] || 
                                item.name || item.username || 
                                item.key_name || item.keyName || item.filename;
              const isDuplicate = duplicateNames[category]?.[itemId] || false;
              
              return (
                <Box key={itemId} sx={{ position: 'relative', display: 'flex', alignItems: 'stretch', mb: 0.5 }}>
                  {/* Red indicator bar for duplicates */}
                  {isDuplicate && isSelected && (
                    <Box
                      sx={{
                        width: '4px',
                        backgroundColor: '#f44336',
                        borderRadius: '4px 0 0 4px',
                        mr: 1,
                      }}
                    />
                  )}
                  <ListItem
                    button
                    onClick={() => handleToggleItem(category, itemId)}
                    sx={{
                      borderRadius: 1,
                      flex: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {isSelected ? (
                        <CheckCircle size={20} style={{ color: isDuplicate ? '#f44336' : color }} />
                      ) : (
                        <Circle size={20} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {item.name || item.username || item.key_name || 
                          item.keyName || item.filename || item.hostname}
                          {isDuplicate && isSelected && (
                            <Chip
                              label={t('common.duplicate')}
                              size="small"
                              sx={{
                                height: 20,
                                backgroundColor: '#f44336',
                                color: '#ffffff',
                                border: 'none',
                                '& .MuiChip-label': {
                                  px: 1,
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                },
                              }}
                            />
                          )}
                        </Box>
                      }
                      secondary={item.description || item.email || item.hostname || 
                                item.comment || null}
                      primaryTypographyProps={{
                        sx: { color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.8)' }
                      }}
                    />
                    {item.icon && (
                      <ListItemSecondaryAction>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                          {item.icon}
                        </Typography>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                  
                  {/* Name input field when item is selected */}
                  <Collapse in={isSelected}>
                    <Box sx={{ pl: 6, pr: 2, pb: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label={t('settings.newName')}
                        value={currentName}
                        onChange={(e) => handleNameChange(category, itemId, e.target.value)}
                        error={isDuplicate}
                        helperText={isDuplicate ? t('settings.duplicateNameError') : ''}
                        InputProps={{
                          endAdornment: isDuplicate && (
                            <InputAdornment position="end">
                              <AlertCircle size={20} style={{ color: '#f44336' }} />
                            </InputAdornment>
                          ),
                          sx: {
                            '& fieldset': {
                              borderColor: isDuplicate ? '#f44336 !important' : undefined,
                              borderWidth: isDuplicate ? '2px !important' : undefined,
                            },
                            '&:hover fieldset': {
                              borderColor: isDuplicate ? '#f44336 !important' : undefined,
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: isDuplicate ? '#f44336 !important' : undefined,
                            },
                          }
                        }}
                        InputLabelProps={{
                          sx: {
                            color: isDuplicate ? '#f44336 !important' : undefined,
                            '&.Mui-focused': {
                              color: isDuplicate ? '#f44336 !important' : undefined,
                            }
                          }
                        }}
                        FormHelperTextProps={{
                          sx: {
                            color: isDuplicate ? '#f44336 !important' : '#666',
                          }
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          },
                        }}
                      />
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderHostMetrics = () => {
    const hosts = backupData?.data?.hosts || [];
    const metrics = backupData?.data?.snmp_metrics || [];
    
    if (hosts.length === 0 || metrics.length === 0) return null;
    
    // Group metrics by host
    const metricsByHost = {};
    hosts.forEach(host => {
      const hostMetrics = metrics.filter(m => 
        (m.host_id || m.hostId) === host.id
      );
      if (hostMetrics.length > 0) {
        metricsByHost[host.id] = {
          host,
          count: hostMetrics.length
        };
      }
    });
    
    const selectedCount = Object.keys(selectedItems.hostMetrics || {})
      .filter(id => selectedItems.hostMetrics[id]).length;
    const totalCount = Object.keys(metricsByHost).length;
    
    if (totalCount === 0) return null;
    
    return (
      <Accordion
        expanded={expandedCategories.hostMetrics || false}
        onChange={() => handleToggleCategory('hostMetrics')}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          '&:before': { display: 'none' },
          mb: 1,
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown />}
          sx={{
            '& .MuiAccordionSummary-content': {
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#FF5722' }}>
              <BarChart size={20} />
              <Typography variant="body1">{t('monitoring.hostMetrics')}</Typography>
            </Box>
            <Chip
              label={`${selectedCount} / ${totalCount} ${t('hosts.hosts')}`}
              size="small"
              sx={{
                backgroundColor: selectedCount > 0 ? '#FF5722' : 'rgba(255, 255, 255, 0.1)',
                color: selectedCount > 0 ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              }}
            />
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="caption">
              {t('settings.metricsImportInfo')}
            </Typography>
          </Alert>
          
          <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
            {Object.entries(metricsByHost).map(([hostId, data]) => {
              const isSelected = selectedItems.hostMetrics?.[hostId] || false;
              
              return (
                <Box key={hostId}>
                  <ListItem
                    button
                    onClick={() => handleToggleItem('hostMetrics', hostId)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {isSelected ? (
                        <CheckCircle size={20} style={{ color: '#FF5722' }} />
                      ) : (
                        <Circle size={20} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={data.host.name || data.host.hostname}
                      secondary={`${data.count.toLocaleString()} ${t('monitoring.metricsCount')}`}
                      primaryTypographyProps={{
                        sx: { color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.8)' }
                      }}
                    />
                  </ListItem>
                  
                  {/* Host Mapping Selection when selected */}
                  <Collapse in={isSelected}>
                    <Box sx={{ pl: 6, pr: 2, pb: 2 }}>
                      <TextField
                        fullWidth
                        select
                        size="small"
                        label={t('settings.importToHost')}
                        value={hostMappings[hostId] || ''}
                        onChange={(e) => {
                          setHostMappings(prev => ({
                            ...prev,
                            [hostId]: e.target.value
                          }));
                        }}
                        SelectProps={{
                          native: true,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          },
                        }}
                      >
                        <option value="">{t('settings.selectTargetHost')}</option>
                        {existingHosts.map(host => (
                          <option key={host.id} value={host.id}>
                            {host.name || host.hostname}
                          </option>
                        ))}
                      </TextField>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  const totalSelectedItems = Object.values(selectedItems).reduce((sum, category) => {
    if (typeof category === 'object') {
      return sum + Object.values(category).filter(v => v).length;
    }
    return sum;
  }, 0);

  return (
    <Dialog
      open={open}
      onClose={!importing ? onClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1E1E1E',
          backgroundImage: 'none',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="h6">
          {t('settings.selectiveImport')}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2, pb: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                {t('settings.selectiveImportDetailInfo')}
              </Typography>
            </Alert>

            {/* Encryption Key Input */}
            {(backupData?.data?.ssh_keys?.length > 0 || 
              backupData?.data?.hosts?.some(h => h.password || h.privateKey) ||
              backupData?.data?.appliances?.some(a => a.password)) && (
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  type="password"
                  label={t('backup.encryptionKey')}
                  placeholder={t('backup.enterEncryptionKeyToDecrypt')}
                  value={encryptionKey}
                  onChange={(e) => setEncryptionKey(e.target.value)}
                  helperText={t('backup.encryptionKeyHelperText')}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Key size={20} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                />
              </Box>
            )}

            {hasAnyDuplicates() && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {t('settings.duplicateNamesFound')}
                </Typography>
              </Alert>
            )}

        {/* Categories */}
        {renderCategoryAccordion(
          'categories',
          t('categories.categories'),
          <FolderOpen size={20} />,
          '#4CAF50',
          backupData?.data?.categories || []
        )}

        {/* Users */}
        {renderCategoryAccordion(
          'users',
          t('users.title'),
          <Users size={20} />,
          '#2196F3',
          backupData?.data?.users || []
        )}

        {/* Terminal Hosts */}
        {renderCategoryAccordion(
          'hosts',
          t('hosts.title'),
          <Server size={20} />,
          '#FF9800',
          backupData?.data?.hosts || []
        )}

        {/* SSH Keys */}
        {renderCategoryAccordion(
          'sshKeys',
          t('sshKeys.title'),
          <Key size={20} />,
          '#9C27B0',
          backupData?.data?.ssh_keys || []
        )}

        {/* Services/Appliances */}
        {renderCategoryAccordion(
          'appliances',
          t('services.services'),
          <Settings size={20} />,
          '#F44336',
          backupData?.data?.appliances || []
        )}

        {/* Background Images */}
        {renderCategoryAccordion(
          'backgroundImages',
          t('settings.backgroundImages'),
          <Image size={20} />,
          '#00BCD4',
          backupData?.data?.background_images || []
        )}

        {/* Host Metrics - Special handling */}
        {renderHostMetrics()}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {t('settings.selectedItems')}: {totalSelectedItems}
              </Typography>
              {backupData && (
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  {t('backup.backupCreatedAt')}: {new Date(backupData.created_at).toLocaleString()}
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Button
          onClick={onClose}
          disabled={importing}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={importing || totalSelectedItems === 0 || hasAnyDuplicates() || loading}
          startIcon={importing ? <CircularProgress size={20} /> : null}
          sx={{
            backgroundColor: hasAnyDuplicates() ? '#757575' : '#0066CC',
            '&:hover': {
              backgroundColor: hasAnyDuplicates() ? '#757575' : '#0051A2',
            },
            '&.Mui-disabled': {
              backgroundColor: '#424242',
              color: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          {importing ? t('settings.importing') : t('settings.importSelected')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelectiveImportDialog;
