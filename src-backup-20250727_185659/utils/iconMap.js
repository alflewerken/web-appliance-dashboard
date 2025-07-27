// Service Icon Mapping - Maps service names to Lucide icons
export const iconMap = {
  // Popular Services
  YouTube: 'Youtube',
  Youtube: 'Youtube',
  Nextcloud: 'Cloud',
  Bitvavo: 'TrendingUp',
  Finanzen: 'DollarSign',
  'Finanzen-zero': 'DollarSign',
  Finanzensero: 'DollarSign',
  Paperless: 'FileText',
  'Paperless-ngx': 'FileText',
  Printer: 'Printer',
  'Printer Admin': 'Printer',
  Videothek: 'Film',
  'Videothek Alf': 'Film',
  Dashboard: 'LayoutDashboard',
  'Proxmox Alf': 'Server',
  'Web-Panel': 'PanelTop',

  // Category Icons - Map category names to Lucide icons
  productivity: 'Briefcase',
  Productivity: 'Briefcase',
  produktivität: 'Briefcase',
  Produktivität: 'Briefcase',
  'mac docker': 'Box',
  'Mac Docker': 'Box',
  monitoring: 'Activity',
  Monitoring: 'Activity',
  media: 'Tv',
  Media: 'Tv',
  medien: 'Tv',
  Medien: 'Tv',
  alf: 'Globe',
  Alf: 'Globe',
  dokumentation: 'FileText',
  Dokumentation: 'FileText',
  ki: 'Brain',
  Ki: 'Brain',
  KI: 'Brain',
  AI: 'Brain',
  ai: 'Brain',

  // Media Services
  Plex: 'Tv',
  Jellyfin: 'Tv',
  Emby: 'Tv',
  Netflix: 'Tv',
  Spotify: 'Music',
  'Apple Music': 'Music',

  // Home Automation
  'Home Assistant': 'Home',
  Homebridge: 'Home',
  OpenHAB: 'Home',

  // Development & Tools
  GitHub: 'Github',
  GitLab: 'GitBranch',
  Jenkins: 'Package',
  Docker: 'Box',
  Portainer: 'Box',
  Kubernetes: 'Box',

  // Communication
  Discord: 'MessageCircle',
  Slack: 'MessageSquare',
  Teams: 'Users',
  Zoom: 'Video',
  Skype: 'Phone',

  // Storage & Backup
  Synology: 'HardDrive',
  QNAP: 'HardDrive',
  TrueNAS: 'HardDrive',
  Unraid: 'HardDrive',
  Backblaze: 'Archive',
  Dropbox: 'Archive',

  // Networking
  pfSense: 'Shield',
  OPNsense: 'Shield',
  'Pi-hole': 'Shield',
  AdGuard: 'Shield',
  UniFi: 'Wifi',
  OpenWRT: 'Router',

  // Monitoring
  Grafana: 'BarChart2',
  Prometheus: 'Activity',
  Zabbix: 'Activity',
  'Uptime Kuma': 'Activity',
  Healthchecks: 'HeartPulse',

  // Productivity
  Notion: 'BookOpen',
  Obsidian: 'BookOpen',
  Joplin: 'BookOpen',
  'Standard Notes': 'FileText',
  Bitwarden: 'Lock',
  Vaultwarden: 'Lock',
  '1Password': 'Key',
  KeePass: 'Key',

  // Gaming
  Steam: 'Gamepad2',
  'Epic Games': 'Gamepad2',
  PlayStation: 'Gamepad2',
  Xbox: 'Gamepad2',

  // Finance
  'Firefly III': 'DollarSign',
  YNAB: 'DollarSign',
  Mint: 'DollarSign',
  Actual: 'DollarSign',

  // Default fallbacks
  default: 'Server',
};

// Get all available icon names
export const getAvailableIcons = () => {
  // Get all unique Lucide icon names from the iconMap values
  const lucideIcons = [...new Set(Object.values(iconMap))];

  // Add all icons from ICON_CATEGORIES that might not be in iconMap
  const additionalIcons = [
    // Basis
    'Home',
    'Server',
    'Cloud',
    'Database',
    'Monitor',
    'Activity',
    'Shield',
    'Zap',
    'Globe',
    'Box',
    'Heart',
    'Star',
    'Settings',
    // Geräte
    'Smartphone',
    'Tv',
    'Camera',
    'Gamepad',
    'Headphones',
    'Printer',
    'Router',
    'Wifi',
    'Cpu',
    'HardDrive',
    // Kommunikation
    'Mail',
    'MessageCircle',
    'MessageSquare',
    'Phone',
    'PhoneCall',
    'Video',
    'Share',
    'Link',
    // Dateien
    'FileText',
    'Archive',
    'Folder',
    'FolderOpen',
    'File',
    'Files',
    'Download',
    'Upload',
    'Save',
    'Copy',
    // Bücher
    'BookOpen',
    'Bookmark',
    // Medien
    'Music',
    'Video',
    'Image',
    'Film',
    'Youtube',
    // Produktivität
    'Calendar',
    'Timer',
    'Bell',
    'Calculator',
    'Search',
    'Filter',
    'Edit',
    // Smart Home
    'Thermometer',
    'Lightbulb',
    'Fan',
    'Plug',
    'Battery',
    'Power',
    // Benutzerverwaltung
    'Users',
    'User',
    'UserPlus',
    'UserCheck',
    'UserX',
    'Crown',
    'Lock',
    'Key',
    // Charts & Trends
    'TrendingUp',
    'TrendingDown',
    'BarChart',
    'PieChart',
    'Target',
    // Navigation
    'MapPin',
    'Map',
    'Compass',
    'Navigation',
    'Car',
    'Plane',
    'Train',
    // Shopping & Finanzen
    'ShoppingCart',
    'CreditCard',
    'Wallet',
    'DollarSign',
    'Euro',
    // Werkzeuge
    'Wrench',
    'Hammer',
    'Paintbrush',
    'Palette',
    // Essen & Trinken
    'Coffee',
    'Pizza',
    'Utensils',
    'Wine',
    // Wetter
    'Sun',
    'Moon',
    'CloudRain',
    'CloudSnow',
    'Wind',
    'Umbrella',
    'Droplets',
    'Snowflake',
    // Natur
    'TreePine',
    'Flower',
    'Leaf',
    'Fish',
    'Bird',
    // Aktionen
    'Plus',
    'Minus',
    'X',
    'Check',
    'CheckCircle',
    'XCircle',
    'Eye',
    'EyeOff',
    // Warnungen
    'AlertTriangle',
    'AlertCircle',
    'Info',
    'HelpCircle',
    // Symbole
    'Hash',
    'AtSign',
    'Percent',
    'Slash',
    'MoreHorizontal',
    'MoreVertical',
    'Menu',
    'Grid',
    // Zusätzliche Icons aus iconMap
    'BarChart2',
    'HeartPulse',
    'Gamepad2',
    'Github',
    'GitBranch',
    'Package',
  ];

  // Combine and remove duplicates
  const allIcons = [...new Set([...lucideIcons, ...additionalIcons])];

  // Sort alphabetically
  return allIcons.sort();
};
