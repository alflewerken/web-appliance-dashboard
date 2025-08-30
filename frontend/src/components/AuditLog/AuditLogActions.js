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
  revert: Shield,
  appliance_created: CheckCircle,
  appliance_updated: Settings,
  appliance_update: Settings,
  appliance_deleted: XCircle,
  appliance_reverted: Shield,
  appliance_restored: Shield,
  category_created: CheckCircle,
  category_updated: Settings,
  category_deleted: XCircle,
  category_restored: Shield,
  category_reverted: Shield,
  user_created: CheckCircle,
  user_updated: Settings,
  user_deleted: XCircle,
  user_restored: Shield,
  user_reverted: Shield,
  user_activated: CheckCircle,
  user_deactivated: XCircle,
  userActivated: CheckCircle,
  userDeactivated: XCircle,
  userCreated: CheckCircle,
  userUpdated: Settings,
  userDeleted: XCircle,
  userRestored: Shield,
  userReverted: Shield,
  service_started: CheckCircle,
  service_stopped: XCircle,
  service_restarted: Shield,
  backup_created: FileText,
  backup_restored: Shield,
  rustdesk_installed: CheckCircle,
  ssh_key_generated: Shield,
  ssh_key_imported: Shield,
  ssh_key_deleted: XCircle,
  ssh_key_registered: Shield,
  ssh_connection: Terminal,
  settings_update: Settings,
  permission_granted: Shield,
  permission_revoked: XCircle,
  audit_logs_delete: Trash2,
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

// Format action name for display with i18n support
export const formatActionName = (action, t) => {
  // If translation function is provided, use it
  if (t) {
    const translationKey = `auditLog.actions.${action}`;
    const translated = t(translationKey, { defaultValue: '' });
    if (translated && translated !== translationKey) {
      return translated;
    }
  }
  
  // Fallback to language detection and manual mapping
  const currentLang = typeof window !== 'undefined' ? 
    (localStorage.getItem('i18nextLng') || 'en') : 'en';
  
  const actionMapDE = {
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
    command_execute: 'Befehl ausgeführt',
    ssh_key_registered: 'SSH-Schlüssel registriert',
    ssh_file_upload: 'Dateiübertragung',
    ssh_file_download: 'Dateiübertragung',
    host_created: 'Host erstellt',
    host_updated: 'Host aktualisiert',
    host_deleted: 'Host gelöscht',
    host_restored: 'Host wiederhergestellt',
    host_reverted: 'Host rückgängig gemacht',
    hostCreated: 'Host erstellt',
    hostUpdated: 'Host aktualisiert',
    hostDeleted: 'Host gelöscht',
    hostRestored: 'Host wiederhergestellt',
    hostReverted: 'Host rückgängig gemacht',
    service_created: 'Service erstellt',
    service_updated: 'Service aktualisiert',
    service_deleted: 'Service gelöscht',
    service_restored: 'Service wiederhergestellt',
    service_accessed: 'Service aufgerufen',
    session_started: 'Sitzung gestartet',
    session_ended: 'Sitzung beendet',
    session_timeout: 'Sitzung abgelaufen',
    password_changed: 'Passwort geändert',
  };
  
  const actionMapEN = {
    login: 'Login',
    user_login: 'User login',
    userLogin: 'User login',
    logout: 'Logout',
    user_logout: 'User logout',
    userLogout: 'User logout',
    login_failed: 'Login failed',
    failed_login: 'Failed login',
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    restore: 'Restored',
    appliance_created: 'Service created',
    appliance_updated: 'Service updated',
    appliance_update: 'Service updated',
    appliance_deleted: 'Service deleted',
    appliance_reverted: 'Service reverted',
    appliance_restored: 'Service restored',
    category_created: 'Category created',
    category_updated: 'Category updated',
    category_deleted: 'Category deleted',
    category_restored: 'Category restored',
    category_reverted: 'Category reverted',
    user_created: 'User created',
    user_updated: 'User updated',
    user_deleted: 'User deleted',
    user_restored: 'User restored',
    user_reverted: 'User reverted',
    user_activated: 'User activated',
    user_deactivated: 'User deactivated',
    userActivated: 'User activated',
    userDeactivated: 'User deactivated',
    service_started: 'Service started',
    service_stopped: 'Service stopped',
    service_restarted: 'Service restarted',
    backup_created: 'Backup created',
    backup_restored: 'Backup restored',
    rustdesk_installed: 'RustDesk installed',
    ssh_key_generated: 'SSH key generated',
    ssh_key_imported: 'SSH key imported',
    ssh_key_deleted: 'SSH key deleted',
    ssh_connection: 'SSH connection',
    settings_update: 'Settings updated',
    permission_granted: 'Permission granted',
    permission_revoked: 'Permission revoked',
    audit_logs_delete: 'Audit logs deleted',
    appliance_accessed: 'Appliance accessed',
    terminal_command: 'Terminal command',
    terminal_open: 'Terminal opened',
    terminalOpen: 'Terminal opened',
    command_execute: 'Command executed',
    ssh_key_registered: 'SSH key registered',
    ssh_file_upload: 'File transfer',
    ssh_file_download: 'File transfer',
    host_created: 'Host created',
    host_updated: 'Host updated',
    host_deleted: 'Host deleted',
    host_restored: 'Host restored',
    host_reverted: 'Host reverted',
    hostCreated: 'Host created',
    hostUpdated: 'Host updated',
    hostDeleted: 'Host deleted',
    hostRestored: 'Host restored',
    hostReverted: 'Host reverted',
    service_created: 'Service created',
    service_updated: 'Service updated',
    service_deleted: 'Service deleted',
    service_restored: 'Service restored',
    service_accessed: 'Service accessed',
    session_started: 'Session started',
    session_ended: 'Session ended',
    session_timeout: 'Session timeout',
    password_changed: 'Password changed',
  };
  
  const actionMap = currentLang === 'de' ? actionMapDE : actionMapEN;
  
  // Return mapped name or formatted original
  if (actionMap[action]) {
    return actionMap[action];
  }
  
  // Fallback: format the action name
  return action
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
};

// Format timestamp for display with i18n support
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Get current language
  const currentLang = typeof window !== 'undefined' ? 
    (localStorage.getItem('i18nextLng') || 'en') : 'en';
  
  // If less than 1 hour, show minutes
  if (diffMins < 60) {
    if (currentLang === 'de') {
      return `vor ${diffMins} ${diffMins === 1 ? 'Minute' : 'Minuten'}`;
    } else {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    }
  }
  
  // If less than 24 hours, show hours
  if (diffHours < 24) {
    if (currentLang === 'de') {
      return `vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`;
    } else {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
  }
  
  // If less than 7 days, show days
  if (diffDays < 7) {
    if (currentLang === 'de') {
      return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`;
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  }
  
  // Otherwise show date
  const locale = currentLang === 'de' ? 'de-DE' : 'en-US';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get action icon component
export const getActionIcon = (action) => {
  const IconComponent = actionIcons[action] || Activity;
  return <IconComponent size={12} />;
};

// Get action color based on type - NEUE FARBLOGIK
export const getActionColor = (action) => {
  // Benutzer-bezogene Actions - BLAU
  if (action.includes('user') || action.includes('login') || action.includes('logout') || 
      action.includes('session') || action.includes('password')) {
    if (action.includes('delete')) {
      return 'user-delete'; // Intensive blaue Tönung
    }
    if (action.includes('update') || action.includes('change') || action.includes('activated') || 
        action.includes('deactivated')) {
      return 'user-update'; // Mittlere blaue Tönung
    }
    if (action.includes('login') || action.includes('logout')) {
      return 'user-login'; // Schwache blaue Tönung
    }
    return 'user-default'; // Standard blau
  }
  
  // Host-bezogene Actions - ORANGE
  if (action.includes('host') || action.includes('ssh') || action.includes('terminal') || 
      action.includes('command') || action.includes('remote')) {
    if (action.includes('delete')) {
      return 'host-delete'; // Intensive orange Tönung
    }
    if (action.includes('update') || action.includes('change')) {
      return 'host-update'; // Mittlere orange Tönung
    }
    if (action.includes('restore') || action.includes('revert')) {
      return 'host-restore'; // Mittlere orange Tönung
    }
    return 'host-default'; // Standard orange
  }
  
  // Service/Appliance-bezogene Actions - GRÜN
  if (action.includes('appliance') || action.includes('service') || action.includes('category')) {
    if (action.includes('delete')) {
      return 'service-delete'; // Intensive grüne Tönung
    }
    if (action.includes('update') || action.includes('change')) {
      return 'service-update'; // Mittlere grüne Tönung
    }
    if (action.includes('accessed')) {
      return 'service-access'; // Schwache grüne Tönung
    }
    if (action.includes('restore') || action.includes('revert')) {
      return 'service-restore'; // Mittlere grüne Tönung
    }
    return 'service-default'; // Standard grün
  }
  
  // Backup-bezogene Actions - eigene Kategorie
  if (action.includes('backup')) {
    if (action.includes('restore')) {
      return 'backup-restore'; // Spezielle Farbe für Backup-Restore
    }
    return 'backup-default';
  }
  
  // Standard fallback
  return 'default';
};

// Get action color style for inline elements - NEUE FARBPALETTE
export const getActionColorStyle = (action) => {
  const colorType = getActionColor(action);
  
  const colorMap = {
    // BENUTZER - BLAU Töne
    'user-delete': {
      backgroundColor: 'rgba(25, 118, 210, 1)', // Intensives Blau
      color: '#fff',
    },
    'user-update': {
      backgroundColor: 'rgba(66, 165, 245, 0.9)', // Mittleres Blau
      color: '#fff',
    },
    'user-login': {
      backgroundColor: 'rgba(144, 202, 249, 0.8)', // Schwaches Blau
      color: '#fff',
    },
    'user-default': {
      backgroundColor: 'rgba(100, 181, 246, 0.9)', // Standard Blau
      color: '#fff',
    },
    
    // HOST - ORANGE Töne
    'host-delete': {
      backgroundColor: 'rgba(255, 87, 34, 1)', // Intensives Orange
      color: '#fff',
    },
    'host-update': {
      backgroundColor: 'rgba(255, 138, 101, 0.9)', // Mittleres Orange
      color: '#fff',
    },
    'host-restore': {
      backgroundColor: 'rgba(255, 138, 101, 0.9)', // Mittleres Orange
      color: '#fff',
    },
    'host-default': {
      backgroundColor: 'rgba(255, 167, 38, 0.9)', // Standard Orange
      color: '#fff',
    },
    
    // SERVICE - GRÜN Töne
    'service-delete': {
      backgroundColor: 'rgba(46, 125, 50, 1)', // Intensives Grün
      color: '#fff',
    },
    'service-update': {
      backgroundColor: 'rgba(76, 175, 80, 0.9)', // Mittleres Grün
      color: '#fff',
    },
    'service-access': {
      backgroundColor: 'rgba(129, 199, 132, 0.8)', // Schwaches Grün
      color: '#fff',
    },
    'service-restore': {
      backgroundColor: 'rgba(76, 175, 80, 0.9)', // Mittleres Grün
      color: '#fff',
    },
    'service-default': {
      backgroundColor: 'rgba(102, 187, 106, 0.9)', // Standard Grün
      color: '#fff',
    },
    
    // BACKUP - SPEZIAL
    'backup-restore': {
      backgroundColor: 'rgba(156, 39, 176, 0.9)', // Lila für Backup-Restore
      color: '#fff',
    },
    'backup-default': {
      backgroundColor: 'rgba(186, 104, 200, 0.9)', // Standard Lila
      color: '#fff',
    },
    
    // DEFAULT
    'default': {
      backgroundColor: 'rgba(158, 158, 158, 0.9)', // Grau
      color: '#fff',
    },
  };
  
  return colorMap[colorType] || colorMap.default;
};