// Global UI Configuration System
// This manages all UI customization for the entire app

import React from 'react';

class UIConfigManager {
  constructor() {
    this.config = this.loadConfig();
    this.listeners = new Set();
    // CRITICAL: Initialize styles immediately on construction
    setTimeout(() => {
      this.initializeStyles();
    }, 0);
  }

  // Default configuration
  getDefaultConfig() {
    return {
      // Panel Settings (synchronisiert mit Sidebar)
      panelTransparency: 90,  // gleich wie Sidebar
      panelBlur: 25,          // gleich wie Sidebar
      panelTint: 0,           // gleich wie Sidebar
      panelBorderOpacity: 8,
      
      // Sidebar Settings
      sidebarTransparency: 90,
      sidebarBlur: 25,
      sidebarTint: 0,
      sidebarWidth: 280,
      
      // Header Settings (synchronisiert mit Sidebar)
      headerTransparency: 90,  // gleich wie Sidebar
      headerBlur: 25,          // gleich wie Sidebar
      headerTint: 0,           // gleich wie Sidebar
      
      // Card Settings
      cardTransparency: 85,
      cardBlur: 5,
      cardTint: 0,
      cardBorderOpacity: 10,
      cardBorderRadius: 12,
      
      // Input/Form Settings (for UI elements in panels/dialogs)
      inputTransparency: 95,
      inputBlur: 0,
      inputTint: 0,
      inputBorderOpacity: 20,
      inputBorderRadius: 8,
      
      // Button Settings
      buttonTransparency: 100,
      buttonTint: 0,
      buttonHoverScale: 1.02,
      buttonBorderRadius: 8,
      
      // Modal/Dialog Settings
      modalTransparency: 95,
      modalBlur: 30,
      modalTint: 0,
      
      // Text Settings
      textPrimaryOpacity: 100,
      textSecondaryOpacity: 70,
      textTertiaryOpacity: 50,
      
      // Animation Settings
      animationSpeed: 0.2, // seconds
      animationEnabled: true,
      
      // Shadow Settings
      shadowIntensity: 30,
      shadowSpread: 20,
      
      // Accent Color (can override theme)
      accentColorOverride: null, // null = use theme default
      
      // Background Effects
      backgroundEffectsEnabled: true,
      glassmorphismIntensity: 100,
    };
  }

  // Load config from localStorage
  loadConfig() {
    try {
      const stored = localStorage.getItem('ui_config');
      if (stored) {
        const config = { ...this.getDefaultConfig(), ...JSON.parse(stored) };
        
        // Synchronisiere Header und Panel-Werte mit Sidebar beim Laden
        config.headerTransparency = config.sidebarTransparency;
        config.headerBlur = config.sidebarBlur;
        config.headerTint = config.sidebarTint || 0;
        
        config.panelTransparency = config.sidebarTransparency;
        config.panelBlur = config.sidebarBlur;
        config.panelTint = config.sidebarTint || 0;
        
        return config;
      }
    } catch (e) {
      console.error('Failed to load UI config:', e);
    }
    const defaults = this.getDefaultConfig();
    
    // Auch bei Default-Config synchronisieren
    defaults.headerTransparency = defaults.sidebarTransparency;
    defaults.headerBlur = defaults.sidebarBlur;
    defaults.headerTint = defaults.sidebarTint;
    
    defaults.panelTransparency = defaults.sidebarTransparency;
    defaults.panelBlur = defaults.sidebarBlur;
    defaults.panelTint = defaults.sidebarTint;
    
    return defaults;
  }

  // Save config to localStorage and database
  async saveConfig(updates = {}) {
    this.config = { ...this.config, ...updates };
    
    // Save to localStorage for immediate effect
    localStorage.setItem('ui_config', JSON.stringify(this.config));
    
    // Save to database
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          key: 'ui_config',
          value: JSON.stringify(this.config)
        })
      });
      
      if (!response.ok) {
        console.error('Failed to save UI config to database');
      }
    } catch (e) {
      console.error('Failed to save UI config:', e);
    }
    
    // Apply styles immediately
    this.applyStyles();
    
    // Notify listeners
    this.notifyListeners();
  }

  // Apply styles to document
  applyStyles() {
    const root = document.documentElement;
    const isLight = document.body.classList.contains('theme-light');
    
    // Calculate actual values based on theme
    const calculateColor = (tint, baseLight = 255, baseDark = 0) => {
      const baseValue = isLight ? baseLight : baseDark;
      const adjustment = Math.round((tint / 100) * 50);
      const value = isLight 
        ? Math.max(0, Math.min(255, baseValue - adjustment))
        : Math.max(0, Math.min(255, baseValue + adjustment));
      return value;
    };
    
    // Panel styles - ENHANCED TINT EFFECT
    const panelTint = this.config.panelTint || 0;
    let panelBg;
    if (isLight) {
      const baseValue = 255;
      const adjustment = Math.round((panelTint / 30) * 150);
      const rgbValue = Math.max(100, Math.min(255, baseValue - adjustment));
      panelBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${this.config.panelTransparency / 100})`;
    } else {
      const baseValue = 30;
      const adjustment = Math.round((panelTint / 30) * 80);
      const rgbValue = Math.max(0, Math.min(120, baseValue - adjustment));
      panelBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${this.config.panelTransparency / 100})`;
    }
    
    root.style.setProperty('--panel-bg', panelBg);
    root.style.setProperty('--panel-blur', `${this.config.panelBlur}px`);
    root.style.setProperty('--panel-border', `rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${this.config.panelBorderOpacity / 100})`);
    
    // Sidebar styles - ENHANCED TINT EFFECT
    const sidebarTint = this.config.sidebarTint || 0;
    let sidebarBg;
    if (isLight) {
      const baseValue = 255;
      const adjustment = Math.round((sidebarTint / 30) * 150);
      const rgbValue = Math.max(100, Math.min(255, baseValue - adjustment));
      sidebarBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${this.config.sidebarTransparency / 100})`;
    } else {
      const baseValue = 30;
      const adjustment = Math.round((sidebarTint / 30) * 80);
      const rgbValue = Math.max(0, Math.min(120, baseValue - adjustment));
      sidebarBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${this.config.sidebarTransparency / 100})`;
    }
    
    root.style.setProperty('--sidebar-bg', sidebarBg);
    root.style.setProperty('--sidebar-blur', `${this.config.sidebarBlur}px`);
    root.style.setProperty('--sidebar-width', `${this.config.sidebarWidth}px`);
    root.style.setProperty('--sidebar-tint', sidebarTint);
    
    // Header styles - SYNCHRONIZED WITH SIDEBAR TINT
    // Header nutzt die gleichen Einstellungen wie Sidebar (synchronisiert)
    const headerTint = this.config.sidebarTint ?? 0; // Use sidebar tint for header
    const headerTransparency = this.config.sidebarTransparency ?? 90;
    const headerBlur = this.config.sidebarBlur ?? 25; // Use ?? instead of || to allow 0
    
    // Use same calculation as sidebar for consistent appearance
    let headerBg;
    if (isLight) {
      const baseValue = 255;
      const adjustment = Math.round((headerTint / 30) * 150);
      const rgbValue = Math.max(100, Math.min(255, baseValue - adjustment));
      headerBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${headerTransparency / 100})`;
    } else {
      const baseValue = 30;
      const adjustment = Math.round((headerTint / 30) * 80);
      const rgbValue = Math.max(0, Math.min(120, baseValue - adjustment));
      headerBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${headerTransparency / 100})`;
    }
    
    root.style.setProperty('--header-bg', headerBg);
    root.style.setProperty('--header-blur', `${headerBlur}px`);
    root.style.setProperty('--header-tint', headerTint);
    
    // Card styles - ENHANCED TINT EFFECT
    // Verstärkter Tint-Effekt für Karten
    const cardTint = this.config.cardTint || 0;
    let cardBg;
    if (isLight) {
      // Light Mode: Weißer Hintergrund, Tint macht dunkler
      const baseValue = 255;
      // VERSTÄRKT: Mehr Effekt - bei Tint 30 soll es deutlich dunkler werden
      const adjustment = Math.round((cardTint / 30) * 150); // Stärker: 150 statt 50
      const rgbValue = Math.max(100, Math.min(255, baseValue - adjustment));
      cardBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${this.config.cardTransparency / 100})`;
    } else {
      // Dark Mode: Dunkler Hintergrund
      const baseValue = 45; // Basis-Grau für Karten
      // VERSTÄRKT: Bei negativem Tint heller, bei positivem dunkler
      const adjustment = Math.round((cardTint / 30) * 100); // Stärker: 100 statt 50
      const rgbValue = Math.max(0, Math.min(150, baseValue - adjustment));
      cardBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${this.config.cardTransparency / 100})`;
    }
    
    root.style.setProperty('--card-bg', cardBg);
    root.style.setProperty('--card-blur', `${this.config.cardBlur ?? 5}px`); // Use ?? to allow 0
    root.style.setProperty('--card-border', `rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${this.config.cardBorderOpacity / 100})`);
    root.style.setProperty('--card-radius', `${this.config.cardBorderRadius}px`);
    root.style.setProperty('--card-tint', cardTint);
    
    // Input styles (für UI-Elemente in Panels/Dialogen) - ENHANCED TINT EFFECT
    const inputAlpha = (this.config.inputTransparency || 95) / 100;
    const inputTint = this.config.inputTint || 0;
    
    // VERSTÄRKTER TINT-EFFEKT:
    // Dark Mode: Inputs sollten HELLER sein als der Hintergrund
    // Light Mode: Inputs können weiß mit Transparenz sein
    // Tint: Negativ = heller, Positiv = dunkler
    
    let inputBg;
    if (isLight) {
      // Light Mode: Weißer Hintergrund, Tint macht dunkler
      const baseValue = 255; // Weiß
      const adjustment = Math.round((inputTint / 30) * 200); // VERSTÄRKT: Mehr Effekt pro Tint-Stufe
      const rgbValue = Math.max(0, Math.min(255, baseValue - adjustment));
      inputBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${inputAlpha})`;
    } else {
      // Dark Mode: Dynamischer Basis-Wert für mehr Kontrast
      // Bei Tint -30: fast weiß (220)
      // Bei Tint 0: mittleres Grau (150)
      // Bei Tint +30: dunkelgrau (40)
      const baseValue = 150; // Helleres Grau als Basis für bessere Sichtbarkeit
      const adjustment = Math.round((inputTint / 30) * 180); // VERSTÄRKT: Viel stärkerer Effekt
      const rgbValue = Math.max(10, Math.min(250, baseValue - adjustment)); // Range: 10-250
      inputBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${inputAlpha})`;
    }
    
    root.style.setProperty('--input-bg', inputBg);
    root.style.setProperty('--input-blur', `${this.config.inputBlur ?? 0}px`); // Use ?? to allow 0
    root.style.setProperty('--input-border', `rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${this.config.inputBorderOpacity / 100})`);
    root.style.setProperty('--input-radius', `${this.config.inputBorderRadius}px`);
    root.style.setProperty('--input-tint', inputTint);
    
    // Log zur Überprüfung
    console.log('UI Config Applied:', {
      inputBg,
      inputBlur: `${this.config.inputBlur || 0}px`,
      inputTransparency: this.config.inputTransparency,
      inputTint: inputTint,
      theme: isLight ? 'light' : 'dark'
    });
    
    // Button styles
    const buttonRGB = calculateColor(this.config.buttonTint);
    root.style.setProperty('--button-bg', `rgba(${buttonRGB}, ${buttonRGB}, ${buttonRGB}, ${this.config.buttonTransparency / 100})`);
    root.style.setProperty('--button-hover-scale', this.config.buttonHoverScale);
    root.style.setProperty('--button-radius', `${this.config.buttonBorderRadius}px`);
    
    // Modal styles
    // The slider shows "Dialog-Deckkraft" (opacity)
    // 0% = fully transparent, 100% = fully opaque
    const modalOpacityValue = this.config.modalTransparency || 95;
    const modalAlpha = modalOpacityValue / 100; // Direct conversion without minimum
    const modalTint = this.config.modalTint || 0;
    
    // Modal backgrounds sollten auch sichtbar sein
    let modalBg;
    if (isLight) {
      // Light Mode: Weißer Hintergrund
      const baseValue = 255;
      const adjustment = Math.round((modalTint / 30) * 100);
      const rgbValue = Math.max(200, Math.min(255, baseValue - adjustment));
      modalBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${modalAlpha})`;
    } else {
      // Dark Mode: Dunkler Hintergrund für Modals  
      const baseValue = 60; // Etwas heller für bessere Sichtbarkeit
      const adjustment = Math.round((modalTint / 30) * 40);
      const rgbValue = Math.max(20, Math.min(100, baseValue - adjustment));
      modalBg = `rgba(${rgbValue}, ${rgbValue}, ${rgbValue}, ${modalAlpha})`;
    }
    
    root.style.setProperty('--modal-bg', modalBg);
    root.style.setProperty('--modal-blur', `${this.config.modalBlur ?? 30}px`); // Use ?? to allow 0
    root.style.setProperty('--modal-tint', modalTint);
    
    // DEBUG: Log modal config to see if it's being applied
    console.warn('🔧 Modal Config Applied:', {
      modalBg,
      modalBlur: `${this.config.modalBlur || 30}px`,
      modalTransparency: this.config.modalTransparency,
      modalAlpha: modalAlpha,
      modalTint: modalTint,
      configValues: {
        modalTransparency: this.config.modalTransparency,
        modalBlur: this.config.modalBlur,
        modalTint: this.config.modalTint
      },
      interpretation: `${modalOpacityValue}% opacity = ${modalAlpha} alpha`
    });
    
    // Text opacity
    root.style.setProperty('--text-primary-opacity', this.config.textPrimaryOpacity / 100);
    root.style.setProperty('--text-secondary-opacity', this.config.textSecondaryOpacity / 100);
    root.style.setProperty('--text-tertiary-opacity', this.config.textTertiaryOpacity / 100);
    
    // Animation
    root.style.setProperty('--animation-speed', `${this.config.animationSpeed}s`);
    root.style.setProperty('--animation-enabled', this.config.animationEnabled ? 'running' : 'paused');
    
    // Shadows
    const shadowOpacity = this.config.shadowIntensity / 100;
    const shadowSpread = this.config.shadowSpread;
    root.style.setProperty('--shadow-sm', `0 2px ${shadowSpread * 0.5}px rgba(0, 0, 0, ${shadowOpacity * 0.1})`);
    root.style.setProperty('--shadow-md', `0 4px ${shadowSpread}px rgba(0, 0, 0, ${shadowOpacity * 0.15})`);
    root.style.setProperty('--shadow-lg', `0 8px ${shadowSpread * 1.5}px rgba(0, 0, 0, ${shadowOpacity * 0.2})`);
    root.style.setProperty('--shadow-xl', `0 16px ${shadowSpread * 2}px rgba(0, 0, 0, ${shadowOpacity * 0.25})`);
    
    // Glassmorphism
    const glassIntensity = this.config.glassmorphismIntensity / 100;
    root.style.setProperty('--glass-blur', `${20 * glassIntensity}px`);
    root.style.setProperty('--glass-saturation', `${150 * glassIntensity}%`);
    
    // Accent color override
    if (this.config.accentColorOverride) {
      root.style.setProperty('--accent-color', this.config.accentColorOverride);
      root.style.setProperty('--primary-color', this.config.accentColorOverride);
    }
  }

  // Initialize styles on load
  initializeStyles() {
    console.warn('🚀 Initializing UI Styles with config:', this.config);
    // Apply saved styles immediately
    this.applyStyles();
    
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      this.applyStyles();
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Get specific style objects for components
  getPanelStyles() {
    const isLight = document.body.classList.contains('theme-light');
    const rgb = this.calculateRGB(this.config.panelTint, isLight);
    
    return {
      backgroundColor: `rgba(${rgb}, ${rgb}, ${rgb}, ${this.config.panelTransparency / 100})`,
      backdropFilter: `blur(${this.config.panelBlur}px)`,
      WebkitBackdropFilter: `blur(${this.config.panelBlur}px)`,
      border: `1px solid rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${this.config.panelBorderOpacity / 100})`,
    };
  }

  getCardStyles() {
    const isLight = document.body.classList.contains('theme-light');
    const rgb = this.calculateRGB(this.config.cardTint, isLight);
    
    return {
      backgroundColor: `rgba(${rgb}, ${rgb}, ${rgb}, ${this.config.cardTransparency / 100})`,
      backdropFilter: `blur(${this.config.cardBlur}px)`,
      WebkitBackdropFilter: `blur(${this.config.cardBlur}px)`,
      borderRadius: `${this.config.cardBorderRadius}px`,
      border: `1px solid rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${this.config.cardBorderOpacity / 100})`,
    };
  }

  getInputStyles() {
    const isLight = document.body.classList.contains('theme-light');
    const rgb = this.calculateRGB(this.config.inputTint, isLight);
    
    return {
      backgroundColor: `rgba(${rgb}, ${rgb}, ${rgb}, ${this.config.inputTransparency / 100})`,
      borderRadius: `${this.config.inputBorderRadius}px`,
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: `rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${this.config.inputBorderOpacity / 100})`,
      },
    };
  }

  getButtonStyles() {
    const isLight = document.body.classList.contains('theme-light');
    const rgb = this.calculateRGB(this.config.buttonTint, isLight);
    
    return {
      backgroundColor: `rgba(${rgb}, ${rgb}, ${rgb}, ${this.config.buttonTransparency / 100})`,
      borderRadius: `${this.config.buttonBorderRadius}px`,
      transition: `all ${this.config.animationSpeed}s`,
      '&:hover': {
        transform: `scale(${this.config.buttonHoverScale})`,
      },
    };
  }

  // Helper to calculate RGB
  calculateRGB(tint, isLight) {
    const baseValue = isLight ? 255 : 0;
    const adjustment = Math.round((tint / 100) * 50);
    return isLight 
      ? Math.max(0, Math.min(255, baseValue - adjustment))
      : Math.max(0, Math.min(255, baseValue + adjustment));
  }

  // Subscribe to changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.config));
  }

  // Reset to defaults
  resetToDefaults() {
    const defaults = this.getDefaultConfig();
    
    // Synchronisiere Header und Panel-Werte mit Sidebar
    defaults.headerTransparency = defaults.sidebarTransparency;
    defaults.headerBlur = defaults.sidebarBlur;
    defaults.headerTint = defaults.sidebarTint;
    
    defaults.panelTransparency = defaults.sidebarTransparency;
    defaults.panelBlur = defaults.sidebarBlur;
    defaults.panelTint = defaults.sidebarTint;
    
    this.config = defaults;
    this.saveConfig();
  }

  // Export/Import config
  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      
      // Synchronisiere Header und Panel-Werte mit Sidebar beim Import
      imported.headerTransparency = imported.sidebarTransparency;
      imported.headerBlur = imported.sidebarBlur;
      imported.headerTint = imported.sidebarTint || 0;
      
      imported.panelTransparency = imported.sidebarTransparency;
      imported.panelBlur = imported.sidebarBlur;
      imported.panelTint = imported.sidebarTint || 0;
      
      this.saveConfig(imported);
      return true;
    } catch (e) {
      console.error('Failed to import config:', e);
      return false;
    }
  }
}

// Create singleton instance
const uiConfig = new UIConfigManager();

// Export for use in React components
export default uiConfig;

// Also export hook for React components
export function useUIConfig() {
  const [config, setConfig] = React.useState(uiConfig.config);
  
  React.useEffect(() => {
    const unsubscribe = uiConfig.subscribe(newConfig => {
      setConfig(newConfig);
    });
    
    return unsubscribe;
  }, []);
  
  return {
    config,
    updateConfig: (updates) => uiConfig.saveConfig(updates),
    resetToDefaults: () => uiConfig.resetToDefaults(),
    getPanelStyles: () => uiConfig.getPanelStyles(),
    getCardStyles: () => uiConfig.getCardStyles(),
    getInputStyles: () => uiConfig.getInputStyles(),
    getButtonStyles: () => uiConfig.getButtonStyles(),
  };
}
