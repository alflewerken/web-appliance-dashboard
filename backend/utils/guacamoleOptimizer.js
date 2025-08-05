const getOptimizedConnectionParams = (connectionType, performanceLevel = 'balanced', useCase = 'admin') => {
  // Erweiterte Basis-Parameter für bessere Performance
  const baseParams = {
    // Visuelle Effekte deaktivieren für bessere Performance
    'enable-wallpaper': 'false',
    'enable-theming': 'false',
    'enable-font-smoothing': 'false',
    'enable-full-window-drag': 'false',
    'enable-desktop-composition': 'false',
    'enable-menu-animations': 'false',
    
    // Neue Optimierungen
    'force-lossless': 'false',
    'enable-webp': 'true',  // WebP für bessere Kompression
    'cursor': 'local',      // Lokaler Cursor für weniger Latenz
  };

  // Use-Case spezifische Profile
  const useCaseProfiles = {
    'admin': {
      // Optimiert für Terminal und Config
      'color-depth': '16',
      'jpeg-quality': '70',
      'enable-audio': 'false',
      'resize-method': 'display-update',
      'clipboard-encoding': 'UTF-8',
      'fps': '15',  // Niedrige FPS für Admin-Tasks
      'video-codec': '', // Kein Video-Codec für Admin
    },
    'desktop': {
      // Normale Desktop-Arbeit
      'color-depth': '24',
      'jpeg-quality': '60',
      'enable-audio': 'true',
      'resize-method': 'display-update',
      'clipboard-encoding': 'UTF-8',
      'fps': '30',
      'video-codec': 'h264', // H.264 wenn verfügbar
    },
    'media': {
      // Media/Gaming
      'color-depth': '32',
      'jpeg-quality': '90',
      'enable-audio': 'true',
      'resize-method': 'display-update',
      'clipboard-encoding': 'UTF-8',
      'fps': '60',
      'video-codec': 'h264',
      'enable-webp': 'false', // H.264 statt WebP für Video
    }
  };

  const performanceProfiles = {
    'high-quality': {
      'jpeg-quality': '90',
      'force-lossless': 'true',
      'enable-webp': 'true',
    },
    'balanced': {
      'jpeg-quality': '60',
      'force-lossless': 'false',
      'enable-webp': 'true',
    },
    'performance': {
      'jpeg-quality': '40',
      'force-lossless': 'false',
      'enable-webp': 'true',
      'dpi': '96', // Standard DPI
    },
    'low-bandwidth': {
      'color-depth': '8',
      'jpeg-quality': '20',
      'enable-audio': 'false',
      'resize-method': 'reconnect',
      'fps': '10',
      'dpi': '72', // Niedrigere DPI
    }
  };

  // Protokoll-spezifische Optimierungen
  if (connectionType === 'rdp') {
    const rdpOptimizations = {
      ...baseParams,
      ...useCaseProfiles[useCase],
      ...performanceProfiles[performanceLevel],
      
      // RDP-spezifische Performance-Flags
      'performance-flags': performanceLevel === 'performance' ? '0x80' : '0x00',
      
      // Cache-Größen erhöhen
      'glyph-cache-size': '65536',
      'bitmap-cache-size': '65536',
      'offscreen-cache-size': '65536',
      'pointer-cache-size': '65536',
      
      // Features basierend auf Use-Case
      'enable-printing': useCase === 'desktop' ? 'true' : 'false',
      'enable-drive': useCase === 'desktop' ? 'true' : 'false',
      'create-drive-path': 'true',
      
      // Neue RDP-Optimierungen
      'enable-touch': 'false',
      'disable-copy': 'false',
      'disable-paste': 'false',
      'gateway-port': '443',
      'security': 'nla',
      'ignore-cert': 'true',
      
      // Audio-Optimierungen
      'audio-servername': '',
      'disable-audio': useCase === 'admin' ? 'true' : 'false',
      'enable-audio-input': 'false',
      
      // Keyboard layout
      'server-layout': 'de-de-qwertz',
    };
    
    return rdpOptimizations;
    
  } else if (connectionType === 'vnc') {
    const vncOptimizations = {
      ...baseParams,
      ...useCaseProfiles[useCase],
      ...performanceProfiles[performanceLevel],
      
      // VNC-spezifische Encodings in optimaler Reihenfolge
      'encodings': 'zrle ultra copyrect hextile zlib corre rre raw',
      
      // VNC-spezifische Optimierungen
      'swap-red-blue': 'false',
      'read-only': 'false',
      'dest-host': '',
      'dest-port': '',
      
      // Clipboard
      'disable-copy': 'false',
      'disable-paste': 'false',
      'clipboard-encoding': 'UTF-8',
      
      // Audio für VNC normalerweise nicht verfügbar
      'enable-audio': 'false',
      
      // Kompression
      'compress-level': performanceLevel === 'low-bandwidth' ? '9' : '1',
    };
    
    return vncOptimizations;
    
  } else if (connectionType === 'ssh') {
    // SSH-spezifische Optimierungen
    return {
      'font-name': 'monospace',
      'font-size': '12',
      'color-scheme': 'green-black',
      'scrollback': '10000',
      'disable-copy': 'false',
      'disable-paste': 'false',
      'terminal-type': 'xterm-256color',
      'locale': 'de_DE.UTF-8',
      'timezone': 'Europe/Berlin',
      'enable-sftp': 'true',
      'sftp-root-directory': '/',
    };
  }

  return baseParams;
};

// Neue Funktion für dynamische Netzwerk-Anpassung
const getNetworkOptimizedParams = (latency, bandwidth) => {
  if (latency < 10) {
    // LAN
    return {
      'jpeg-quality': '90',
      'force-lossless': 'true',
      'fps': '60',
    };
  } else if (latency < 50) {
    // Gutes Internet
    return {
      'jpeg-quality': '70',
      'force-lossless': 'false',
      'fps': '30',
    };
  } else {
    // Schlechte Verbindung
    return {
      'jpeg-quality': '40',
      'force-lossless': 'false',
      'fps': '15',
      'color-depth': '16',
    };
  }
};

module.exports = { 
  getOptimizedConnectionParams,
  getNetworkOptimizedParams
};
