// Database Field Mapping for Services/Appliances Service Status
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Map service data from appliances table to service response format
 */
function mapServiceDbToJs(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.service_status || 'unknown',
    lastChecked: row.last_status_check,
    hasStatusCommand: Boolean(row.status_command),
    hasStartCommand: Boolean(row.start_command),
    hasStopCommand: Boolean(row.stop_command),
    sshConfigured: Boolean(row.ssh_connection),
    // Additional fields from appliances
    statusCommand: row.status_command,
    startCommand: row.start_command,
    stopCommand: row.stop_command,
    sshConnection: row.ssh_connection,
  };
}

/**
 * Get SELECT columns for services query
 */
function getServiceSelectColumns() {
  return `
    id, name, url,
    status_command, start_command, stop_command,
    ssh_connection, service_status, last_status_check
  `.trim();
}

/**
 * Map service status to consistent format
 */
function mapServiceStatus(status) {
  const statusMap = {
    'running': 'running',
    'stopped': 'stopped',
    'error': 'error',
    'unknown': 'unknown',
    'checking': 'checking',
  };
  
  return statusMap[status] || 'unknown';
}

module.exports = {
  mapServiceDbToJs,
  getServiceSelectColumns,
  mapServiceStatus,
};
