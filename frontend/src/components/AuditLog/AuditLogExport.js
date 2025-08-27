// Audit Log Export utilities
import axios from '../../utils/axiosConfig';
import { formatActionName, getActionColor } from './AuditLogActions';

// Helper function to translate action names to German
const translateAction = (action) => {
  const translations = {
    'ssh_file_upload': 'Dateiübertragung',
    'ssh_file_download': 'Dateiübertragung',
    'backup_create': 'Backup erstellt',
    'backup_restore': 'Backup wiederhergestellt',
    'backupRestore': 'Backup wiederhergestellt',
    'login': 'Anmeldung',
    'logout': 'Abmeldung',
    'create': 'Erstellt',
    'update': 'Aktualisiert',
    'delete': 'Gelöscht',
    'terminal_open': 'Terminal geöffnet',
    'remote_desktop_access': 'Remote Desktop Zugriff',
    'service_start': 'Service gestartet',
    'service_stop': 'Service gestoppt',
    'service_restart': 'Service neugestartet',
  };
  return translations[action] || formatActionName(action);
};

// Helper function to format file sizes
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
// Export filtered logs as CSV
export const exportAuditLogs = async (filters) => {
  const {
    selectedAction,
    selectedUser,
    selectedResourceType,
    dateRange,
    customStartDate,
    customEndDate,
  } = filters;

  const params = new URLSearchParams();
  
  if (selectedAction !== 'all') {
    params.append('action', selectedAction);
  }
  
  if (selectedUser !== 'all') {
    params.append('user_id', selectedUser);
  }
  
  if (selectedResourceType !== 'all') {
    params.append('resource_type', selectedResourceType);
  }
  
  if (dateRange === 'custom' && customStartDate && customEndDate) {
    params.append('start_date', customStartDate);
    params.append('end_date', customEndDate);
  } else if (dateRange !== 'all') {    const now = new Date();
    let startDate;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'yesterday':
        startDate = new Date(now.setDate(now.getDate() - 1));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        break;
    }
    
    if (startDate) {
      params.append('start_date', startDate.toISOString());
    }
  }

  const response = await axios.get(`/api/audit-logs/export?${params}`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Helper function to parse and format details into pills
const formatDetailsAsPills = (details) => {
  let detailsObj = {};
  
  // Parse details if it's a string
  try {
    if (typeof details === 'string') {
      // Try to parse as JSON
      detailsObj = JSON.parse(details);
    } else if (typeof details === 'object' && details !== null) {
      detailsObj = details;
    }
  } catch (e) {
    // If parsing fails, treat as plain string
    if (details) {
      detailsObj = { details: details };
    }
  }
  
  return detailsObj;
};
// Helper function to render a detail object as pills
const renderDetailPills = (key, value, indent = false) => {
  const pillStyles = `
    display: inline-block;
    padding: 4px 12px;
    margin: 2px 4px 2px 0;
    border-radius: 16px;
    font-size: 0.85em;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    color: #1565c0;
  `;
  
  const labelStyles = `
    display: inline-block;
    padding: 4px 10px;
    margin: 2px 4px 2px 0;
    border-radius: 16px;
    font-size: 0.85em;
    background-color: #f5f5f5;
    border: 1px solid #bdbdbd;
    color: #424242;
    font-weight: 600;
  `;
  
  // Format the key name
  const formattedKey = key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();  
  // Handle different value types
  if (value === null || value === undefined) {
    return `<span style="${labelStyles}">${formattedKey}</span><span style="${pillStyles}">-</span>`;
  }
  
  if (typeof value === 'boolean') {
    const boolStyles = value ? 
      pillStyles.replace('#e3f2fd', '#e8f5e9').replace('#90caf9', '#81c784').replace('#1565c0', '#2e7d32') :
      pillStyles.replace('#e3f2fd', '#ffebee').replace('#90caf9', '#ef9a9a').replace('#1565c0', '#c62828');
    return `<span style="${labelStyles}">${formattedKey}</span><span style="${boolStyles}">${value ? '✓ Ja' : '✗ Nein'}</span>`;
  }
  
  if (typeof value === 'object' && !Array.isArray(value)) {
    // For nested objects, render each property as a pill
    let html = `<div style="margin: 4px 0;"><span style="${labelStyles}">${formattedKey}:</span>`;
    html += '<div style="margin-left: 20px; margin-top: 4px;">';
    Object.entries(value).forEach(([subKey, subValue]) => {
      html += renderDetailPills(subKey, subValue, true) + '<br>';
    });
    html += '</div></div>';
    return html;
  }
  
  if (Array.isArray(value)) {
    let html = `<span style="${labelStyles}">${formattedKey}:</span>`;
    value.forEach((item, index) => {
      if (typeof item === 'object') {
        // For complex array items
        html += '<div style="margin-left: 20px; margin-top: 4px;">';
        Object.entries(item).forEach(([subKey, subValue]) => {
          html += renderDetailPills(subKey, subValue, true) + '<br>';
        });
        html += '</div>';
      } else {
        html += `<span style="${pillStyles}">${item}</span>`;
      }
    });
    return html;
  }
  
  // Special formatting for certain keys
  if (key.includes('date') || key.includes('created') || key.includes('updated') || key.includes('time')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        value = date.toLocaleString('de-DE');
      }
    } catch (e) {
      // Keep original value if not a valid date
    }
  }
  
  if (key.includes('size') || key === 'bytes') {
    const size = parseInt(value);
    if (!isNaN(size)) {
      value = formatFileSize(size);
    }
  }
  
  // Color pills for color values
  if (key === 'color' || key.includes('color')) {
    const colorStyles = pillStyles + `background-color: ${value}; color: #fff; border-color: ${value};`;
    return `<span style="${labelStyles}">${formattedKey}</span><span style="${colorStyles}">${value}</span>`;
  }
  
  return `<span style="${labelStyles}">${formattedKey}</span><span style="${pillStyles}">${value}</span>`;
};
// Export logs for printing/PDF with pill-based formatting
export const exportForPrint = (logs) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Generate filename with current date
  const today = new Date().toISOString().split('T')[0];
  const filename = `Audit-Log-Report-${today}`;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 20px;
          line-height: 1.6;
          color: #333;
        }        h1 {
          color: #333;
          border-bottom: 3px solid #4caf50;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .info-header {
          background-color: #f0f0f0;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .info-header p {
          margin: 5px 0;
        }
        .log-entry {
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          page-break-inside: avoid;
          background-color: #fff;
        }
        .log-header {
          background: linear-gradient(to right, #f5f5f5, #fafafa);
          padding: 12px 15px;
          border-bottom: 2px solid #e0e0e0;
        }
        .log-header-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }        .header-pill {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.9em;
          font-weight: 500;
          white-space: nowrap;
        }
        .pill-date {
          background-color: #fff3e0;
          border: 1px solid #ffb74d;
          color: #e65100;
        }
        .pill-user {
          background-color: #e8eaf6;
          border: 1px solid #7986cb;
          color: #283593;
        }
        .pill-action-success {
          background-color: #e8f5e9;
          border: 1px solid #81c784;
          color: #1b5e20;
        }
        .pill-action-error {
          background-color: #ffebee;
          border: 1px solid #e57373;
          color: #b71c1c;
        }
        .pill-action-warning {
          background-color: #fff8e1;
          border: 1px solid #ffd54f;
          color: #f57c00;
        }        .pill-action-info {
          background-color: #e3f2fd;
          border: 1px solid #64b5f6;
          color: #0d47a1;
        }
        .pill-resource {
          background-color: #f3e5f5;
          border: 1px solid #ba68c8;
          color: #4a148c;
        }
        .pill-ip {
          background-color: #f1f8e9;
          border: 1px solid #aed581;
          color: #33691e;
          font-family: monospace;
          font-size: 0.85em;
        }
        .log-details {
          padding: 15px;
          background-color: #fafafa;
        }
        .detail-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          line-height: 2;
        }
        .detail-section {
          margin-bottom: 12px;
          padding: 10px;
          background-color: #fff;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }        .section-title {
          font-weight: 600;
          color: #424242;
          margin-bottom: 8px;
          font-size: 0.95em;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        @media print {
          .no-print { 
            display: none !important; 
          }
          body { 
            padding: 10px; 
          }
          .log-entry { 
            page-break-inside: avoid; 
          }
          h1 {
            font-size: 20pt;
          }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
        .print-instructions {
          background-color: #e3f2fd;
          border: 2px solid #2196f3;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          font-size: 14px;
        }        .print-instructions h3 {
          color: #1976d2;
          margin-bottom: 10px;
        }
        .print-instructions ul {
          margin-left: 20px;
        }
        .print-instructions li {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <h1>📋 Audit Log Report</h1>
      
      <div class="info-header">
        <p><strong>Erstellt am:</strong> ${new Date().toLocaleString('de-DE')}</p>
        <p><strong>Anzahl Einträge:</strong> ${logs.length}</p>
        <p><strong>Zeitraum:</strong> ${logs.length > 0 ? 
          `${new Date(logs[logs.length - 1].createdAt).toLocaleDateString('de-DE')} - ${new Date(logs[0].createdAt).toLocaleDateString('de-DE')}` : 
          '-'}</p>
      </div>
      
      <div class="print-instructions no-print">
        <h3>💡 PDF-Export Anleitung:</h3>
        <ul>
          <li>1. Klicken Sie auf <strong>"Als PDF drucken"</strong> oder drücken Sie <kbd>Strg+P</kbd> (Windows) bzw. <kbd>Cmd+P</kbd> (Mac)</li>
          <li>2. Wählen Sie als Ziel: <strong>"Als PDF speichern"</strong> oder <strong>"Microsoft Print to PDF"</strong></li>
          <li>3. Empfohlene Einstellungen:            <ul>
              <li>• Layout: Hochformat</li>
              <li>• Papierformat: A4</li>
              <li>• Ränder: Standard</li>
              <li>• Hintergrundgrafiken: Aktiviert (für farbige Elemente)</li>
            </ul>
          </li>
          <li>4. Klicken Sie auf <strong>"Speichern"</strong> und wählen Sie den Speicherort</li>
        </ul>
      </div>
      
      <hr style="margin: 20px 0;" class="no-print">
  `);

  // Process each log entry
  logs.forEach((log, index) => {
    // Determine resource display
    let resourceDisplay = log.resourceName;
    if (!resourceDisplay) {
      if (log.resourceType && log.resourceId) {
        resourceDisplay = `${log.resourceType} #${log.resourceId}`;
      } else if (log.resourceType) {
        resourceDisplay = log.resourceType;
      } else {
        resourceDisplay = '-';
      }
    }
    
    // Determine action color class
    const actionColorClass = getActionColor(log.action);
    let pillActionClass = 'pill-action-info';
    if (actionColorClass.includes('error')) pillActionClass = 'pill-action-error';
    else if (actionColorClass.includes('success')) pillActionClass = 'pill-action-success';
    else if (actionColorClass.includes('warning')) pillActionClass = 'pill-action-warning';    
    printWindow.document.write(`
      <div class="log-entry">
        <div class="log-header">
          <div class="log-header-pills">
            <span class="header-pill pill-date">📅 ${new Date(log.createdAt).toLocaleString('de-DE')}</span>
            <span class="header-pill pill-user">👤 ${log.username || 'System'}</span>
            <span class="header-pill ${pillActionClass}">⚡ ${translateAction(log.action)}</span>
            ${resourceDisplay !== '-' ? `<span class="header-pill pill-resource">📁 ${resourceDisplay}</span>` : ''}
            ${log.ipAddress ? `<span class="header-pill pill-ip">🌐 ${log.ipAddress}</span>` : ''}
            ${log.id ? `<span class="header-pill" style="background-color: #f5f5f5; border: 1px solid #bdbdbd; color: #616161;">#${log.id}</span>` : ''}
          </div>
        </div>
    `);
    
    // Add details section if available
    if (log.details || log.metadata || log.oldValue || log.newValue) {
      printWindow.document.write(`<div class="log-details">`);
      
      // Process main details/metadata
      const details = log.details || log.metadata;
      if (details) {
        const detailsObj = formatDetailsAsPills(details);
        
        if (Object.keys(detailsObj).length > 0) {
          printWindow.document.write(`
            <div class="detail-section">
              <div class="section-title">Details</div>
              <div class="detail-pills">
          `);
          
          // Special handling for specific action types
          if (log.action === 'host_restored' || log.action === 'hostRestored') {            // Parse restored host data if it's a JSON string
            let restoredData = detailsObj.restoredHostData || detailsObj.restored_host_data || detailsObj;
            if (typeof restoredData === 'string') {
              try {
                restoredData = JSON.parse(restoredData);
              } catch (e) {
                restoredData = detailsObj;
              }
            }
            
            // Group host data by categories
            const basicInfo = {};
            const connectionInfo = {};
            const visualInfo = {};
            const remoteInfo = {};
            const timestamps = {};
            
            Object.entries(restoredData).forEach(([key, value]) => {
              if (['id', 'name', 'description', 'isActive', 'is_active'].includes(key)) {
                basicInfo[key] = value;
              } else if (['hostname', 'port', 'username', 'sshKeyName', 'ssh_key_name', 'privateKey', 'private_key', 'password'].includes(key)) {
                connectionInfo[key] = value;
              } else if (['icon', 'color', 'transparency', 'blur'].includes(key)) {
                visualInfo[key] = value;
              } else if (key.includes('remote') || key.includes('guacamole') || key.includes('rustdesk')) {
                remoteInfo[key] = value;
              } else if (key.includes('created') || key.includes('updated') || key.includes('tested')) {
                timestamps[key] = value;
              }
            });
            
            // Render grouped pills
            if (Object.keys(basicInfo).length > 0) {              printWindow.document.write('<div style="margin-bottom: 8px;"><strong style="color: #666; font-size: 0.9em;">Basis-Informationen:</strong><br>');
              Object.entries(basicInfo).forEach(([key, value]) => {
                printWindow.document.write(renderDetailPills(key, value));
              });
              printWindow.document.write('</div>');
            }
            
            if (Object.keys(connectionInfo).length > 0) {
              printWindow.document.write('<div style="margin-bottom: 8px;"><strong style="color: #666; font-size: 0.9em;">Verbindung:</strong><br>');
              Object.entries(connectionInfo).forEach(([key, value]) => {
                // Hide password values
                if (key.includes('password') || key.includes('Password')) {
                  value = '••••••••';
                }
                printWindow.document.write(renderDetailPills(key, value));
              });
              printWindow.document.write('</div>');
            }
            
            if (Object.keys(visualInfo).length > 0) {
              printWindow.document.write('<div style="margin-bottom: 8px;"><strong style="color: #666; font-size: 0.9em;">Visuell:</strong><br>');
              Object.entries(visualInfo).forEach(([key, value]) => {
                printWindow.document.write(renderDetailPills(key, value));
              });
              printWindow.document.write('</div>');
            }
            
            if (Object.keys(remoteInfo).length > 0) {
              printWindow.document.write('<div style="margin-bottom: 8px;"><strong style="color: #666; font-size: 0.9em;">Remote Desktop:</strong><br>');
              Object.entries(remoteInfo).forEach(([key, value]) => {                // Hide password values
                if (key.includes('password') || key.includes('Password')) {
                  value = '••••••••';
                }
                printWindow.document.write(renderDetailPills(key, value));
              });
              printWindow.document.write('</div>');
            }
            
            if (Object.keys(timestamps).length > 0) {
              printWindow.document.write('<div style="margin-bottom: 8px;"><strong style="color: #666; font-size: 0.9em;">Zeitstempel:</strong><br>');
              Object.entries(timestamps).forEach(([key, value]) => {
                printWindow.document.write(renderDetailPills(key, value));
              });
              printWindow.document.write('</div>');
            }
          } else if (log.action.includes('backup')) {
            // Special handling for backup actions
            Object.entries(detailsObj).forEach(([key, value]) => {
              if (key === 'restored_items' && typeof value === 'object') {
                printWindow.document.write('<div style="margin-bottom: 8px;"><strong style="color: #666; font-size: 0.9em;">Wiederhergestellte Elemente:</strong><br>');
                Object.entries(value).forEach(([itemKey, itemCount]) => {
                  if (itemCount > 0) {
                    printWindow.document.write(renderDetailPills(itemKey, `${itemCount} Elemente`));
                  }
                });
                printWindow.document.write('</div>');
              } else {
                printWindow.document.write(renderDetailPills(key, value));
              }
            });
          } else {            // Default rendering for all other actions
            Object.entries(detailsObj).forEach(([key, value]) => {
              // Skip password fields
              if (key.includes('password') || key.includes('Password') || key.includes('secret')) {
                value = '••••••••';
              }
              
              // Parse nested JSON strings
              if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                try {
                  const parsed = JSON.parse(value);
                  printWindow.document.write(renderDetailPills(key, parsed));
                } catch (e) {
                  printWindow.document.write(renderDetailPills(key, value));
                }
              } else {
                printWindow.document.write(renderDetailPills(key, value));
              }
            });
          }
          
          printWindow.document.write(`
              </div>
            </div>
          `);
        }
      }
      
      // Process old/new values for updates
      if (log.oldValue || log.newValue) {
        printWindow.document.write(`
          <div class="detail-section">
            <div class="section-title">Änderungen</div>
        `);        
        if (log.oldValue) {
          const oldValueObj = formatDetailsAsPills(log.oldValue);
          printWindow.document.write(`
            <div style="margin-bottom: 10px; padding: 8px; background-color: #ffebee; border-radius: 6px; border: 1px solid #ffcdd2;">
              <strong style="color: #c62828; font-size: 0.9em;">↩ Vorheriger Wert:</strong>
              <div class="detail-pills" style="margin-top: 6px;">
          `);
          
          Object.entries(oldValueObj).forEach(([key, value]) => {
            if (key.includes('password') || key.includes('Password')) {
              value = '••••••••';
            }
            const pillHtml = renderDetailPills(key, value);
            // Modify pill colors for old values
            const modifiedPillHtml = pillHtml
              .replace('#e3f2fd', '#ffebee')
              .replace('#90caf9', '#ef9a9a')
              .replace('#1565c0', '#c62828');
            printWindow.document.write(modifiedPillHtml);
          });
          
          printWindow.document.write(`
              </div>
            </div>
          `);
        }
        
        if (log.newValue) {
          const newValueObj = formatDetailsAsPills(log.newValue);
          printWindow.document.write(`
            <div style="padding: 8px; background-color: #e8f5e9; border-radius: 6px; border: 1px solid #c8e6c9;">
              <strong style="color: #2e7d32; font-size: 0.9em;">↪ Neuer Wert:</strong>
              <div class="detail-pills" style="margin-top: 6px;">
          `);
          
          Object.entries(newValueObj).forEach(([key, value]) => {
            if (key.includes('password') || key.includes('Password')) {
              value = '••••••••';
            }
            const pillHtml = renderDetailPills(key, value);
            // Modify pill colors for new values
            const modifiedPillHtml = pillHtml
              .replace('#e3f2fd', '#e8f5e9')
              .replace('#90caf9', '#81c784')
              .replace('#1565c0', '#2e7d32');
            printWindow.document.write(modifiedPillHtml);
          });
          
          printWindow.document.write(`
              </div>
            </div>
          `);
        }
        
        printWindow.document.write(`</div>`);
      }
      
      printWindow.document.write(`</div>`); // Close log-details
    }
    
    printWindow.document.write(`</div>`); // Close log-entry
  });

  // Add footer with print buttons
  printWindow.document.write(`      <div style="margin-top: 30px;" class="no-print">
        <button onclick="window.print()" style="padding: 10px 20px; margin-right: 10px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">📄 Als PDF drucken</button>
        <button onclick="window.close()" style="padding: 10px 20px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">❌ Schließen</button>
      </div>
      <script>
        // Automatically trigger print dialog after page loads
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
  
  // Focus the new window to bring it to front
  printWindow.focus();
};

// Delete old audit logs
export const deleteOldAuditLogs = async (days) => {
  const response = await axios.delete('/api/audit-logs/cleanup', {
    data: { days },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  
  return response.data;
};
// Delete filtered audit logs
export const deleteFilteredAuditLogs = async (logIds) => {
  const response = await axios.delete('/api/audit-logs/delete-filtered', {
    data: { logIds },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  
  return response.data;
};