import React, { useState, useEffect, useRef, useCallback } from 'react';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import { usePanelResize, getPanelStyles, getResizeHandleStyles } from '../../hooks/usePanelResize';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Switch,
  FormControlLabel,
  TextField,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  FormGroup,
  Tooltip,
  ListItemIcon,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  X,
  Settings,
  Home,
  Image,
  FolderOpen,
  Archive,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Upload,
  Download,
  Wifi,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import SimpleIcon from '../SimpleIcon';
import { BackupService } from '../../services/backupService';
import { CategoryService } from '../../services/categoryService';
import { SettingsService } from '../../services/settingsService';
import { useSSE } from '../../hooks/useSSE';
import { backgroundSyncManager } from '../../utils/backgroundSyncManager';
import CategoryModal from './CategoryModal';
import BackgroundSettingsMUI from './BackgroundSettingsMUI';
import BackupTab from './BackupTab';
import './SettingsModal.css';
import './SettingsPanel.css';

const SettingsPanel = ({
  onClose,
  onCategoriesUpdate,
  onReorderCategories,
  onApplyTheme,
  onBackgroundSettingsUpdate,
  apiCategories,
  categoriesLastUpdated,
  currentBackground,
  backgroundImages,
  backgroundSettings,
  setBackgroundSettings,
  activeTab: initialActiveTab,
  setActiveTab: parentSetActiveTab,
  onActivateBackground,
  onDeleteBackground,
  onDisableBackground,
  setBackgroundImages,
  loadCurrentBackground,
  onOpenSSHManager,
  onTerminalOpen,
  isAdmin,
  onWidthChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // All tabs - some are admin only
  const tabs = [
    { icon: Home, label: 'Allgemein', key: 'general', adminOnly: false },
    { icon: Image, label: 'UI-Config', key: 'background', adminOnly: false },
    { icon: FolderOpen, label: 'Kategorien', key: 'categories', adminOnly: true },
    { icon: Archive, label: 'Backup', key: 'backup', adminOnly: true },
    { icon: RefreshCw, label: 'System', key: 'system', adminOnly: true },
  ];

  // Filter tabs based on admin status
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  // EINHEITLICHER RESIZE-HOOK (ersetzt alten Code)
  const { panelWidth, isResizing, startResize, panelRef } = usePanelResize(
    'settingsPanelWidth',
    600,
    onWidthChange
  );

  // Find initial tab index
  const getInitialTabIndex = () => {
    const index = visibleTabs.findIndex(tab => tab.key === initialActiveTab);
    return index !== -1 ? index : 0;
  };

  const [tabValue, setTabValue] = useState(getInitialTabIndex());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Local state for categories to enable immediate UI updates
  const [localCategories, setLocalCategories] = useState(apiCategories || []);
  
  // Update local categories when prop changes
  useEffect(() => {
    setLocalCategories(apiCategories || []);
  }, [apiCategories]);
  // Load current background when background tab is opened
  useEffect(() => {
    const currentTab = visibleTabs[tabValue]?.key;
    if (currentTab === 'background' && loadCurrentBackground) {
      loadCurrentBackground();
    }
  }, [tabValue, loadCurrentBackground, visibleTabs]);

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState({
    default_category: 'all',
    theme_mode: 'dark',
    items_per_page: '20',
    auto_refresh: 'false',
    admin_mode: 'false',
  });
  const [generalLoading, setGeneralLoading] = useState(true);

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    service_poll_interval: '60',
  });
  const [systemLoading, setSystemLoading] = useState(true);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);

  // Drag state for categories
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragCounter = useRef(0);
  
  // Touch drag state
  const [touchDragData, setTouchDragData] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const dragItemRef = useRef(null);
  const listRef = useRef(null);

  // SSE Hook
  const { addEventListener } = useSSE();

  // Track if data has been loaded
  const dataLoaded = useRef({
    general: false,
    system: false,
  });

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);

    // Notify parent if needed
    if (parentSetActiveTab && visibleTabs[newValue]) {
      parentSetActiveTab(visibleTabs[newValue].key);
    }
  };

  // Handle swipe change
  const handleSwipeChange = (index) => {
    setTabValue(index);
    
    // Notify parent if needed
    if (parentSetActiveTab && visibleTabs[index]) {
      parentSetActiveTab(visibleTabs[index].key);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (visibleTabs[tabValue]) {
      const currentTab = visibleTabs[tabValue].key;

      if (currentTab === 'general' && !dataLoaded.current.general) {
        fetchGeneralSettings();
        dataLoaded.current.general = true;
      } else if (currentTab === 'system' && !dataLoaded.current.system) {
        fetchSystemSettings();
        dataLoaded.current.system = true;
      }
    }
  }, [tabValue]);

  // SSE event listeners for categories
  useEffect(() => {
    if (addEventListener && visibleTabs[tabValue]?.key === 'categories') {
      const unsubscribers = [
        addEventListener('category_created', (data) => {

          if (onCategoriesUpdate) {
            onCategoriesUpdate();
          }
        }),
        addEventListener('category_updated', (data) => {

          if (onCategoriesUpdate) {
            onCategoriesUpdate();
          }
        }),
        addEventListener('category_deleted', (data) => {

          if (onCategoriesUpdate) {
            onCategoriesUpdate();
          }
        }),
        addEventListener('category_restored', (data) => {

          if (onCategoriesUpdate) {
            onCategoriesUpdate();
          }
        }),
        addEventListener('category_reverted', (data) => {

          if (onCategoriesUpdate) {
            onCategoriesUpdate();
          }
        }),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, visibleTabs, tabValue, onCategoriesUpdate]);

  // SSE event listeners for settings updates
  useEffect(() => {
    if (addEventListener) {
      const unsubscribers = [
        addEventListener('setting_update', (data) => {

          // Update local state if current tab is affected
          if (data.key && generalSettings.hasOwnProperty(data.key)) {
            setGeneralSettings(prev => ({ ...prev, [data.key]: data.value }));
            
            // Apply theme changes if needed
            if (data.key === 'theme_mode' && onApplyTheme) {
              onApplyTheme(data.value);
            }
          } else if (data.key && systemSettings.hasOwnProperty(data.key)) {
            setSystemSettings(prev => ({ ...prev, [data.key]: data.value }));
          }
        }),
        addEventListener('settings_bulk_update', (data) => {

          // Update all settings that match
          const newGeneralSettings = { ...generalSettings };
          const newSystemSettings = { ...systemSettings };
          let generalUpdated = false;
          let systemUpdated = false;
          
          Object.entries(data).forEach(([key, value]) => {
            if (generalSettings.hasOwnProperty(key)) {
              newGeneralSettings[key] = value;
              generalUpdated = true;
              
              // Apply theme changes if needed
              if (key === 'theme_mode' && onApplyTheme) {
                onApplyTheme(value);
              }
            } else if (systemSettings.hasOwnProperty(key)) {
              newSystemSettings[key] = value;
              systemUpdated = true;
            }
          });
          
          if (generalUpdated) {
            setGeneralSettings(newGeneralSettings);
          }
          if (systemUpdated) {
            setSystemSettings(newSystemSettings);
          }
        }),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, generalSettings, systemSettings, onApplyTheme]);

  // General Settings Functions
  const fetchGeneralSettings = async () => {
    try {
      setGeneralLoading(true);
      const data = await SettingsService.fetchSettings();
      setGeneralSettings(data);

      if (data.theme_mode && onApplyTheme) {
        onApplyTheme(data.theme_mode);
      }
    } catch (error) {
      setError('Fehler beim Laden der Einstellungen');
    } finally {
      setGeneralLoading(false);
    }
  };

  const handleGeneralSettingChange = async (key, value) => {
    setGeneralSettings(prev => ({ ...prev, [key]: value }));

    if (key === 'theme_mode' && onApplyTheme) {
      onApplyTheme(value);
    }

    try {
      await SettingsService.updateSetting(key, value);
      setSuccess(`Einstellung gespeichert`);
      setTimeout(() => setSuccess(''), 2000);

      if (onCategoriesUpdate) {
        await onCategoriesUpdate();
      }
    } catch (error) {
      setError(`Fehler beim Speichern`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // System Settings Functions
  const fetchSystemSettings = async () => {
    try {
      setSystemLoading(true);
      const data = await SettingsService.fetchSettings();
      setSystemSettings({
        service_poll_interval: data.service_poll_interval || '60',
      });
    } catch (error) {
      setError('Fehler beim Laden der System-Einstellungen');
    } finally {
      setSystemLoading(false);
    }
  };

  const handleSystemSettingChange = async (key, value) => {
    setSystemSettings(prev => ({ ...prev, [key]: value }));

    try {
      await SettingsService.updateSetting(key, value);
      setSuccess(`Einstellung gespeichert`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      setError(`Fehler beim Speichern`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // Category Functions
  const handleCategorySave = async formData => {
    try {
      setLoading(true);

      if (editingCategory) {
        await CategoryService.updateCategory(editingCategory.id, formData);
        setSuccess('Kategorie erfolgreich aktualisiert');
      } else {
        await CategoryService.createCategory(formData);
        setSuccess('Kategorie erfolgreich erstellt');
      }

      setShowCategoryModal(false);
      setEditingCategory(null);

      // Update categories after save
      if (onCategoriesUpdate) {
        await onCategoriesUpdate();
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Fehler beim Speichern der Kategorie');
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async category => {
    if (
      !window.confirm(
        `Möchten Sie die Kategorie "${category.name}" wirklich löschen?`
      )
    ) {
      return;
    }

    try {
      await CategoryService.deleteCategory(category.id);
      setSuccess('Kategorie erfolgreich gelöscht');

      // Update categories after delete
      if (onCategoriesUpdate) {
        await onCategoriesUpdate();
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message || 'Fehler beim Löschen der Kategorie');
    }
  };

  // Improved Drag & Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = e => {
    e.currentTarget.style.opacity = '';
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    dragCounter.current++;

    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = e => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Calculate drop position for last element
    if (draggedIndex !== null) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const { height } = rect;

      // If dragging over the bottom half of the last item, prepare to drop after it
      if (y > height / 2) {
        const currentIndex = parseInt(
          e.currentTarget.getAttribute('data-index')
        );
        if (currentIndex === localCategories.length - 1) {
          setDragOverIndex(localCategories.length);
        }
      }
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    dragCounter.current = 0;

    // Use dragOverIndex if it's set (for dropping at the end)
    const actualDropIndex = dragOverIndex !== null ? dragOverIndex : dropIndex;

    if (draggedIndex !== null && draggedIndex !== actualDropIndex) {
      // Create new order array
      const newCategories = [...localCategories];
      const draggedCategory = newCategories[draggedIndex];

      // Remove from old position
      newCategories.splice(draggedIndex, 1);

      // Adjust drop index if needed
      let insertIndex = actualDropIndex;
      if (draggedIndex < actualDropIndex) {
        insertIndex = actualDropIndex - 1;
      }

      // Insert at new position
      newCategories.splice(insertIndex, 0, draggedCategory);

      // Update local state immediately for visual feedback
      setLocalCategories(newCategories);

      // Create ordered array with IDs and new order
      const orderedCategories = newCategories.map((cat, index) => ({
        id: cat.id,
        order: index,
      }));

      if (onReorderCategories) {
        onReorderCategories(orderedCategories);
      } else {
      }
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Mobile-friendly category reordering
  const moveCategory = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCategories.length) return;
    
    const newCategories = [...localCategories];
    const [moved] = newCategories.splice(index, 1);
    newCategories.splice(newIndex, 0, moved);
    
    // Update local state immediately for visual feedback
    setLocalCategories(newCategories);
    
    const orderedCategories = newCategories.map((cat, idx) => ({
      id: cat.id,
      order: idx,
    }));
    
    if (onReorderCategories) {
      onReorderCategories(orderedCategories);
    } else {
    }
  };

  // Touch event handlers for mobile drag & drop
  const handleTouchStart = (e, index) => {

    e.stopPropagation(); // Prevent event bubbling
    
    const touch = e.touches?.[0] || e; // Handle both touch and pointer events
    setTouchStartY(touch.clientY);
    setDraggedIndex(index);
    setTouchDragData({
      index,
      startY: touch.clientY,
      element: e.currentTarget,
    });
    
    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
    e.currentTarget.classList.add('touch-dragging');
    
    // Prevent scrolling while dragging
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.classList.add('touch-dragging');
  };

  const handleTouchMove = (e) => {
    if (draggedIndex === null) return;
    
    e.preventDefault(); // Prevent scrolling
    e.stopPropagation();
    
    const touch = e.touches?.[0] || e; // Handle both touch and pointer events
    const currentY = touch.clientY;
    
    // Find which element we're over
    const elements = listRef.current?.querySelectorAll('[data-index]');
    if (!elements) return;
    
    let targetIndex = null;
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      
      // Check if we're in the top or bottom half of the element
      if (currentY >= rect.top && currentY <= rect.bottom) {
        const elIndex = parseInt(el.getAttribute('data-index'));
        
        // Determine if we should insert before or after
        if (currentY < midpoint) {
          targetIndex = elIndex;
        } else {
          targetIndex = elIndex + 1;
        }
      }
    });
    
    // Remove previous hover states
    elements.forEach(el => el.classList.remove('touch-drop-target'));
    
    if (targetIndex !== null && targetIndex !== draggedIndex) {
      setDragOverIndex(targetIndex);
      // Add visual feedback to the target
      const targetEl = targetIndex < elements.length ? elements[targetIndex] : null;
      if (targetEl) {
        targetEl.classList.add('touch-drop-target');
      }
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedIndex !== null) {
      // Reset visual state
      const draggedElement = listRef.current?.querySelector(`[data-index="${draggedIndex}"]`);
      if (draggedElement) {
        draggedElement.style.opacity = '';
        draggedElement.classList.remove('touch-dragging');
      }
      
      // Remove all hover states
      const elements = listRef.current?.querySelectorAll('[data-index]');
      elements?.forEach(el => el.classList.remove('touch-drop-target'));
      
      // Perform the drop if we have a valid target
      if (dragOverIndex !== null && draggedIndex !== dragOverIndex) {
        // Reorder the categories
        const newCategories = [...localCategories];
        const draggedCategory = newCategories[draggedIndex];
        
        // Remove from old position
        newCategories.splice(draggedIndex, 1);
        
        // Adjust drop index if needed
        let insertIndex = dragOverIndex;
        if (draggedIndex < dragOverIndex) {
          insertIndex = dragOverIndex - 1;
        }
        
        // Insert at new position
        newCategories.splice(insertIndex, 0, draggedCategory);
        
        // Update local state immediately for visual feedback
        setLocalCategories(newCategories);
        
        // Create ordered array with IDs and new order
        const orderedCategories = newCategories.map((cat, index) => ({
          id: cat.id,
          order: index,
        }));
        
        if (onReorderCategories) {
          onReorderCategories(orderedCategories);
        } else {
        }
      }
    }
    
    // Reset state
    setTouchDragData(null);
    setTouchStartY(null);
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    // Re-enable scrolling
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.classList.remove('touch-dragging');
  };

  // Map visible tab indices to their content
  const getTabContent = (tab) => {
    switch (tab.key) {
      case 'general':
        return (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            {generalLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <FormControl fullWidth margin="normal">
                  <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                    Standard-Startseite
                  </InputLabel>
                  <Select
                    value={generalSettings.default_category}
                    onChange={e =>
                      handleGeneralSettingChange(
                        'default_category',
                        e.target.value
                      )
                    }
                    label="Standard-Startseite"
                    sx={{
                      color: 'var(--text-primary)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  >
                    <MenuItem value="all">Alle Services</MenuItem>
                    <MenuItem value="recent">Zuletzt verwendet</MenuItem>
                    <MenuItem value="favorites">Favoriten</MenuItem>
                    {localCategories.map(category => (
                      <MenuItem key={category.name} value={category.name}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <InputLabel sx={{ color: 'var(--text-secondary)' }}>
                    Design-Modus
                  </InputLabel>
                  <Select
                    value={generalSettings.theme_mode}
                    onChange={e =>
                      handleGeneralSettingChange('theme_mode', e.target.value)
                    }
                    label="Design-Modus"
                    sx={{
                      color: 'var(--text-primary)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  >
                    <MenuItem value="dark">Dunkler Modus</MenuItem>
                    <MenuItem value="light">Heller Modus</MenuItem>
                    <MenuItem value="auto">Automatisch (System)</MenuItem>
                  </Select>
                </FormControl>

                <Alert severity="success" sx={{ mt: 3 }}>
                  <Check
                    size={16}
                    style={{ marginRight: 8, verticalAlign: 'middle' }}
                  />
                  Alle Änderungen werden automatisch gespeichert
                </Alert>
              </Box>
            )}
          </Box>
        );

      case 'background':
        return (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            <BackgroundSettingsMUI
              backgroundSettings={backgroundSettings}
              setBackgroundSettings={setBackgroundSettings}
              backgroundImages={backgroundImages}
              setBackgroundImages={setBackgroundImages}
              currentBackground={currentBackground}
              onActivateBackground={onActivateBackground}
              onDeleteBackground={onDeleteBackground}
              SettingsService={SettingsService}
              backgroundSyncManager={backgroundSyncManager}
            />
          </Box>
        );

      case 'categories':
        return (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexShrink: 0 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Plus size={20} />}
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
              >
                Neue Kategorie
              </Button>
              
              {/* Mobile Reorder Button - only show on small screens */}
              <Button
                variant={reorderMode ? "contained" : "outlined"}
                onClick={() => setReorderMode(!reorderMode)}
                startIcon={reorderMode ? <Check size={20} /> : <GripVertical size={20} />}
                sx={{ 
                  minWidth: 120,
                  display: { xs: 'flex', md: 'none' }, // Only show on mobile
                  backgroundColor: reorderMode ? 'success.main' : undefined,
                  '&:hover': {
                    backgroundColor: reorderMode ? 'success.dark' : undefined,
                  }
                }}
              >
                {reorderMode ? 'Fertig' : 'Sortieren'}
              </Button>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
              <List ref={listRef} sx={{ pb: 2 }}>
                {localCategories && localCategories.length > 0 ? (
                  <>
                    {localCategories.map((category, index) => {
                      const isDropTarget =
                        dragOverIndex === index && draggedIndex !== index;
                      const showTopIndicator =
                        isDropTarget &&
                        draggedIndex !== null &&
                        draggedIndex > index;
                      const showBottomIndicator =
                        isDropTarget &&
                        draggedIndex !== null &&
                        draggedIndex < index;

                      return (
                        <React.Fragment key={category.id}>
                          {/* Top drop indicator */}
                          {showTopIndicator && (
                            <Box
                              sx={{
                                height: '3px',
                                backgroundColor: 'var(--primary-color)',
                                margin: '8px 16px',
                                borderRadius: '2px',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 0 8px var(--primary-color)',
                              }}
                            />
                          )}
                          <ListItem
                            draggable
                            data-index={index}
                            onDragStart={e => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragEnter={e => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={e => handleDrop(e, index)}
                            onPointerDown={e => {
                              // Use pointer events for better mobile support
                              if (e.pointerType === 'touch') {
                                // Check if we're touching the drag handle area
                                const rect = e.currentTarget.getBoundingClientRect();
                                const relativeX = e.clientX - rect.left;
                                if (relativeX < 80) { // First 80px is the drag handle area
                                  e.preventDefault();
                                  handleTouchStart(e, index);
                                }
                              }
                            }}
                            onPointerMove={e => {
                              if (e.pointerType === 'touch' && draggedIndex !== null) {
                                e.preventDefault();
                                handleTouchMove(e);
                              }
                            }}
                            onPointerUp={e => {
                              if (e.pointerType === 'touch' && draggedIndex !== null) {
                                e.preventDefault();
                                handleTouchEnd(e);
                              }
                            }}
                            sx={{
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              mb: 1,
                              borderRadius: 1,
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'move',
                              transition: 'all 0.2s ease',
                              opacity: draggedIndex === index ? 0.5 : 1,
                              transform: isDropTarget
                                ? 'scale(0.98)'
                                : 'scale(1)',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                              },
                              // Touch feedback
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                            }}
                          >
                            <ListItemIcon 
                              sx={{ 
                                minWidth: 56,
                                display: reorderMode ? 'none' : 'flex', // Hide in reorder mode
                              }}
                            >
                              <GripVertical
                                size={20}
                                style={{
                                  color: 'var(--text-secondary)',
                                  cursor: 'grab',
                                }}
                                className="drag-handle"
                              />
                            </ListItemIcon>
                            <ListItemIcon sx={{ minWidth: 48, mr: 1.5 }}>
                              <Box
                                className="category-icon-box"
                                sx={{
                                  width: 36,
                                  height: 36,
                                  bgcolor: category.color || '#8E8E93',
                                  borderRadius: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'rgba(255, 255, 255, 0.9)',
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    transform: 'scale(1.05)',
                                  },
                                }}
                              >
                                <SimpleIcon
                                  name={category.icon || 'folder'}
                                  size={20}
                                  strokeWidth={2}
                                />
                              </Box>
                            </ListItemIcon>
                            <ListItemText
                              primary={category.name}
                              secondary={`${category.appliances_count || 0} Services`}
                              primaryTypographyProps={{
                                sx: {
                                  color: 'var(--text-primary)',
                                  fontWeight: 500,
                                },
                              }}
                              secondaryTypographyProps={{
                                sx: { color: 'var(--text-secondary)' },
                              }}
                            />
                            <ListItemSecondaryAction>
                              {/* Show reorder buttons in reorder mode (mobile) */}
                              {reorderMode ? (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <IconButton
                                    edge="end"
                                    disabled={index === 0}
                                    onClick={() => moveCategory(index, 'up')}
                                    sx={{
                                      width: 36,
                                      height: 36,
                                      backgroundColor: 'rgba(0, 122, 255, 0.1)',
                                      color: 'var(--primary-color)',
                                      borderRadius: '8px',
                                      '&:hover': {
                                        backgroundColor: 'rgba(0, 122, 255, 0.2)',
                                      },
                                      '&:disabled': {
                                        opacity: 0.3,
                                      },
                                    }}
                                  >
                                    <ChevronUp size={18} />
                                  </IconButton>
                                  <IconButton
                                    edge="end"
                                    disabled={index === localCategories.length - 1}
                                    onClick={() => moveCategory(index, 'down')}
                                    sx={{
                                      width: 36,
                                      height: 36,
                                      backgroundColor: 'rgba(0, 122, 255, 0.1)',
                                      color: 'var(--primary-color)',
                                      borderRadius: '8px',
                                      '&:hover': {
                                        backgroundColor: 'rgba(0, 122, 255, 0.2)',
                                      },
                                      '&:disabled': {
                                        opacity: 0.3,
                                      },
                                    }}
                                  >
                                    <ChevronDown size={18} />
                                  </IconButton>
                                </Box>
                              ) : (
                                <>
                                  {/* Normal edit/delete buttons */}
                                  <IconButton
                                    edge="end"
                                    onClick={() => {
                                      setEditingCategory(category);
                                      setShowCategoryModal(true);
                                    }}
                                    sx={{
                                      mr: 1,
                                      width: 36,
                                      height: 36,
                                      backgroundColor: 'rgba(52, 199, 89, 0.15)',
                                      color: '#34C759',
                                      borderRadius: '8px',
                                      '&:hover': {
                                        backgroundColor:
                                          'rgba(52, 199, 89, 0.25)',
                                        color: '#34C759',
                                      },
                                    }}
                                  >
                                    <Edit size={18} />
                                  </IconButton>
                                  <IconButton
                                    edge="end"
                                    onClick={() => deleteCategory(category)}
                                    sx={{
                                      width: 36,
                                      height: 36,
                                      backgroundColor: 'rgba(255, 59, 48, 0.15)',
                                      color: '#FF3B30',
                                      borderRadius: '8px',
                                      '&:hover': {
                                        backgroundColor:
                                          'rgba(255, 59, 48, 0.25)',
                                        color: '#FF3B30',
                                      },
                                    }}
                                  >
                                    <Trash2 size={18} />
                                  </IconButton>
                                </>
                              )}
                            </ListItemSecondaryAction>
                          </ListItem>
                          {/* Bottom drop indicator */}
                          {showBottomIndicator && (
                            <Box
                              sx={{
                                height: '3px',
                                backgroundColor: 'var(--primary-color)',
                                margin: '8px 16px',
                                borderRadius: '2px',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 0 8px var(--primary-color)',
                              }}
                            />
                          )}
                          {/* Last item drop indicator */}
                          {!showBottomIndicator &&
                            index === localCategories.length - 1 &&
                            dragOverIndex === localCategories.length && (
                              <Box
                                sx={{
                                  height: '3px',
                                  backgroundColor: 'var(--primary-color)',
                                  margin: '8px 16px',
                                  borderRadius: '2px',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 0 8px var(--primary-color)',
                                }}
                              />
                            )}
                        </React.Fragment>
                      );
                    })}
                    {/* Drop zone at the end */}
                    {dragOverIndex === localCategories.length && (
                      <Box
                        sx={{
                          height: '3px',
                          backgroundColor: 'var(--primary-color)',
                          margin: '8px 16px',
                          borderRadius: '2px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 0 8px var(--primary-color)',
                        }}
                      />
                    )}
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">
                      Keine Kategorien vorhanden
                    </Typography>
                  </Box>
                )}
              </List>
            </Box>
          </Box>
        );

      case 'backup':
        return (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            <BackupTab />
          </Box>
        );

      case 'system':
        return (
          <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
            {systemLoading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <FormControl fullWidth margin="normal">
                  <TextField
                    label="Service Abfrage Intervall (Sekunden)"
                    type="number"
                    value={systemSettings.service_poll_interval}
                    onChange={e =>
                      handleSystemSettingChange(
                        'service_poll_interval',
                        e.target.value
                      )
                    }
                    InputProps={{
                      inputProps: { min: 10, max: 3600 },
                    }}
                    sx={{
                      '& .MuiInputLabel-root': {
                        color: 'var(--text-secondary)',
                      },
                      '& .MuiInputBase-root': { color: 'var(--text-primary)' },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                        },
                      },
                    }}
                  />
                </FormControl>

                <Alert severity="info" sx={{ mt: 3 }}>
                  Definiert, wie oft der Status der Services abgefragt wird
                </Alert>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      ref={panelRef}
      style={{ width: `${panelWidth}px` }}  // Width als style für Safari/iPad
      sx={getPanelStyles(isResizing)}
    >
      {/* Resize Handle - einheitlich */}
      <Box
        onMouseDown={startResize}
        onTouchStart={startResize}
        onPointerDown={startResize}
        sx={getResizeHandleStyles()}
      />

      {/* Header */}
      <UnifiedPanelHeader 
        title={visibleTabs[tabValue]?.label || 'Einstellungen'} 
        icon={visibleTabs[tabValue]?.icon || Settings} 
        onClose={onClose} 
      />

      {/* Tabs */}
      <Box
        sx={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'transparent',
          flexShrink: 0,
          minHeight: 48,
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 48,
            '& .MuiTabs-scrollButtons': {
              color: 'var(--text-secondary)',
              '&.Mui-disabled': {
                opacity: 0.3,
              },
            },
            '& .MuiTab-root': {
              color: 'var(--text-secondary)',
              minHeight: 48,
              textTransform: 'none',
              fontSize: '0.875rem',
              padding: '12px 16px',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            },
            '& .Mui-selected': {
              color: 'var(--primary-color)',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--primary-color)',
            },
          }}
        >
          {visibleTabs.map((tab, index) => {
            const IconComponent = tab.icon;
            return (
              <Tab
                key={tab.key}
                icon={<IconComponent size={20} />}
                label={tab.label}
                iconPosition="start"
              />
            );
          })}
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
          {visibleTabs.map((tab, index) => (
            <Box 
              key={tab.key} 
              sx={{ 
                width: '100%',
                height: '100%',
                overflow: 'auto',
                display: tabValue === index ? 'block' : 'none'
              }}
            >
              {getTabContent(tab)}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          open={showCategoryModal}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
          onSave={handleCategorySave}
          category={editingCategory}
          loading={loading}
        />
      )}

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
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

export default SettingsPanel;
