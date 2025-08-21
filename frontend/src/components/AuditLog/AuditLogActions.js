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
  'user_deactivated',
  'appliance_deleted',
  'category_deleted',
  'service_deleted',
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
  appliance_deleted: XCircle,
  category_created: CheckCircle,
  category_updated: Settings,
  category_deleted: XCircle,
  user_created: Users,
  user_updated: Users,
  user_deleted: XCircle,
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
    appliance_created: 'Appliance erstellt',
    appliance_updated: 'Appliance aktualisiert',
    appliance_deleted: 'Appliance gelöscht',
    category_created: 'Kategorie erstellt',
    category_updated: 'Kategorie aktualisiert',
    category_deleted: 'Kategorie gelöscht',
    user_created: 'Benutzer erstellt',
    user_updated: 'Benutzer aktualisiert',
    user_deleted: 'Benutzer gelöscht',
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
  };

  return actionMap[action] || action;
};

// Get action color with specific color mapping
export const getActionColor = (action) => {
  // Kritische Aktionen - ROT
  if (criticalActions.includes(action)) return 'error';
  if (action?.includes('failed') || action?.includes('error')) return 'error';
  if (action?.includes('delete') || action?.includes('deleted')) return 'error';
  if (action?.includes('revoked')) return 'error';
  if (action === 'command_execute') return 'error';  // Terminal-Befehle als kritisch
  if (action === 'Befehl ausgeführt') return 'error';  // Deutsch
  
  // Accessed Aktionen (URLs aus Application-Cards) - VIOLETT/SECONDARY
  if (action?.includes('accessed') || action === 'appliance_accessed') return 'secondary';
  if (action === 'remoteDesktopAccess' || action?.includes('remoteDesktop')) return 'secondary';
  
  // Anmeldungen - GELB/WARNING
  if (action === 'login' || action === 'user_login' || action === 'userLogin') return 'warning';
  if (action === 'Anmeldung') return 'warning';  // Deutsch
  
  // Abmeldungen - GRÜN
  if (action === 'logout' || action === 'user_logout' || action === 'userLogout') return 'success';
  if (action === 'Abmeldung') return 'success';  // Deutsch
  
  // Aktualisierungen - BLAU/INFO
  if (action?.includes('update') || action?.includes('updated') || action?.includes('aktualisiert')) return 'info';
  if (action === 'settings_update') return 'info';
  if (action === 'Host aktualisiert') return 'info';  // Deutsch
  
  // Erstellungen - GRÜN
  if (action?.includes('create') || action?.includes('created')) return 'success';
  if (action?.includes('restore') || action?.includes('restored')) return 'success';
  if (action?.includes('granted')) return 'success';
  if (action?.includes('registered')) return 'success';
  
  // Terminal/SSH - INFO/BLAU (außer command_execute, das ist rot)
  if (action === 'terminal_open' || action === 'terminalOpen') return 'info';
  if (action?.includes('terminal') && action !== 'command_execute') return 'info';
  if (action?.includes('ssh')) return 'info';
  
  // Service Aktionen
  if (action?.includes('service_started')) return 'success';
  if (action?.includes('service_stopped')) return 'error';
  if (action?.includes('service_restarted')) return 'info';
  
  // Backup Aktionen
  if (action?.includes('backup_created')) return 'success';
  if (action?.includes('backup_restored')) return 'warning';
  
  return 'default';
};

// Get explicit color styles for action badges
export const getActionColorStyle = (action) => {
  const colorMap = {
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
      backgroundColor: '#ffa726',  // Gelb/Orange (heller)
      color: '#000000',
      border: '1px solid #ffa726',
    },
    success: {
      backgroundColor: '#66bb6a',  // Grün (heller)
      color: '#ffffff',
      border: '1px solid #66bb6a',
    },
    info: {
      backgroundColor: '#42a5f5',  // Blau (heller)
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
