/**
 * Guacamole Performance Optimizer
 * Dynamische Anpassung der Verbindungsparameter basierend auf Use-Case
 */

class GuacamoleOptimizer {
  constructor() {
    // Performance-Profile für verschiedene Szenarien
    this.profiles = {
      admin: {
        // Optimiert für Terminal und Konfiguration
        protocol: 'vnc',
        width: 1280,
        height: 720,
        dpi: 96,
        'color-depth': 16,
        'cursor': 'local',
        'clipboard-encoding': 'UTF-8',
        'disable-audio': true,
        'enable-wallpaper': false,
        'enable-theming': false,
        'enable-font-smoothing': false,
        'enable-full-window-drag': false,
        'enable-desktop-composition': false,
        'enable-menu-animations': false,
        // Kompression für statische Inhalte
        'enable-webp': true,
        'jpeg-quality': 8,  // 0-9, höher = besser
        // Niedrige FPS für Admin-Tasks
        'force-lossless': false,
        'fps': 15
      },
      desktop: {
        // Optimiert für normale Desktop-Arbeit
        protocol: 'rdp',
        width: 1920,
        height: 1080,
        dpi: 96,
        'color-depth': 24,
        'cursor': 'local',
        'clipboard-encoding': 'UTF-8',
        'disable-audio': false,
        'enable-wallpaper': true,
        'enable-theming': true,
        'enable-font-smoothing': true,
        'enable-full-window-drag': true,
        'enable-desktop-composition': true,
        'enable-menu-animations': false,
        // Balancierte Einstellungen
        'enable-webp': true,
        'jpeg-quality': 6,
        'force-lossless': false,
        'fps': 30,
        // RDP-spezifisch
        'enable-drive': true,
        'create-drive-path': true,
        'resize-method': 'display-update',
        'enable-touch': true
      },
      performance: {
        // Maximale Performance für flüssige Nutzung
        protocol: 'vnc',
        width: 1920,
        height: 1080,
        dpi: 96,
        'color-depth': 24,
        'cursor': 'local',
        'clipboard-encoding': 'UTF-8',
        'disable-audio': false,
        'enable-wallpaper': false,
        'enable-theming': false,
        'enable-font-smoothing': false,
        'enable-full-window-drag': false,
        'enable-desktop-composition': false,
        'enable-menu-animations': false,
        // H.264 encoding wenn verfügbar
        'video-codec': 'h264',
        'enable-webp': false,  // H.264 statt WebP
        'force-lossless': false,
        'fps': 60
      }
    };

    // Netzwerk-basierte Anpassungen
    this.networkProfiles = {
      lan: {
        'jpeg-quality': 9,
        'enable-webp': true,
        'force-lossless': true
      },
      wan: {
        'jpeg-quality': 6,
        'enable-webp': true,
        'force-lossless': false
      },
      mobile: {
        'jpeg-quality': 4,
        'enable-webp': true,
        'force-lossless': false,
        'fps': 15
      }
    };
  }

  /**
   * Optimiert Verbindungsparameter basierend auf Szenario und Netzwerk
   */
  optimizeConnection(baseConfig, scenario = 'admin', networkType = 'lan') {
    const profile = this.profiles[scenario] || this.profiles.admin;
    const networkOptimizations = this.networkProfiles[networkType] || this.networkProfiles.lan;

    // Basis-Konfiguration mit Profil zusammenführen
    const optimizedConfig = {
      ...baseConfig,
      ...profile,
      ...networkOptimizations
    };

    // Dynamische Anpassungen basierend auf Host-OS
    if (baseConfig.hostname && baseConfig.hostname.includes('win')) {
      optimizedConfig.protocol = 'rdp';
      optimizedConfig['security'] = 'nla';
      optimizedConfig['ignore-cert'] = true;
      optimizedConfig['gateway-port'] = 443;
    }

    // Spezielle Optimierungen für SSH/Terminal
    if (scenario === 'admin' && baseConfig.protocol === 'ssh') {
      optimizedConfig['font-size'] = 12;
      optimizedConfig['scrollback'] = 10000;
      optimizedConfig['terminal-type'] = 'xterm-256color';
      optimizedConfig['locale'] = 'en_US.UTF-8';
    }

    return optimizedConfig;
  }

  /**
   * Testet Netzwerklatenz und passt Einstellungen an
   */
  async detectNetworkQuality(targetHost) {
    try {
      const start = Date.now();
      await fetch(`http://${targetHost}:8080/guacamole/`, { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      const latency = Date.now() - start;

      if (latency < 10) return 'lan';
      if (latency < 100) return 'wan';
      return 'mobile';
    } catch (error) {
      return 'wan'; // Fallback
    }
  }

  /**
   * Generiert optimale Einstellungen für eine Verbindung
   */
  async generateOptimalConfig(appliance, purpose = 'admin') {
    const networkType = await this.detectNetworkQuality(appliance.ip);
    
    const baseConfig = {
      hostname: appliance.ip,
      port: appliance.remoteDesktopPort || 5900,
      password: appliance.vncPassword || '',
      'recording-path': '/record',
      'recording-name': `${appliance.name}-${Date.now()}`
    };

    return this.optimizeConnection(baseConfig, purpose, networkType);
  }
}

module.exports = GuacamoleOptimizer;
