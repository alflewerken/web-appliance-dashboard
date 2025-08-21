// Audit Log Action definitions and formatting utilities

import React from 'react';
import {
  Activity,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Settings,
  Users,
  FileText,
  Clock,
  Terminal,
  Trash2,
} from 'lucide-react';

// Critical actions that should be highlighted
export const criticalActions = [
  'user_deleted',
  'user_delete',
  'user_deactivated',
  'appliance_deleted',
  'appliance_delete',
  'category_deleted',
  'category_delete',
  'service_deleted',
  'service_delete',
  'host_deleted',
  'host_delete',
  'backup_restored',
  'permission_revoked',
  'ssh_key_deleted',
  'failed_login',
  'audit_logs_delete',
  'command_execute',  // Terminal-Befehle als kritisch markieren
];

// Action icons mapping
export const actionIcons = {
  login: LogIn,
  user_login: LogIn,
  logout: LogOut,
  user_logout: LogOut,
  login_failed: AlertTriangle,
  failed_login: AlertTriangle,
  create: CheckCircle,
  update: Settings,
  delete: XCircle,
  restore: Shield,
  appliance_created: CheckCircle,
  appliance_updated: Settings,
  appliance_update: Settings,
  appliance_deleted: XCircle,
  appliance_delete: XCircle,
  appliance_reverted: Shield,
  appliance_restored: Shield,
  category_created: CheckCircle,
  category_updated: Settings,
  category_deleted: XCircle,
  category_restored: Shield,
  category_reverted: Shield,
  user_created: Users,
  user_updated: Users,
  user_deleted: XCircle,
  user_restored: Shield,
  user_reverted: Shield,
  user_activated: CheckCircle,
  user_deactivated: XCircle,
  userActivated: CheckCircle,
  userDeactivated: XCircle,
  service_started: CheckCircle,
  service_stopped: XCircle,
  service_restarted: Settings,
  backup_created: FileText,
  backup_restored: Shield,
  rustdesk_installed: CheckCircle,
  ssh_key_generated: Shield,
  ssh_key_imported: Shield,
  ssh_key_deleted: XCircle,
  ssh_connection: Terminal,
  settings_update: Settings,
  permission_granted: CheckCircle,
  permission_revoked: XCircle,
  audit_logs_delete: Trash2,
  ssh_key_registered: Shield,
  remote_desktop_access: Terminal,
  host_created: CheckCircle,
  host_updated: Settings,
  host_deleted: XCircle,
  host_restored: Shield,
  host_reverted: Shield,
  host_revert: Shield,
  hostReverted: Shield,
  hostCreated: CheckCircle,
  hostUpdated: Settings,
  hostDeleted: XCircle,
  hostRestored: Shield,
  host_create: CheckCircle,
  host_update: Settings,
  host_delete: XCircle,
  host_restore: Shield,
  hostCreate: CheckCircle,
  hostUpdate: Settings,
  hostDelete: XCircle,
  hostRestore: Shield,
  appliance_accessed: Activity,
  terminal_command: Terminal,
  command_execute: Terminal,  // Hinzugefügt
};

// Format action name for display
export const formatActionName = (action) => {
  const actionMap = {
    login: 'Anmeldung',
    user_login: 'Anmeldung',
    userLogin: 'Anmeldung',
    logout: 'Abmeldung',
    user_logout: 'Abmeldung',
    userLogout: 'Abmeldung',
    login_failed: 'Anmeldung fehlgeschlagen',
    failed_login: 'Anmeldung fehlgeschlagen',
    create: 'Erstellt',
    update: 'Aktualisiert',
    delete: 'Gelöscht',
    restore: 'Wiederhergestellt',
    appliance_created: 'Service erstellt',
    appliance_updated: 'Service geändert',
    appliance_update: 'Service geändert',
    appliance_deleted: 'Service gelöscht',
    appliance_reverted: 'Service wiederhergestellt',
    appliance_restored: 'Service wiederhergestellt',
    category_created: 'Kategorie erstellt',
    category_updated: 'Kategorie aktualisiert',
    category_deleted: 'Kategorie gelöscht',
    category_restored: 'Kategorie wiederhergestellt',
    category_reverted: 'Kategorie rückgängig gemacht',
    user_created: 'Benutzer erstellt',
    user_updated: 'Benutzer aktualisiert',
    user_deleted: 'Benutzer gelöscht',
    user_restored: 'Benutzer wiederhergestellt',
    user_reverted: 'Benutzer rückgängig gemacht',
    user_activated: 'Benutzer aktiviert',
    user_deactivated: 'Benutzer deaktiviert',
    userActivated: 'Benutzer aktiviert',
    userDeactivated: 'Benutzer deaktiviert',
    service_started: 'Service gestartet',
    service_stopped: 'Service gestoppt',
    service_restarted: 'Service neugestartet',
    backup_created: 'Backup erstellt',
    backup_restored: 'Backup wiederhergestellt',
    rustdesk_installed: 'RustDesk installiert',
    ssh_key_generated: 'SSH-Schlüssel generiert',
    ssh_key_imported: 'SSH-Schlüssel importiert',
    ssh_key_deleted: 'SSH-Schlüssel gelöscht',
    ssh_connection: 'SSH-Verbindung',
    settings_update: 'Einstellungen aktualisiert',
    permission_granted: 'Berechtigung erteilt',
    permission_revoked: 'Berechtigung entzogen',
    audit_logs_delete: 'Audit-Logs gelöscht',
    appliance_accessed: 'Appliance aufgerufen',
    terminal_command: 'Terminal-Befehl',
    terminal_open: 'Terminal geöffnet',
    terminalOpen: 'Terminal geöffnet',
    command_execute: 'Befehl ausgeführt',  // Hinzugefügt
    ssh_key_registered: 'SSH-Schlüssel registriert',
    remote_desktop_access: 'Remote Desktop Zugriff',
    remoteDesktopAccess: 'Remote Desktop Zugriff',
    host_created: 'Host erstellt',
    host_updated: 'Host aktualisiert',
    host_deleted: 'Host gelöscht',
    host_restored: 'Host wiederhergestellt',
    host_reverted: 'Host wiederhergestellt',
    host_revert: 'Host wiederhergestellt',
    hostReverted: 'Host wiederhergestellt',
    hostCreated: 'Host erstellt',
    hostUpdated: 'Host aktualisiert',
    hostDeleted: 'Host gelöscht',
    hostRestored: 'Host wiederhergestellt',
    host_create: 'Host erstellt',
    host_update: 'Host aktualisiert',
    host_delete: 'Host gelöscht',
    host_restore: 'Host wiederhergestellt',
    hostCreate: 'Host erstellt',
    hostUpdate: 'Host aktualisiert',
    hostDelete: 'Host gelöscht',
    hostRestore: 'Host wiederhergestellt',
    file_transfer: 'Datei übertragen',
    fileTransfer: 'Datei übertragen',
    file_upload: 'Datei hochgeladen',
    fileUpload: 'Datei hochgeladen',
    file_download: 'Datei heruntergeladen',
    fileDownload: 'Datei heruntergeladen',
  };

  return actionMap[action] || action;
};

// Get action color with specific color mapping
export const getActionColor = (action) => {
  // USER AKTIONEN - BLAU (user)
  if (action === 'user_created' || action === 'user_create' || action === 'Benutzer erstellt') return 'user';
  if (action === 'user_updated' || action === 'user_update' || action === 'Benutzer aktualisiert') return 'user';
  if (action === 'user_deleted' || action === 'user_delete' || action === 'Benutzer gelöscht') return 'user';
  if (action === 'user_restored' || action === 'Benutzer wiederhergestellt') return 'user';
  if (action === 'user_reverted' || action === 'Benutzer rückgängig gemacht') return 'user';
  if (action === 'user_activated' || action === 'userActivated' || action === 'Benutzer aktiviert') return 'user';
  if (action === 'user_deactivated' || action === 'userDeactivated' || action === 'Benutzer deaktiviert') return 'user';
  if (action === 'login' || action === 'user_login' || action === 'userLogin' || action === 'Anmeldung') return 'user';
  if (action === 'logout' || action === 'user_logout' || action === 'userLogout' || action === 'Abmeldung') return 'user';
  if (action === 'login_failed' || action === 'failed_login' || action === 'Anmeldung fehlgeschlagen') return 'user';
  
  // SERVICE/APPLIANCE AKTIONEN - TÜRKIS (service)
  if (action === 'appliance_created' || action === 'appliance_create' || action === 'Service erstellt') return 'service';
  if (action === 'appliance_updated' || action === 'appliance_update' || action === 'Service geändert') return 'service';
  if (action === 'appliance_deleted' || action === 'appliance_delete' || action === 'Service gelöscht') return 'service';
  if (action === 'appliance_restored' || action === 'appliance_reverted' || action === 'Service wiederhergestellt') return 'service';
  if (action === 'appliance_accessed' || action === 'Appliance aufgerufen') return 'service';
  
  // HOST AKTIONEN - HELLBLAU (host)
  if (action?.includes('host_create') || action?.includes('hostCreate') || action === 'Host erstellt') return 'host';
  if (action?.includes('host_update') || action?.includes('hostUpdate') || action === 'Host aktualisiert') return 'host';
  if (action?.includes('host_delete') || action?.includes('hostDelete') || action === 'Host gelöscht') return 'host';
  if (action?.includes('host_restore') || action?.includes('hostRestore') || action?.includes('host_revert') || action?.includes('hostRevert') || action === 'Host wiederhergestellt') return 'host';
  
  // SETTINGS - GELB (settings)
  if (action === 'settings_update' || action === 'Einstellungen aktualisiert') return 'settings';
  if (action?.includes('permission_granted') || action === 'Berechtigung erteilt') return 'settings';
  if (action?.includes('permission_revoked') || action === 'Berechtigung entzogen') return 'settings';
  if (action?.includes('category_created') || action === 'Kategorie erstellt') return 'settings';
  if (action?.includes('category_updated') || action === 'Kategorie aktualisiert') return 'settings';
  if (action?.includes('category_deleted') || action === 'Kategorie gelöscht') return 'settings';
  if (action?.includes('category_restored') || action === 'Kategorie wiederhergestellt') return 'settings';
  if (action?.includes('category_reverted') || action === 'Kategorie rückgängig gemacht') return 'settings';
  if (action?.includes('backup_created') || action === 'Backup erstellt') return 'settings';
  if (action?.includes('backup_restored') || action === 'Backup wiederhergestellt') return 'settings';
  if (action?.includes('audit_logs_delete') || action === 'Audit-Logs gelöscht') return 'settings';
  
  // BEFEHLE AUS SERVICES - ROT (command)
  if (action === 'command_execute' || action === 'Befehl ausgeführt') return 'command';
  if (action === 'terminal_command' || action === 'Terminal-Befehl') return 'command';
  
  // SERVICE START/STOP - ORANGE (serviceControl)
  if (action?.includes('service_started') || action === 'Service gestartet') return 'serviceControl';
  if (action?.includes('service_stopped') || action === 'Service gestoppt') return 'serviceControl';
  if (action?.includes('service_restarted') || action === 'Service neugestartet') return 'serviceControl';
  
  // TERMINAL AUFGERUFEN - ORANGE (terminal)
  if (action === 'terminal_open' || action === 'terminalOpen' || action === 'Terminal geöffnet') return 'terminal';
  if (action?.includes('ssh_connection') || action === 'SSH-Verbindung') return 'terminal';
  if (action?.includes('ssh_key')) return 'terminal';
  
  // REMOTE DESKTOP - HELLROT (remoteDesktop)
  if (action === 'remote_desktop_access' || action === 'remoteDesktopAccess' || action === 'Remote Desktop Zugriff') return 'remoteDesktop';
  if (action?.includes('rustdesk') || action === 'RustDesk installiert') return 'remoteDesktop';
  
  // DATEI ÜBERTRAGEN - VIOLETT (fileTransfer)
  if (action?.includes('file_transfer') || action?.includes('fileTransfer')) return 'fileTransfer';
  if (action?.includes('file_upload') || action?.includes('fileUpload')) return 'fileTransfer';
  if (action?.includes('file_download') || action?.includes('fileDownload')) return 'fileTransfer';
  
  return 'default';
};

// Get explicit color styles for action badges
export const getActionColorStyle = (action) => {
  const colorMap = {
    user: {
      backgroundColor: '#2196f3',  // Blau
      color: '#ffffff',
      border: '1px solid #2196f3',
    },
    service: {
      backgroundColor: '#00bcd4',  // Türkis/Cyan
      color: '#ffffff',
      border: '1px solid #00bcd4',
    },
    host: {
      backgroundColor: '#81d4fa',  // Hellblau
      color: '#000000',
      border: '1px solid #81d4fa',
    },
    settings: {
      backgroundColor: '#ffeb3b',  // Gelb
      color: '#000000',
      border: '1px solid #ffeb3b',
    },
    command: {
      backgroundColor: '#f44336',  // Rot
      color: '#ffffff',
      border: '1px solid #f44336',
    },
    serviceControl: {
      backgroundColor: '#ff9800',  // Orange
      color: '#000000',
      border: '1px solid #ff9800',
    },
    terminal: {
      backgroundColor: '#ff9800',  // Orange
      color: '#000000',
      border: '1px solid #ff9800',
    },
    remoteDesktop: {
      backgroundColor: '#ef5350',  // Hellrot
      color: '#ffffff',
      border: '1px solid #ef5350',
    },
    fileTransfer: {
      backgroundColor: '#9c27b0',  // Violett
      color: '#ffffff',
      border: '1px solid #9c27b0',
    },
    // Legacy mappings für Kompatibilität
    error: {
      backgroundColor: '#f44336',  // Rot
      color: '#ffffff',
      border: '1px solid #f44336',
    },
    secondary: {
      backgroundColor: '#9c27b0',  // Violett
      color: '#ffffff',
      border: '1px solid #9c27b0',
    },
    warning: {
      backgroundColor: '#ffa726',  // Gelb/Orange
      color: '#000000',
      border: '1px solid #ffa726',
    },
    success: {
      backgroundColor: '#66bb6a',  // Grün
      color: '#ffffff',
      border: '1px solid #66bb6a',
    },
    info: {
      backgroundColor: '#42a5f5',  // Blau
      color: '#ffffff',
      border: '1px solid #42a5f5',
    },
    default: {
      backgroundColor: 'rgba(158, 158, 158, 0.4)',
      color: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid rgba(158, 158, 158, 0.6)',
    },
  };

  const color = getActionColor(action);
  return colorMap[color] || colorMap.default;
};

// Get action icon component with optional size
export const getActionIcon = (action, size = 16) => {
  const IconComponent = actionIcons[action] || Activity;
  return <IconComponent size={size} />;
};

// Format timestamp
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Gerade eben';
  if (diffMinutes < 60) return `vor ${diffMinutes} Minute${diffMinutes > 1 ? 'n' : ''}`;
  if (diffHours < 24) return `vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;

  return date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
