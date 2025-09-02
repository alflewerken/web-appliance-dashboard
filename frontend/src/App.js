import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import axios from './utils/axiosConfig';

// Initialize background state early
import './utils/backgroundInitializer';

// Import Auth Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Import Services
import { ApplianceService } from './services/applianceService';
import { SettingsService } from './services/settingsService';

// Import Components
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import AppContent from './components/AppContent';
import MobileSearchHeader from './components/MobileSearchHeader';
import BackgroundImage from './components/BackgroundImage';
import SettingsPanel from './components/SettingsPanel/SettingsPanel';
import { ServicePanel, TTYDTerminal, SSHFileUpload } from './components/Appliances';
import MobileHeader from './components/MobileHeader';
import Login from './components/Login';
import UserPanel from './components/UserPanel';
import { HostsView, HostPanel } from './components/Hosts';
// (SSHFileUpload already imported above)
import { openTerminalInNewWindow } from './utils/terminalWindow';
import { AuditLogPanel } from './components/AuditLog';

import MobileSwipeableWrapper from './components/MobileSwipeableWrapper';

// Import Contexts
import { SSEProvider } from './contexts/SSEContext';
import sseService from './services/sseService';

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

// Import Styles
import './App.css';
import './theme.css';
import './mobile.css';
import './styles/panel-layout.css'; // Multi-panel layout system
import './styles/mobile.css'; // Mobile styles
import './styles/transparent-panels-mode.css'; // Transparent Panels Toggle
import './styles/header.css'; // Header styles
import './styles/macos-input-fix.css'; // macOS input alignment fix (keep for now)
import './styles/safari-theme-fix.css'; // Safari-specific fixes (keep for now)
import './styles/mini-dashboard.css';
import './styles/Auth.css';
import './styles/text-colors-fix.css'; // Text und Label Farben für Dark/Light Mode
import './styles/modal-theme-support.css'; // Modal Theme Support für Dark/Light Mode
import './styles/host-panel.css'; // Host Panel Styles
import './components/terminal-light-mode.css'; // Terminal Light Mode Styles
import './styles/fixes/header-light-mode-fix.css'; // Fix für transparenten Header im Light Mode
import './styles/fixes/tablet-scroll-fix.css'; // Fix für Tablet-Scrolling
import './styles/sidebar-tooltips.css';
import './styles/mui-dropdown-fix.css'; // Fix für Dropdown z-index auf Tablets
import './styles/light-mode.css'; // Alle Light Mode Fixes konsolidiert

// Dashboard Component - Only rendered when authenticated
function Dashboard() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  // Local State für UI-Komponenten
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [selectedServiceForPanel, setSelectedServiceForPanel] = useState(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showHostsView, setShowHostsView] = useState(false);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [selectedHostForPanel, setSelectedHostForPanel] = useState(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [activeTerminals, setActiveTerminals] = useState([]);
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');
  const [showSSHFileUpload, setShowSSHFileUpload] = useState(false);
  const [selectedHostForFileUpload, setSelectedHostForFileUpload] = useState(null);

  const [hosts, setHosts] = useState([]);
  const [sshHosts, setSSHHosts] = useState([]);
  const [isLoadingSSHHosts, setIsLoadingSSHHosts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isMiniDashboard, setIsMiniDashboard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar state: 'full' | 'icon-only' | 'collapsed'
  const [sidebarState, setSidebarState] = useState(() => {
    try {
      const saved = localStorage.getItem('desktop-sidebar-state');
      return saved || 'full';
    } catch (error) {
      return 'full';
    }
  });
  
  // Legacy compatibility - map old collapsed state to new state system
  const desktopSidebarCollapsed = sidebarState === 'collapsed';
  const [cardSize, setCardSize] = useState(() => {
    try {
      const savedCardSize = localStorage.getItem('dashboard-card-size');
      if (savedCardSize) {
        const parsedSize = parseInt(savedCardSize, 10);
        if (!isNaN(parsedSize) && parsedSize >= 50 && parsedSize <= 300) {
          return parsedSize;
        }
      }
    } catch (error) {

    }
    return 180;
  });
  const [showOnlyWithStatus, setShowOnlyWithStatus] = useState(() => {
    try {
      const savedStatusFilter = localStorage.getItem('dashboard-status-filter');
      return savedStatusFilter === 'true';
    } catch (error) {

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
  const [hostPanelWidth, setHostPanelWidth] = useState(() => {
    const saved = localStorage.getItem('hostPanelWidth');
    return saved ? parseInt(saved, 10) : 600;
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
    setApiCategories,
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

  const { 
    handleDragEnter, 
    handleDragOver, 
    handleDragLeave, 
    handleDrop,
    restoreDialogComponent 
  } = useDragAndDrop(
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

  // Initialize language from backend settings on mount
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Load language from backend settings
        const settings = await SettingsService.fetchSettings();
        if (settings.language && settings.language !== i18n.language) {

          await i18n.changeLanguage(settings.language);
          // Sync with localStorage for next app start
          localStorage.setItem('i18nextLng', settings.language);
        } else if (!settings.language) {
          // If no language in backend, save current language to backend
          const currentLang = i18n.language || 'en';

          await SettingsService.updateSetting('language', currentLang);
        }
      } catch (error) {
        console.error('Failed to initialize language from settings:', error);
        // Keep using current language from i18n
      }
    };

    initializeLanguage();
  }, []); // Run only once on mount

  // Load hosts when hosts view is shown
  useEffect(() => {
    const loadHosts = async () => {
      if (showHostsView) {
        try {
          const response = await axios.get('/api/hosts');
          setHosts(response.data.hosts || []);
        } catch (error) {
          console.error('Error loading hosts:', error);
        }
      }
    };

    loadHosts();
  }, [showHostsView]);

  // Subscribe to host updates via SSE
  useEffect(() => {
    if (!showHostsView) return;

    const handleHostUpdated = (data) => {
      // Reload hosts to get the latest data
      const loadHosts = async () => {
        try {
          const response = await axios.get('/api/hosts');
          setHosts(response.data.hosts || []);
        } catch (error) {
          console.error('Error reloading hosts:', error);
        }
      };
      loadHosts();
    };

    const handleHostCreated = handleHostUpdated;
    const handleHostDeleted = handleHostUpdated;

    // Connect to SSE and add event listeners
    sseService.connect().then(() => {
      sseService.addEventListener('host_created', handleHostCreated);
      sseService.addEventListener('host_updated', handleHostUpdated);
      sseService.addEventListener('host_deleted', handleHostDeleted);
    });

    // Cleanup listeners on unmount
    return () => {
      sseService.removeEventListener('host_created', handleHostCreated);
      sseService.removeEventListener('host_updated', handleHostUpdated);
      sseService.removeEventListener('host_deleted', handleHostDeleted);
    };
  }, [showHostsView]);

  // Load SSH hosts when needed
  useEffect(() => {
    const loadSSHHosts = async () => {
      if (showServicePanel && !sshHosts.length && !isLoadingSSHHosts) {
        setIsLoadingSSHHosts(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/hosts', {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
          });
          
          if (!response.ok) {
            if (response.status === 404 || response.status === 401) {
              // No hosts found or unauthorized - this is ok for new installations
              setSSHHosts([]);
              return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          if (data.success && data.hosts) {
            setSSHHosts(data.hosts);
          } else {
            setSSHHosts([]);
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
  const handleTerminalOpen = useCallback(async (target) => {

    // Check if it's an SSH host or an appliance
    if (target.hostname && target.username) {
      // It's an SSH host
      
      // Create terminal session via API first
      try {
        const response = await axios.post('/api/terminal/session', {
          hostId: target.id
        });

        // Add a small delay to ensure the session file is written
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Failed to create terminal session:', error);
      }
      
      // Prüfe ob bereits ein Terminal zu diesem Host offen ist
      const existingSSHTerminal = activeTerminals.find(
        t => t.host && t.host.id === target.id && t.isOpen
      );
      
      if (existingSSHTerminal) {
        // Öffne in neuem Fenster statt im Modal
        openTerminalInNewWindow({
          hostId: target.id,
          host: target.hostname,  // Verwende 'hostname' für die tatsächliche IP/Host
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

        setActiveTerminals(prev => [...prev, sshTerminal]);
      }
    } else {
      // It's an appliance
      
      // Check if appliance has SSH connection info
      let sshHostId = null;
      if (target.sshHostId) {
        sshHostId = target.sshHostId;
      } else if (target.sshConnection) {
        // Parse SSH connection string (e.g., "alflewerken@mac:22")
        const match = target.sshConnection.match(/^(.+)@(.+):(\d+)$/);
        if (match) {

          // For now, we can't create a session without a host ID
          // console.warn('Appliance has SSH connection but no sshHostId');
        }
      }
      
      // If appliance has SSH host, create session
      if (sshHostId) {
        try {
          const response = await axios.post('/api/terminal/session', {
            hostId: sshHostId
          });

          // Add a small delay to ensure the session file is written
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Failed to create terminal session:', error);
        }
      } else if (target.sshConnection) {
        // Try with SSH connection string
        try {
          const response = await axios.post('/api/terminal/session', {
            sshConnection: target.sshConnection
          });

          // Add a small delay to ensure the session file is written
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('Failed to create terminal session:', error);
        }
      } else {

      }
      
      const existingTerminal = activeTerminals.find(
        t => t.appliance && t.appliance.id === target.id && t.isOpen
      );
      
      if (existingTerminal) {
        // Terminal bereits offen - öffne in neuem Fenster
        const sshData = {};
        if (target.sshHostId && target.ssh_host) {
          sshData.hostId = target.sshHostId;
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
        showAuditLog ||
        showHostPanel)
    ) {
      document.body.classList.add('has-open-panel');
      
      // Add specific class for each panel
      if (showServicePanel) document.body.classList.add('has-service-panel');
      if (showUserManagement) document.body.classList.add('has-user-panel');
      if (showSettingsModal) document.body.classList.add('has-settings-panel');
      if (showAuditLog) document.body.classList.add('has-audit-log-panel');
      if (showHostPanel) document.body.classList.add('has-host-panel');
      
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
        document.body.classList.remove('has-host-panel');
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
    const validatedSize = Math.max(50, Math.min(300, parseInt(newSize, 10)));
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
      localStorage.setItem('desktop-sidebar-state', sidebarState);
      // Legacy compatibility
      localStorage.setItem(
        'desktop-sidebar-collapsed',
        (sidebarState === 'collapsed').toString()
      );
    } catch (error) {}
  }, [sidebarState]);

  // Adjust sidebar width based on state and make state globally available
  useEffect(() => {
    const root = document.documentElement;
    const uiConfig = window.uiConfigManager?.config || {};
    const fullWidth = uiConfig.sidebarWidth || 280;
    
    // Make sidebar state globally available for UIConfigManager
    window.sidebarState = sidebarState;
    
    switch(sidebarState) {
      case 'icon-only':
        root.style.setProperty('--sidebar-width', '70px');
        break;
      case 'collapsed':
        root.style.setProperty('--sidebar-width', '0px');
        break;
      case 'full':
      default:
        root.style.setProperty('--sidebar-width', `${fullWidth}px`);
        break;
    }
  }, [sidebarState]);

  // Update window title based on mini dashboard mode and selected category
  useEffect(() => {
    if (isMiniDashboard) {
      // In mini dashboard mode, show only the category name in the title
      let categoryTitle = 'Dashboard';

      if (selectedCategory === 'all') {
        categoryTitle = t('categories.all');
      } else if (selectedCategory === 'favorites') {
        categoryTitle = t('categories.favorites');
      } else if (selectedCategory === 'recent') {
        categoryTitle = t('categories.recent');
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

          handleCategoriesUpdate();
        }),
        addEventListener('category_updated', (data) => {

          handleCategoriesUpdate();
        }),
        addEventListener('category_deleted', (data) => {

          handleCategoriesUpdate();
        }),
        addEventListener('category_restored', (data) => {

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

          fetchAppliances();
        }),
        addEventListener('appliance_updated', (data) => {

          fetchAppliances();
        }),
        addEventListener('appliance_deleted', (data) => {

          fetchAppliances();
        }),
        addEventListener('appliance_restored', (data) => {

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

  const handleAddHost = () => {
    // Create a new empty host object for the form
    const newHost = {
      isNew: true, // Flag to indicate this is a new host
    };
    setSelectedHostForPanel(newHost);
    setShowHostPanel(true);
  };

  // Close all panels (for mobile swipeable wrapper)
  const closeAllPanels = () => {
    setShowServicePanel(false);
    setShowSettingsModal(false);
    setShowUserManagement(false);
    setShowHostsView(false);
    setShowHostPanel(false);
    setShowAuditLog(false);
    setSelectedServiceForPanel(null);
    setSelectedHostForPanel(null);
  };

  const startEdit = (appliance, initialTab = 'commands') => {

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

    // Add a simple debounce check
    const lastCallKey = `lastStartCall_${appliance.id}`;
    const lastCall = window[lastCallKey];
    const now = Date.now();
    
    if (lastCall && (now - lastCall) < 1000) {

      return;
    }
    
    window[lastCallKey] = now;

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

        } catch (jsonError) {

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

        } catch (jsonError) {

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

    } catch (error) {
      console.error('Error updating service status:', error);
    }
  };

  const handleUpdateCardSettings = async (applianceId, settings) => {

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

      const success = await ApplianceService.patchAppliance(
        applianceId,
        updateData
      );

      if (success) {
        // Success - the useAppliances hook will update the state via SSE

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
        // Sofort die lokale Reihenfolge aktualisieren für bessere UX
        const reorderedCategories = [...apiCategories];
        reorderedCategories.sort((a, b) => {
          const orderA = orderedCategories.find(oc => oc.id === a.id)?.order ?? 999;
          const orderB = orderedCategories.find(oc => oc.id === b.id)?.order ?? 999;
          return orderA - orderB;
        });
        setApiCategories(reorderedCategories);
        
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

        // Kategorien vom Server neu laden um sicherzustellen, dass alles synchron ist
        await handleCategoriesUpdate();
      } catch (error) {
        console.error('Error reordering categories:', error);
        // Bei Fehler die Kategorien neu vom Server laden
        await handleCategoriesUpdate();
      }
    },
    [apiCategories, setApiCategories, handleCategoriesUpdate]
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

  // Gefilterte Hosts
  const filteredHosts = useMemo(() => {
    if (!searchTerm) return hosts;
    
    const term = searchTerm.toLowerCase();
    return hosts.filter(host => 
      host.name?.toLowerCase().includes(term) ||
      host.description?.toLowerCase().includes(term) ||
      host.hostname?.toLowerCase().includes(term) ||
      host.username?.toLowerCase().includes(term)
    );
  }, [hosts, searchTerm]);

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
      className={`music-app ${isMiniDashboard ? 'mini-dashboard' : ''} ${isMobile ? 'mobile-layout' : ''} ${isMobile && sidebarOpen ? 'sidebar-active' : ''} ${currentBackground && backgroundSettings.enabled ? 'has-background-image' : ''} ${showServicePanel ? 'has-service-panel' : ''} ${showUserManagement ? 'has-user-panel' : ''} ${showSettingsModal ? 'has-settings-panel' : ''} ${showAuditLog ? 'has-audit-log-panel' : ''} ${showHostPanel ? 'has-host-panel' : ''} ${!isMobile && sidebarState === 'collapsed' ? 'sidebar-collapsed' : ''} ${!isMobile && sidebarState === 'icon-only' ? 'sidebar-icon-only' : ''}`}
      onDragEnter={(showSettingsModal && activeSettingsTab === 'backup') ? undefined : handleDragEnter}
      onDragOver={(showSettingsModal && activeSettingsTab === 'backup') ? undefined : handleDragOver}
      onDragLeave={(showSettingsModal && activeSettingsTab === 'backup') ? undefined : handleDragLeave}
      onDrop={(showSettingsModal && activeSettingsTab === 'backup') ? undefined : handleDrop}
      data-panels={`${showHostPanel ? 'host ' : ''}${showAuditLog ? 'audit ' : ''}${showServicePanel ? 'service ' : ''}${showUserManagement ? 'user ' : ''}${showSettingsModal ? 'settings' : ''}`}
      style={{
        '--background-blur': `${backgroundSettings.blur}px`,
        '--background-opacity': backgroundSettings.opacity,
        '--background-position': backgroundSettings.position,
        '--card-size': `${cardSize}px`,
        '--service-panel-width': `${servicePanelWidth}px`,
        '--user-panel-width': `${userPanelWidth}px`,
        '--settings-panel-width': `${settingsPanelWidth}px`,
        '--audit-log-panel-width': `${auditLogPanelWidth}px`,
        '--host-panel-width': `${hostPanelWidth}px`,
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
          setShowHostsView={setShowHostsView}
          setShowAuditLog={setShowAuditLog}
          showSettingsModal={showSettingsModal}
          showUserManagement={showUserManagement}
          showHostsView={showHostsView}
          showAuditLog={showAuditLog}
          isOpen={isMobile ? sidebarOpen : sidebarState !== 'collapsed'}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
          isCollapsed={!isMobile && desktopSidebarCollapsed}
          isIconOnly={!isMobile && sidebarState === 'icon-only'}
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
            sidebarState={sidebarState}
            onToggleSidebar={() => {
              // Cycle through states: full -> icon-only -> collapsed -> full
              let newState;
              switch(sidebarState) {
                case 'full':
                  newState = 'icon-only';
                  break;
                case 'icon-only':
                  newState = 'collapsed';
                  break;
                case 'collapsed':
                default:
                  newState = 'full';
                  break;
              }
              setSidebarState(newState);
            }}
            onOpenTerminalInNewWindow={handleOpenTerminalInNewWindow}
          />
        )}

        {/* Content Grid */}
        <div className="content-body">
          {showHostsView ? (
            <HostsView
              hosts={filteredHosts}
              onAddHost={handleAddHost}
              onEditHost={(host) => {
                setSelectedHostForPanel(host);
                setShowHostPanel(true);
              }}
              onTerminal={handleTerminalOpen}
              onFileTransfer={(host) => {
                // Zeige SSHFileUpload Modal für den Host
                setSelectedHostForFileUpload(host);
                setShowSSHFileUpload(true);
              }}
              onRemoteDesktop={async (host) => {
                // Open Remote Desktop for SSH host
                if (host.remoteDesktopEnabled) {
                  // Check which type of remote desktop is configured
                  if (host.remoteDesktopType === 'rustdesk' && host.rustdeskId) {
                    // Log RustDesk access to audit log
                    try {
                      await axios.post(`/api/hosts/${host.id}/rustdeskAccess`, {}, {
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                      });
                    } catch (error) {
                      console.error('Failed to log RustDesk access:', error);
                      // Continue even if logging fails
                    }
                    // Open RustDesk - use _self to avoid opening a new tab
                    window.location.href = `rustdesk://${host.rustdeskId}`;
                  } else {
                    // Use Guacamole for VNC/RDP/SSH
                    try {
                      // Get token from API
                      const response = await axios.post(`/api/hosts/${host.id}/remoteDesktopToken`, {
                        performanceMode: 'balanced'
                      });
                      
                      if (response.data.success) {
                        // Check if it's RustDesk or Guacamole
                        if (response.data.type === 'rustdesk') {
                          // RustDesk connection
                          const rustdeskId = response.data.rustdeskId;
                          if (rustdeskId) {
                            // Show RustDesk ID to user
                            if (window.showNotification) {
                              window.showNotification(`RustDesk ID: ${rustdeskId}`, 'info');
                            }
                            alert(`Bitte verwenden Sie RustDesk Client mit folgender ID:\n\n${rustdeskId}\n\nStellen Sie sicher, dass RustDesk auf dem Zielgerät läuft.`);
                          } else {
                            throw new Error('RustDesk ID nicht verfügbar');
                          }
                        } else if (response.data.type === 'guacamole') {
                          // Guacamole connection
                          let guacamoleUrl = response.data.guacamoleUrl;
                          
                          if (!guacamoleUrl) {
                            throw new Error('Guacamole URL nicht verfügbar');
                          }

                          // Fix URL if port is missing
                          // Check if URL contains the host but no port
                          if (!guacamoleUrl.includes(':9080') && !guacamoleUrl.includes(':9443')) {
                            // Extract protocol and host from URL
                            const urlMatch = guacamoleUrl.match(/^(https?:\/\/)([^\/]+)(\/.*)?$/);
                            if (urlMatch) {
                              const protocol = urlMatch[1];
                              const hostPart = urlMatch[2];
                              const pathPart = urlMatch[3] || '';
                              
                              // If hostPart doesn't contain a port, add :9080
                              if (!hostPart.includes(':')) {
                                guacamoleUrl = `${protocol}${hostPart}:9080${pathPart}`;
                              }
                            }
                          }

                          // Open in new window with specific dimensions
                          const width = 1280;
                          const height = 800;
                          const left = (window.screen.width - width) / 2;
                          const top = (window.screen.height - height) / 2;
                          
                          window.open(
                            guacamoleUrl, 
                            `RemoteDesktop_Host_${host.id}`,
                            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=yes`
                          );
                        } else {
                          throw new Error(`Unbekannter Remote Desktop Typ: ${response.data.type}`);
                        }
                      }
                    } catch (error) {
                      console.error('Error getting remote desktop token:', error);
                      if (window.showNotification) {
                        window.showNotification('Fehler beim Starten der Remote-Desktop-Verbindung', 'error');
                      } else {
                        alert('Fehler beim Starten der Remote-Desktop-Verbindung');
                      }
                    }
                  }
                } else {
                  // Show notification that remote desktop is not enabled
                  if (window.showNotification) {
                    window.showNotification('Remote Desktop ist für diesen Host nicht aktiviert', 'error');
                  } else {
                    alert('Remote Desktop ist für diesen Host nicht aktiviert');
                  }
                }
              }}
              onShowAuditLog={(host) => {
                setShowHostsView(false);
                setShowAuditLog(true);
                // TODO: Set filter for specific host in audit log
              }}
              isAdmin={isAdmin}
              isMobile={isMobile}
              cardSize={cardSize}
            />
          ) : (
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
          )}
        </div>
      </main>

      {/* MobileSwipeableWrapper for panels */}
      <MobileSwipeableWrapper
        isMobile={isMobile}
        onClose={closeAllPanels}
        panels={[
          {
            key: 'settings',
            title: 'Einstellungen',
            isOpen: showSettingsModal,
            component: showSettingsModal && (
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
                loadCurrentBackground={loadCurrentBackground}
                onTerminalOpen={handleTerminalOpen}
                isAdmin={isAdmin}
                onWidthChange={setSettingsPanelWidth}
              />
            )
          },
          {
            key: 'service',
            title: selectedServiceForPanel?.name || 'Service',
            isOpen: showServicePanel && selectedServiceForPanel,
            component: showServicePanel && selectedServiceForPanel && (
              <ServicePanel
                appliance={selectedServiceForPanel}
                initialTab={selectedServiceForPanel.initialTab}
                onClose={() => {
                  setShowServicePanel(false);
                  setSelectedServiceForPanel(null);
                }}
                onSave={async (applianceId, data) => {
                  if (selectedServiceForPanel.isNew) {
                    const newAppliance = await createAppliance(data);
                    if (newAppliance && newAppliance.id) {
                      setSelectedServiceForPanel(newAppliance);
                    }
                  } else {
                    await ApplianceService.patchAppliance(applianceId, data);
                  }
                  await fetchAppliances();
                }}
                onDelete={async appliance => {
                  await deleteAppliance(appliance.id);
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
            )
          },
          {
            key: 'user',
            title: 'Benutzer',
            isOpen: showUserManagement,
            component: showUserManagement && (
              <UserPanel
                onClose={() => setShowUserManagement(false)}
                onWidthChange={setUserPanelWidth}
              />
            )
          },
          {
            key: 'audit',
            title: 'Audit-Log',
            isOpen: showAuditLog,
            component: showAuditLog && (
              <AuditLogPanel
                onClose={() => setShowAuditLog(false)}
                onWidthChange={setAuditLogPanelWidth}
              />
            )
          },
          {
            key: 'host',
            title: selectedHostForPanel?.name || 'Host',
            isOpen: showHostPanel && !!selectedHostForPanel,
            component: showHostPanel && selectedHostForPanel ? (
              <HostPanel
                host={selectedHostForPanel}
                onClose={() => {
                  setShowHostPanel(false);
                  setSelectedHostForPanel(null);
                }}
                onSave={async (hostId, data) => {
                  // Panel bleibt offen nach dem Speichern
                  // Host-Daten werden aktualisiert, aber Panel bleibt sichtbar
                  if (selectedHostForPanel?.isNew) {
                    // Bei neuen Hosts die Daten aktualisieren (ohne isNew Flag)
                    setSelectedHostForPanel(data);
                  }
                }}
                onDelete={async (host) => {
                  setShowHostPanel(false);
                  setSelectedHostForPanel(null);
                }}
                adminMode={isAdmin}
                onWidthChange={setHostPanelWidth}
              />
            ) : null
          }
        ]}
      >
        {/* Desktop Panels - rendered normally on desktop */}

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
                await ApplianceService.updateAppliance(applianceId, data);
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
            loadCurrentBackground={loadCurrentBackground}
            onTerminalOpen={handleTerminalOpen}
            isAdmin={isAdmin}
            onWidthChange={setSettingsPanelWidth}
          />
        </div>
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

      {showHostPanel && selectedHostForPanel && (
        <div className="panel-container host-panel-container">
          <HostPanel
            host={selectedHostForPanel}
            onClose={() => {
              setShowHostPanel(false);
              setSelectedHostForPanel(null);
            }}
            onSave={async (hostId, data) => {
              // Update the selected host with new data
              setSelectedHostForPanel(data);
              // Panel bleibt offen - kein automatisches Schließen
              // Benutzer kann es manuell mit X schließen
            }}
            onDelete={async (host) => {
              setShowHostPanel(false);
              setSelectedHostForPanel(null);
            }}
            adminMode={isAdmin}
            onWidthChange={setHostPanelWidth}
          />
        </div>
      )}
      </MobileSwipeableWrapper>

      {activeTerminals.map(terminal => (
        <TTYDTerminal
          key={terminal.id}
          show={terminal.isOpen}
          onHide={() => handleTerminalClose(terminal.id)}
          hostId={terminal.host?.id || terminal.appliance?.sshHostId}
          host={terminal.host}
          appliance={terminal.appliance}
          title={`Terminal - ${terminal.host?.hostname || terminal.appliance?.name || 'Web Terminal'}`}
        />
      ))}

      {/* SSH File Upload Modal */}
      {showSSHFileUpload && selectedHostForFileUpload && (
        <SSHFileUpload
          sshHost={selectedHostForFileUpload}
          targetPath="~/"
          onClose={() => {
            setShowSSHFileUpload(false);
            setSelectedHostForFileUpload(null);
          }}
        />
      )}

      {/* SSE Debug Panel - nur im Development Mode */}

      {/* Restore Dialog Component */}
      {restoreDialogComponent}
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
// Cache bust: Sat Aug 23 20:52:28 CEST 2025
