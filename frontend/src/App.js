import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';

// Initialize background state early
import './utils/backgroundInitializer';

// Import Auth Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Import Services
import { ApplianceService } from './services/applianceService';

// Import Components
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import AppContent from './components/AppContent';
import MobileSearchHeader from './components/MobileSearchHeader';
import BackgroundImage from './components/BackgroundImage';
import SettingsPanel from './components/SettingsPanel';
import ServicePanel from './components/ServicePanel';
import SSHKeyManager from './components/SSHKeyManager';
import TTYDTerminal from './components/TTYDTerminal';
import MobileHeader from './components/MobileHeader';
import Login from './components/Login';
import UserPanel from './components/UserPanel';
import { openTerminalInNewWindow } from './utils/terminalWindow';
import { AuditLogPanel } from './components/AuditLog';
import SSEDebugPanel from './components/SSEDebugPanel';

// Import Contexts
import { SSEProvider } from './contexts/SSEContext';

// Import Hooks
import {
  useAppliances,
  useCategories,
  useSettings,
  useBackground,
  useDragAndDrop,
  useSimpleSwipe,
  useSSE,
} from './hooks';
import { useVisibilityChange } from './hooks/useVisibilityChange';
import { useIPadCategorySwipe } from './hooks/useIPadCategorySwipe';

// Import Utils
import {
  iconMap,
  constants,
  getFilteredAppliances,
  getTimeBasedSections,
  getAllCategories,
} from './utils';
import './utils/lightModeIconFix';

// Import Styles
import './App.css';
import './theme.css';
import './mobile.css';
import './styles/panel-layout.css'; // Multi-panel layout system
import './styles/mobile-panels.css'; // Mobile panel safe area support
import './styles/mobile-panel-overflow-fix.css'; // Mobile panel overflow fix
import './styles/mobile-panel-scroll-fix.css'; // Mobile panel scroll fix
import './styles/transparent-panels-mode.css'; // Transparent Panels Toggle
import './styles/header-unification.css'; // Header height unification
import './styles/macos-input-fix.css'; // macOS input alignment fix
import './styles/service-panel-header.css'; // Service panel header unification
import './styles/safari-theme-fix.css';
import './styles/ipad-swipe.css';
import './styles/ios-scroll-fix.css';
import './styles/mobile-content-fix.css';
import './styles/mobile-override-fix.css';
import './styles/mini-dashboard.css';
import './styles/Auth.css';
import './styles/text-colors-fix.css'; // Text und Label Farben für Dark/Light Mode
import './styles/modal-theme-support.css'; // Modal Theme Support für Dark/Light Mode
import './styles/settings-panel-clean.css'; // SAUBERER Fix für Settings Panel
import './components/terminal-light-mode.css'; // Terminal Light Mode Styles
import './styles/fixes/header-light-mode-fix.css'; // Fix für transparenten Header im Light Mode

// Dashboard Component - Only rendered when authenticated
function Dashboard() {
  const { isAdmin } = useAuth();

  // Local State für UI-Komponenten
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [selectedServiceForPanel, setSelectedServiceForPanel] = useState(null);
  const [showSSHManager, setShowSSHManager] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [activeTerminals, setActiveTerminals] = useState([]);
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');

  const [sshHosts, setSSHHosts] = useState([]);
  const [isLoadingSSHHosts, setIsLoadingSSHHosts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isMiniDashboard, setIsMiniDashboard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('desktop-sidebar-collapsed');
      return saved === 'true';
    } catch (error) {
      return false;
    }
  });
  const [cardSize, setCardSize] = useState(() => {
    try {
      const savedCardSize = localStorage.getItem('dashboard-card-size');
      if (savedCardSize) {
        const parsedSize = parseInt(savedCardSize, 10);
        if (!isNaN(parsedSize) && parsedSize >= 60 && parsedSize <= 300) {
          return parsedSize;
        }
      }
    } catch (error) {
      console.warn('Failed to load card size from localStorage:', error);
    }
    return 180;
  });
  const [showOnlyWithStatus, setShowOnlyWithStatus] = useState(() => {
    try {
      const savedStatusFilter = localStorage.getItem('dashboard-status-filter');
      return savedStatusFilter === 'true';
    } catch (error) {
      console.warn('Failed to load status filter from localStorage:', error);
    }
    return false;
  });
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [servicePanelWidth, setServicePanelWidth] = useState(() => {
    const saved = localStorage.getItem('servicePanelWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [userPanelWidth, setUserPanelWidth] = useState(() => {
    const saved = localStorage.getItem('userPanelWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [settingsPanelWidth, setSettingsPanelWidth] = useState(() => {
    const saved = localStorage.getItem('settingsPanelWidth');
    return saved ? parseInt(saved, 10) : 600;
  });
  const [auditLogPanelWidth, setAuditLogPanelWidth] = useState(() => {
    const saved = localStorage.getItem('auditLogPanelWidth');
    return saved ? parseInt(saved, 10) : 800;
  });

  // Custom Hooks für Datenmanagement - nur wenn authentifiziert
  const {
    appliances,
    loading,
    error,
    fetchAppliances,
    createAppliance,
    updateAppliance,
    patchAppliance,
    deleteAppliance,
    toggleFavorite,
    openAppliance,
  } = useAppliances();

  const {
    apiCategories,
    categoriesLastUpdated,
    handleCategoriesUpdate,
    reorderCategories,
  } = useCategories();

  const {
    selectedCategory,
    setSelectedCategory,
    adminMode,
    loadAndApplyTheme,
    forceUpdate,
    applyTheme,
  } = useSettings();

  const {
    currentBackground,
    backgroundImages,
    backgroundSettings,
    backgroundRef,
    settingsVersion,
    setBackgroundSettings,
    setBackgroundImages,
    loadCurrentBackground,
    loadBackgroundSettings,
    uploadBackgroundImage,
    activateBackground,
    deleteBackgroundImage,
    disableBackground,
    handleBackgroundSettingsUpdate,
  } = useBackground();

  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useDragAndDrop(
      showSettingsModal,
      activeSettingsTab,
      setActiveSettingsTab,
      setShowSettingsModal,
      null, // setFormData - nicht mehr benötigt
      null, // setEditingAppliance - nicht mehr benötigt
      null, // setShowModal - nicht mehr benötigt
      uploadBackgroundImage,
      selectedCategory,
      // Neue Parameter für Service Panel
      setSelectedServiceForPanel,
      setShowServicePanel
    );

  // Simple swipe gesture hook for mobile sidebar
  useSimpleSwipe(sidebarOpen, setSidebarOpen);

  // Load SSH hosts when needed
  useEffect(() => {
    const loadSSHHosts = async () => {
      if (showServicePanel && !sshHosts.length && !isLoadingSSHHosts) {
        setIsLoadingSSHHosts(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/ssh/hosts', {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
          });
          const data = await response.json();
          if (data.success && data.hosts) {
            setSSHHosts(data.hosts);
          }
        } catch (error) {
          console.error('Error loading SSH hosts:', error);
        } finally {
          setIsLoadingSSHHosts(false);
        }
      }
    };

    loadSSHHosts();
  }, [showServicePanel, sshHosts.length, isLoadingSSHHosts]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      const { scrollY } = window;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isMobile, sidebarOpen]);

  // Check for mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Check for mini dashboard mode (width OR height < 300px)
      // Removed minimum size restriction - allow any size
      const miniDashboard = width < 300 || height < 300;
      setIsMiniDashboard(miniDashboard);

      // Mobile check (not mini dashboard)
      const mobile = width <= 768 && !miniDashboard;
      setIsMobile(mobile);

      if (mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Make handleTerminalOpen available globally for SSH Manager
  const handleTerminalOpen = useCallback((target) => {
    console.log('handleTerminalOpen called with:', target);
    
    // Check if it's an SSH host or an appliance
    if (target.hostname && target.username) {
      // It's an SSH host
      // Prüfe ob bereits ein Terminal zu diesem Host offen ist
      const existingSSHTerminal = activeTerminals.find(
        t => t.host && t.host.id === target.id && t.isOpen
      );
      
      if (existingSSHTerminal) {
        // Öffne in neuem Fenster statt im Modal
        openTerminalInNewWindow({
          hostId: target.id,
          host: target.hostname,
          user: target.username,
          port: target.port || 22
        });
      } else {
        // Erstes Terminal - öffne im Modal
        const sshTerminal = {
          id: `ssh_terminal_${target.id}_${Date.now()}`,
          host: target,
          isOpen: true,
          isSSH: true,
        };
        console.log('Creating SSH terminal:', sshTerminal);
        setActiveTerminals(prev => [...prev, sshTerminal]);
      }
    } else {
      // It's an appliance
      const existingTerminal = activeTerminals.find(
        t => t.appliance && t.appliance.id === target.id && t.isOpen
      );
      
      if (existingTerminal) {
        // Terminal bereits offen - öffne in neuem Fenster
        const sshData = {};
        if (target.ssh_host_id && target.ssh_host) {
          sshData.hostId = target.ssh_host_id;
          sshData.host = target.ssh_host.hostname || '';
          sshData.user = target.ssh_host.username || '';
          sshData.port = target.ssh_host.port || 22;
        }
        openTerminalInNewWindow(sshData);
      } else {
        // Erstes Terminal - öffne im Modal
        const newTerminal = {
          id: `terminal_${target.id}_${Date.now()}`,
          appliance: target,
          isOpen: true,
        };
        setActiveTerminals(prev => [...prev, newTerminal]);
      }
    }
  }, [activeTerminals]);

  // Make it globally available for compatibility
  useEffect(() => {
    window.handleTerminalOpen = handleTerminalOpen;
    return () => {
      delete window.handleTerminalOpen;
    };
  }, [handleTerminalOpen]);

  // Set initial load complete when data is loaded
  useEffect(() => {
    if (!loading && !initialLoadComplete) {
      // Add a small delay to prevent flashing
      const timer = setTimeout(() => {
        setInitialLoadComplete(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, initialLoadComplete]);

  // Add/remove body class for background image
  useEffect(() => {
    if (currentBackground && backgroundSettings.enabled) {
      document.body.classList.add('has-background-image');
      document.documentElement.classList.add('has-background-image');
      document.body.setAttribute('data-opacity', backgroundSettings.opacity);
    } else {
      document.body.classList.remove('has-background-image');
      document.documentElement.classList.remove('has-background-image');
      document.body.removeAttribute('data-opacity');
    }
    return () => {
      document.body.classList.remove('has-background-image');
      document.documentElement.classList.remove('has-background-image');
      document.body.removeAttribute('data-opacity');
    };
  }, [
    currentBackground,
    backgroundSettings.enabled,
    backgroundSettings.opacity,
  ]);

  // Add/remove body class when panels are open on mobile
  useEffect(() => {
    if (
      isMobile &&
      (showServicePanel ||
        showUserManagement ||
        showSettingsModal ||
        showAuditLog)
    ) {
      document.body.classList.add('has-open-panel');
      
      // Add specific class for each panel
      if (showServicePanel) document.body.classList.add('has-service-panel');
      if (showUserManagement) document.body.classList.add('has-user-panel');
      if (showSettingsModal) document.body.classList.add('has-settings-panel');
      if (showAuditLog) document.body.classList.add('has-audit-log-panel');
      
      // Save current scroll position
      const { scrollY } = window;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.classList.remove('has-open-panel');
        document.body.classList.remove('has-service-panel');
        document.body.classList.remove('has-user-panel');
        document.body.classList.remove('has-settings-panel');
        document.body.classList.remove('has-audit-log-panel');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [
    isMobile,
    showServicePanel,
    showUserManagement,
    showSettingsModal,
    showAuditLog,
  ]);

  // Statische Kategorien für Sidebar
  const { staticCategories } = constants;

  // Alle Kategorien kombiniert
  const allCategories = useMemo(
    () =>
      getAllCategories(
        staticCategories,
        apiCategories,
        iconMap,
        categoriesLastUpdated
      ),
    [staticCategories, apiCategories, categoriesLastUpdated]
  );

  // SSE listener für Kategorie-Löschungen
  useEffect(() => {
    const unsubscribeCategoryDeleted = addEventListener(
      'category_deleted',
      data => {
        // Prüfe ob die gelöschte Kategorie die aktuell ausgewählte ist
        const deletedCategoryName = apiCategories.find(
          cat => cat.id === data.id
        )?.name;
        if (deletedCategoryName && selectedCategory === deletedCategoryName) {
          console.log(
            '📡 App.js - Currently selected category was deleted, switching to "all"'
          );
          setSelectedCategory('all');
        }
      }
    );

    return () => {
      unsubscribeCategoryDeleted();
    };
  }, [selectedCategory, apiCategories, addEventListener]);

  // iPad Swipe-Funktionalität
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isIPad =
    /iPad|Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
  const swipeEnabled = isTouch || isIPad;

  const swipeInfo = useIPadCategorySwipe(
    allCategories,
    selectedCategory,
    setSelectedCategory,
    swipeEnabled
  );

  // Wrapper-Funktion für setCardSize mit Validierung
  const handleCardSizeChange = newSize => {
    const validatedSize = Math.max(60, Math.min(300, parseInt(newSize, 10)));
    setCardSize(validatedSize);
  };

  // Speichere Einstellungen in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dashboard-card-size', cardSize.toString());
    } catch (error) {}
  }, [cardSize]);

  // Speichere Desktop-Sidebar-Zustand
  useEffect(() => {
    try {
      localStorage.setItem(
        'desktop-sidebar-collapsed',
        desktopSidebarCollapsed.toString()
      );
    } catch (error) {}
  }, [desktopSidebarCollapsed]);

  // Update window title based on mini dashboard mode and selected category
  useEffect(() => {
    if (isMiniDashboard) {
      // In mini dashboard mode, show only the category name in the title
      let categoryTitle = 'Dashboard';

      if (selectedCategory === 'all') {
        categoryTitle = 'Alle Services';
      } else if (selectedCategory === 'favorites') {
        categoryTitle = 'Favoriten';
      } else if (selectedCategory === 'recent') {
        categoryTitle = 'Zuletzt verwendet';
      } else if (selectedCategory) {
        // For custom categories, find the category name
        const category = allCategories.find(cat => cat.id === selectedCategory);
        if (category) {
          categoryTitle = category.name;
        }
      }

      document.title = categoryTitle;
    } else {
      // Normal mode - restore default title
      document.title = 'Web Appliance Dashboard';
    }
  }, [isMiniDashboard, selectedCategory, allCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'dashboard-status-filter',
        showOnlyWithStatus.toString()
      );
    } catch (error) {}
  }, [showOnlyWithStatus]);

  // Initialize SSE connection
  const { addEventListener } = useSSE();

  // Listen for restore_completed event
  useEffect(() => {
    const handleRestoreCompleted = data => {
      const message =
        `✅ Wiederherstellung abgeschlossen!\n\n` +
        `Wiederhergestellte Daten:\n` +
        `• ${data.restored_items?.appliances || 0} Services\n` +
        `• ${data.restored_items?.categories || 0} Kategorien\n` +
        `• ${data.restored_items?.settings || 0} Einstellungen\n` +
        `• ${data.restored_items?.background_images || 0} Hintergrundbilder\n` +
        `• ${data.restored_items?.ssh_keys || 0} SSH-Schlüssel\n` +
        `• ${data.restored_items?.ssh_hosts || 0} SSH-Hosts\n\n` +
        `Die Seite wird jetzt neu geladen...`;

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    const unsubscribe = addEventListener(
      'restore_completed',
      handleRestoreCompleted
    );
    return () => {
      unsubscribe();
    };
  }, [addEventListener]);

  // Listen for category updates
  useEffect(() => {
    if (addEventListener) {
      const unsubscribers = [
        addEventListener('category_created', (data) => {
          console.log('Category created event received:', data);
          handleCategoriesUpdate();
        }),
        addEventListener('category_updated', (data) => {
          console.log('Category updated event received:', data);
          handleCategoriesUpdate();
        }),
        addEventListener('category_deleted', (data) => {
          console.log('Category deleted event received:', data);
          handleCategoriesUpdate();
        }),
        addEventListener('category_restored', (data) => {
          console.log('Category restored event received:', data);
          handleCategoriesUpdate();
        }),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, handleCategoriesUpdate]);

  // Listen for appliance updates
  useEffect(() => {
    if (addEventListener) {
      const unsubscribers = [
        addEventListener('appliance_created', (data) => {
          console.log('Appliance created event received:', data);
          fetchAppliances();
        }),
        addEventListener('appliance_updated', (data) => {
          console.log('Appliance updated event received:', data);
          fetchAppliances();
        }),
        addEventListener('appliance_deleted', (data) => {
          console.log('Appliance deleted event received:', data);
          fetchAppliances();
        }),
        addEventListener('appliance_restored', (data) => {
          console.log('Appliance restored event received:', data);
          fetchAppliances();
        }),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, fetchAppliances]);

  // Refresh data when app becomes visible
  useVisibilityChange(() => {
    setTimeout(() => {
      fetchAppliances();
      handleCategoriesUpdate();
      if (loadAndApplyTheme) loadAndApplyTheme();
      if (loadCurrentBackground) loadCurrentBackground();
      if (loadBackgroundSettings) loadBackgroundSettings();
    }, 100);
  });

  // Event Handlers
  const getValidCategoryForNewService = () => {
    const staticCategories = ['all', 'favorites', 'recent'];
    if (selectedCategory && !staticCategories.includes(selectedCategory)) {
      return selectedCategory;
    }
    return 'productivity';
  };

  const handleAddService = () => {
    // Create a new empty appliance object for the form
    const newAppliance = {
      ...constants.defaultFormData,
      category: getValidCategoryForNewService(),
      isNew: true, // Flag to indicate this is a new service
    };
    setSelectedServiceForPanel(newAppliance);
    setShowServicePanel(true);
  };

  const startEdit = (appliance, initialTab = 'service') => {
    console.log(
      'startEdit called for appliance:',
      appliance,
      'with tab:',
      initialTab
    );
    // Öffne das ServicePanel statt des Modals
    setSelectedServiceForPanel({ ...appliance, initialTab });
    setShowServicePanel(true);
  };

  const handleServiceAction = async (appliance, action) => {
    if (!appliance) {
      console.error('handleServiceAction called with null appliance');
      return false;
    }

    if (action === 'start') {
      return startService(appliance);
    } else if (action === 'stop') {
      return stopService(appliance);
    } else if (action === 'status') {
      return true;
    }
    return false;
  };

  const startService = async appliance => {
    if (!appliance || !appliance.startCommand) {
      console.error('startService called with invalid appliance:', appliance);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/services/${appliance.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        let result;
        try {
          result = await response.json();
          console.log('Service started successfully:', result);
        } catch (jsonError) {
          console.log('Service started successfully (no JSON response)');
        }

        // Show success message
        alert(`Service "${appliance.name}" started successfully!`);

        // Trigger a refresh of the appliance data to update status
        setTimeout(() => {
          fetchAppliances();
        }, 1000); // Wait a bit for the status to update
      } else {
        let errorMsg = 'Unknown error';
        try {
          const result = await response.json();
          errorMsg = result.error || result.message || 'Unknown error';
        } catch (jsonError) {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('Failed to start service:', errorMsg);
        alert(`Failed to start service: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error starting service:', error);
      alert(`Failed to start service: ${error.message || 'Network error'}`);
    }
  };

  const stopService = async appliance => {
    if (!appliance || !appliance.stopCommand) {
      console.error('stopService called with invalid appliance:', appliance);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/services/${appliance.id}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        let result;
        try {
          result = await response.json();
          console.log('Service stopped successfully:', result);
        } catch (jsonError) {
          console.log('Service stopped successfully (no JSON response)');
        }

        // Show success message
        alert(`Service "${appliance.name}" stopped successfully!`);

        // Trigger a refresh of the appliance data to update status
        setTimeout(() => {
          fetchAppliances();
        }, 1000); // Wait a bit for the status to update
      } else {
        let errorMsg = 'Unknown error';
        try {
          const result = await response.json();
          errorMsg = result.error || result.message || 'Unknown error';
        } catch (jsonError) {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('Failed to stop service:', errorMsg);
        alert(`Failed to stop service: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error stopping service:', error);
      alert(`Failed to stop service: ${error.message || 'Network error'}`);
    }
  };

  const handleServiceStatusUpdate = async (applianceId, newStatus) => {
    try {
      // Status updates are handled by SSE events in useAppliances hook
      // This function is kept for compatibility but doesn't need to do anything
      console.log(`Service status update: ${applianceId} -> ${newStatus}`);
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  };

  const handleUpdateCardSettings = async (applianceId, settings) => {
    console.log('handleUpdateCardSettings called with:', {
      applianceId,
      settings,
    });

    try {
      // Build update data - only send the fields that were provided
      const updateData = {};
      if (settings.name !== undefined) updateData.name = settings.name;
      if (settings.description !== undefined)
        updateData.description = settings.description;
      if (settings.icon !== undefined) updateData.icon = settings.icon;
      if (settings.color !== undefined) updateData.color = settings.color;
      if (settings.transparency !== undefined)
        updateData.transparency = settings.transparency;
      if (settings.blur !== undefined) updateData.blur = settings.blur;

      console.log('Sending to patchAppliance:', updateData);

      const success = await ApplianceService.patchAppliance(
        applianceId,
        updateData
      );

      console.log('patchAppliance result:', success);

      if (success) {
        // Success - the useAppliances hook will update the state via SSE
        console.log('Card settings updated successfully');
      } else {
        // Error
        console.error('Failed to update card settings');
        await fetchAppliances(); // Reload to get correct data
      }
    } catch (error) {
      // Error
      console.error('Error updating card settings:', error);
      await fetchAppliances(); // Reload to get correct data
    }
  };

  const handleTerminalClose = useCallback(terminalId => {
    setActiveTerminals(prev =>
      prev.filter(terminal => terminal.id !== terminalId)
    );
  }, []);

  const handleOpenTerminalInNewWindow = useCallback(() => {
    // Öffne ein neues Terminal-Fenster ohne spezifische SSH-Daten
    openTerminalInNewWindow({});
  }, []);

  // Settings Panel Handlers
  const handleApplyTheme = useCallback(theme => {
    // Apply theme logic here
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, []);

  const handleReorderCategories = useCallback(
    async orderedCategories => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/categories/reorder', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ categories: orderedCategories }),
        });

        if (!response.ok) throw new Error('Failed to reorder categories');

        console.log('Categories reordered successfully');
        await handleCategoriesUpdate();
      } catch (error) {
        console.error('Error reordering categories:', error);
      }
    },
    [handleCategoriesUpdate]
  );

  // Calculate individual panel positions
  const calculatePanelPosition = panelType => {
    if (isMobile) return 0;

    let position = 0;

    // Panels are ordered from right to left: Settings -> User -> Service
    if (panelType === 'service') {
      if (showUserManagement) position += userPanelWidth;
      if (showSettingsModal) position += settingsPanelWidth;
    } else if (panelType === 'user') {
      if (showSettingsModal) position += settingsPanelWidth;
    }
    // Settings panel is always at the rightmost position (position = 0)

    return position;
  };

  // Gefilterte Daten
  const filteredAppliances = isMiniDashboard
    ? appliances // Show all appliances in mini dashboard mode
    : getFilteredAppliances(
        appliances,
        selectedCategory,
        searchTerm,
        showOnlyWithStatus
      );
  const sections =
    selectedCategory === 'recent' ? getTimeBasedSections(appliances) : null;

  // Loading State - only show on initial load
  if (loading && !initialLoadComplete) {
    return (
      <div className="loading">
        <Activity className="spin" />
        <span>Lade Ihre Services...</span>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        className="error-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ color: '#ff4444', marginBottom: '20px' }}>
          ❌ Fehler beim Laden der Services
        </h2>
        <p style={{ marginBottom: '10px' }}>{error}</p>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Bitte stellen Sie sicher, dass das Backend läuft (Port 3001)
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Seite neu laden
        </button>
      </div>
    );
  }

  return (
    <div
      className={`music-app ${isMiniDashboard ? 'mini-dashboard' : ''} ${isMobile ? 'mobile-layout' : ''} ${isMobile && sidebarOpen ? 'sidebar-active' : ''} ${currentBackground && backgroundSettings.enabled ? 'has-background-image' : ''} ${showServicePanel ? 'has-service-panel' : ''} ${showUserManagement ? 'has-user-panel' : ''} ${showSettingsModal ? 'has-settings-panel' : ''} ${showAuditLog ? 'has-audit-log-panel' : ''} ${!isMobile && desktopSidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        '--background-blur': `${backgroundSettings.blur}px`,
        '--background-opacity': backgroundSettings.opacity,
        '--background-position': backgroundSettings.position,
        '--card-size': `${cardSize}px`,
        '--service-panel-width': `${servicePanelWidth}px`,
        '--user-panel-width': `${userPanelWidth}px`,
        '--settings-panel-width': `${settingsPanelWidth}px`,
        '--audit-log-panel-width': `${auditLogPanelWidth}px`,
      }}
    >
      {/* Background Image Component - Now with key for force re-render */}
      <BackgroundImage
        key={`bg-${settingsVersion}-${backgroundSettings.opacity}-${backgroundSettings.blur}-${backgroundSettings.position}`}
        currentBackground={currentBackground}
        backgroundSettings={backgroundSettings}
        backgroundRef={backgroundRef}
      />

      {/* Mobile Header - Only visible on mobile, not in mini dashboard */}
      {isMobile && !isMiniDashboard && (
        <>
          <MobileHeader
            onMenuClick={() => setSidebarOpen(true)}
            title="Meine Services"
          />
          <MobileSearchHeader
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            cardSize={cardSize}
            setCardSize={handleCardSizeChange}
            showOnlyWithStatus={showOnlyWithStatus}
            setShowOnlyWithStatus={setShowOnlyWithStatus}
          />
        </>
      )}

      {/* Navigation Sidebar - Hide in mini dashboard mode */}
      {!isMiniDashboard && (
        <AppSidebar
          allCategories={allCategories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          appliances={appliances}
          onAddService={handleAddService}
          setShowSettingsModal={setShowSettingsModal}
          setShowUserManagement={setShowUserManagement}
          setShowAuditLog={setShowAuditLog}
          isOpen={isMobile ? sidebarOpen : true}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
          isCollapsed={!isMobile && desktopSidebarCollapsed}
        />
      )}

      {/* Main Content Area */}
      <main
        className={`main-content ${isMobile && sidebarOpen ? 'sidebar-open' : ''}`}
      >
        {/* Search Header - Only visible on desktop, not in mini dashboard */}
        {!isMobile && !isMiniDashboard && (
          <AppHeader
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            cardSize={cardSize}
            setCardSize={handleCardSizeChange}
            showOnlyWithStatus={showOnlyWithStatus}
            setShowOnlyWithStatus={setShowOnlyWithStatus}
            sidebarCollapsed={desktopSidebarCollapsed}
            onToggleSidebar={() =>
              setDesktopSidebarCollapsed(!desktopSidebarCollapsed)
            }
            onOpenTerminalInNewWindow={handleOpenTerminalInNewWindow}
          />
        )}

        {/* Content Grid */}
        <div className="content-body">
          <AppContent
            filteredAppliances={filteredAppliances}
            searchTerm={searchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            allCategories={allCategories}
            sections={sections}
            onOpen={openAppliance}
            onEdit={startEdit}
            onDelete={deleteAppliance}
            onToggleFavorite={toggleFavorite}
            onServiceAction={handleServiceAction}
            onServiceStatusUpdate={handleServiceStatusUpdate}
            onAddService={handleAddService}
            onTerminalOpen={handleTerminalOpen}
            onUpdateSettings={handleUpdateCardSettings}
            isMobile={isMobile}
            appliances={appliances}
            cardSize={cardSize}
            currentBackground={currentBackground}
            backgroundSettings={backgroundSettings}
            adminMode={isAdmin}
            forceUpdate={forceUpdate}
            isIPad={isIPad}
            swipeInfo={swipeInfo}
            showOnlyWithStatus={showOnlyWithStatus}
          />
        </div>
      </main>

      {showServicePanel && selectedServiceForPanel && (
        <div className="panel-container service-panel-container">
          <ServicePanel
            appliance={selectedServiceForPanel}
            initialTab={selectedServiceForPanel.initialTab}
            onClose={() => {
              setShowServicePanel(false);
              setSelectedServiceForPanel(null);
            }}
            onSave={async (applianceId, data) => {
              if (selectedServiceForPanel.isNew) {
                // Create new appliance
                const newAppliance = await createAppliance(data);
                if (newAppliance && newAppliance.id) {
                  // Update the selected service to the created one (remove isNew flag)
                  setSelectedServiceForPanel(newAppliance);
                }
              } else {
                // Update existing appliance
                await ApplianceService.patchAppliance(applianceId, data);
              }
              await fetchAppliances();
              // Panel bleibt geöffnet - nicht automatisch schließen
            }}
            onDelete={async appliance => {
              await deleteAppliance(appliance.id);
              // Beim Löschen schließen wir das Panel
              setShowServicePanel(false);
              setSelectedServiceForPanel(null);
            }}
            onUpdateSettings={handleUpdateCardSettings}
            categories={allCategories.slice(3)}
            allServices={appliances}
            sshHosts={sshHosts}
            isLoadingSSHHosts={isLoadingSSHHosts}
            adminMode={isAdmin}
            onWidthChange={width => setServicePanelWidth(width)}
          />
        </div>
      )}

      {showSettingsModal && (
        <div className="panel-container settings-panel-container">
          <SettingsPanel
            onClose={() => setShowSettingsModal(false)}
            onCategoriesUpdate={handleCategoriesUpdate}
            onReorderCategories={handleReorderCategories}
            onApplyTheme={handleApplyTheme}
            onBackgroundSettingsUpdate={handleBackgroundSettingsUpdate}
            apiCategories={apiCategories}
            categoriesLastUpdated={categoriesLastUpdated}
            currentBackground={currentBackground}
            backgroundImages={backgroundImages}
            backgroundSettings={backgroundSettings}
            setBackgroundSettings={setBackgroundSettings}
            activeTab={activeSettingsTab}
            setActiveTab={setActiveSettingsTab}
            onActivateBackground={activateBackground}
            onDeleteBackground={deleteBackgroundImage}
            onDisableBackground={disableBackground}
            setBackgroundImages={setBackgroundImages}
            onOpenSSHManager={() => setShowSSHManager(true)}
            onTerminalOpen={handleTerminalOpen}
            isAdmin={isAdmin}
            onWidthChange={setSettingsPanelWidth}
          />
        </div>
      )}

      {showSSHManager && (
        <SSHKeyManager
          isOpen={showSSHManager}
          onClose={() => setShowSSHManager(false)}
        />
      )}

      {showUserManagement && (
        <div className="panel-container user-panel-container">
          <UserPanel
            onClose={() => setShowUserManagement(false)}
            onWidthChange={setUserPanelWidth}
          />
        </div>
      )}

      {showAuditLog && (
        <div className="panel-container audit-log-panel-container">
          <AuditLogPanel
            onClose={() => setShowAuditLog(false)}
            onWidthChange={setAuditLogPanelWidth}
          />
        </div>
      )}

      {activeTerminals.map(terminal => (
        <TTYDTerminal
          key={terminal.id}
          show={terminal.isOpen}
          onHide={() => handleTerminalClose(terminal.id)}
          hostId={terminal.host?.id || terminal.appliance?.ssh_host_id}
          host={terminal.host}
          appliance={terminal.appliance}
          title={`Terminal - ${terminal.host?.hostname || terminal.appliance?.name || 'Web Terminal'}`}
        />
      ))}

      {/* SSE Debug Panel - nur im Development Mode */}
      {process.env.NODE_ENV === 'development' && <SSEDebugPanel />}
    </div>
  );
}

// Main App Component with Auth
function AppWithAuth() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Show loading while checking auth status
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
        }}
      >
        <div>Lade...</div>
      </div>
    );
  }

  // Show login if user is not authenticated
  if (!isAuthenticated()) {
    return <Login />;
  }

  // Show dashboard when authenticated
  return <Dashboard />;
}

// App wrapper with AuthProvider
function App() {
  return (
    <AuthProvider>
      <SSEProvider>
        <AppWithAuth />
      </SSEProvider>
    </AuthProvider>
  );
}

export default App;
