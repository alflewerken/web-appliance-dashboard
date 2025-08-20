// Audit Log Export utilities
import axios from '../../utils/axiosConfig';
import { formatActionName, getActionColor } from './AuditLogActions';

// Helper function to translate action names to German
const translateAction = (action) => {
  const translations = {
    'ssh_file_upload': 'Dateiupload',
    'ssh_file_download': 'Dateidownload',
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
  } else if (dateRange !== 'all') {
    const now = new Date();
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

// Export logs for printing/PDF
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
        }
        h1 {
          color: #333;
          border-bottom: 3px solid #4caf50;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .info-header {
          background-color: #f0f0f0;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .info-header p {
          margin: 5px 0;
        }
        .log-entry {
          margin-bottom: 20px;
          border: 1px solid #ddd;
          border-radius: 4px;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .log-header {
          display: grid;
          grid-template-columns: 180px 120px 150px 200px 120px;
          background-color: #f9f9f9;
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        .log-header strong {
          font-weight: 600;
          color: #555;
        }
        .log-details {
          padding: 10px 10px 10px 30px;
          background-color: #fafafa;
          font-size: 0.9em;
        }
        .detail-row {
          display: flex;
          margin-bottom: 5px;
        }
        .detail-label {
          font-weight: 500;
          color: #666;
          width: 120px;
          flex-shrink: 0;
        }
        .detail-value {
          color: #333;
          word-break: break-word;
        }
        .action-success { color: #4caf50; font-weight: 600; }
        .action-error { color: #f44336; font-weight: 600; }
        .action-warning { color: #ff9800; font-weight: 600; }
        .action-info { color: #2196f3; font-weight: 600; }
        .metadata-section {
          background-color: #f5f5f5;
          padding: 5px 10px;
          border-radius: 4px;
          margin-bottom: 8px;
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
        .header-title {
          font-weight: bold;
          background-color: #e0e0e0;
          padding: 8px;
          margin-bottom: 0;
        }
        .print-instructions {
          background-color: #e3f2fd;
          border: 2px solid #2196f3;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .print-instructions h3 {
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
          <li>3. Empfohlene Einstellungen:
            <ul>
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
      
      <!-- Header Row -->
      <div class="log-header header-title">
        <div><strong>Datum/Zeit</strong></div>
        <div><strong>Benutzer</strong></div>
        <div><strong>Aktion</strong></div>
        <div><strong>Ressource</strong></div>
        <div><strong>IP-Adresse</strong></div>
      </div>
  `);

  logs.forEach((log, index) => {
    // Use resourceName if available, otherwise construct from type and ID
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
    
    const actionClass = getActionColor(log.action).replace('error', 'action-error')
      .replace('success', 'action-success')
      .replace('warning', 'action-warning')
      .replace('info', 'action-info');
    
    printWindow.document.write(`
      <div class="log-entry">
        <div class="log-header">
          <div>${new Date(log.createdAt).toLocaleString('de-DE')}</div>
          <div>${log.username || 'System'}</div>
          <div class="${actionClass}">${translateAction(log.action)}</div>
          <div>${resourceDisplay}</div>
          <div>${log.ipAddress || '-'}</div>
        </div>
        <div class="log-details">
    `);
    
    // Add detailed information
    if (log.id) {
      printWindow.document.write(`
        <div class="detail-row">
          <span class="detail-label">Log ID:</span>
          <span class="detail-value">#${log.id}</span>
        </div>
      `);
    }
    
    if (log.userId) {
      printWindow.document.write(`
        <div class="detail-row">
          <span class="detail-label">User ID:</span>
          <span class="detail-value">${log.userId}</span>
        </div>
      `);
    }
    
    if (log.resourceType && log.resourceId) {
      printWindow.document.write(`
        <div class="detail-row">
          <span class="detail-label">Resource:</span>
          <span class="detail-value">${log.resourceType} (ID: ${log.resourceId})</span>
        </div>
      `);
    }
    
    if (log.userAgent) {
      printWindow.document.write(`
        <div class="detail-row">
          <span class="detail-label">User Agent:</span>
          <span class="detail-value">${log.userAgent}</span>
        </div>
      `);
    }
    
    if (log.details) {
      let detailsObj = {};
      try {
        detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch {
        detailsObj = { raw: log.details };
      }
      
      printWindow.document.write(`
        <div class="detail-row">
          <span class="detail-label">Details:</span>
          <span class="detail-value">
            <div style="margin-left: 10px;">
      `);
      
      // Format details as readable key-value pairs
      Object.entries(detailsObj).forEach(([key, value]) => {
        // Special handling for specific keys
        if (key === 'files' && Array.isArray(value)) {
          // Handle file uploads/downloads
          value.forEach(file => {
            printWindow.document.write(`
              <div style="margin-bottom: 4px;">
                <strong style="color: #555; display: inline-block; min-width: 150px;">Datei:</strong>
                <span style="color: #333;">${file.name}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="color: #555; display: inline-block; min-width: 150px;">Dateigröße:</strong>
                <span style="color: #333;">${formatFileSize(file.bytes || file.size || 0)}</span>
              </div>
            `);
          });
        } else if (key === 'restored_items' && typeof value === 'object') {
          // Handle backup restore items as a table
          printWindow.document.write(`
            <div style="margin-bottom: 8px;">
              <strong style="color: #555;">Wiederhergestellte Elemente:</strong>
              <table style="margin-top: 5px; margin-left: 10px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f0f0f0;">
                    <th style="padding: 4px 8px; text-align: left; border: 1px solid #ddd; font-size: 0.9em;">Typ</th>
                    <th style="padding: 4px 8px; text-align: right; border: 1px solid #ddd; font-size: 0.9em;">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
          `);
          
          Object.entries(value).forEach(([itemKey, itemCount]) => {
            if (itemCount > 0) {
              const itemName = itemKey
                .replace(/_/g, ' ')
                .replace(/^./, str => str.toUpperCase());
              printWindow.document.write(`
                <tr>
                  <td style="padding: 2px 8px; border: 1px solid #ddd; font-size: 0.85em;">${itemName}</td>
                  <td style="padding: 2px 8px; text-align: right; border: 1px solid #ddd; font-size: 0.85em;">${itemCount}</td>
                </tr>
              `);
            }
          });
          
          printWindow.document.write(`
                </tbody>
              </table>
            </div>
          `);
        } else if (key === 'backup_created_at' || key === 'created_at' || key === 'updated_at') {
          // Format dates
          const formattedKey = key === 'backup_created_at' ? 'Backup erstellt am' : 
                              key === 'created_at' ? 'Erstellt am' : 'Aktualisiert am';
          const dateValue = new Date(value).toLocaleString('de-DE');
          printWindow.document.write(`
            <div style="margin-bottom: 4px;">
              <strong style="color: #555; display: inline-block; min-width: 150px;">${formattedKey}:</strong>
              <span style="color: #333;">${dateValue}</span>
            </div>
          `);
        } else if (key === 'backup_version') {
          printWindow.document.write(`
            <div style="margin-bottom: 4px;">
              <strong style="color: #555; display: inline-block; min-width: 150px;">Backup Version:</strong>
              <span style="color: #333;">${value}</span>
            </div>
          `);
        } else if (key === 'restored_by') {
          printWindow.document.write(`
            <div style="margin-bottom: 4px;">
              <strong style="color: #555; display: inline-block; min-width: 150px;">Wiederhergestellt von:</strong>
              <span style="color: #333;">${value}</span>
            </div>
          `);
        } else {
          // Default formatting for other keys
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .replace(/^./, str => str.toUpperCase())
            .trim();
          
          let formattedValue = value;
          if (typeof value === 'boolean') {
            formattedValue = value ? '✓ Ja' : '✗ Nein';
          } else if (value === null) {
            formattedValue = '-';
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value, null, 2);
          }
          
          printWindow.document.write(`
            <div style="margin-bottom: 4px;">
              <strong style="color: #555; display: inline-block; min-width: 150px;">${formattedKey}:</strong>
              <span style="color: #333;">${formattedValue}</span>
            </div>
          `);
        }
      });
      
      printWindow.document.write(`
            </div>
          </span>
        </div>
      `);
    }
    
    if (log.oldValue || log.newValue) {
      printWindow.document.write(`
        <div class="detail-row">
          <span class="detail-label">Änderungen:</span>
          <span class="detail-value">
      `);
      
      if (log.oldValue) {
        let oldValueObj = {};
        try {
          oldValueObj = typeof log.oldValue === 'string' ? JSON.parse(log.oldValue) : log.oldValue;
        } catch {
          oldValueObj = { value: log.oldValue };
        }
        
        printWindow.document.write(`
          <div style="margin-bottom: 10px; padding: 8px; background-color: #ffe6e6; border-left: 3px solid #ff4444; margin-left: 10px;">
            <strong style="color: #cc0000;">Vorheriger Wert:</strong>
            <div style="margin-top: 5px;">
        `);
        
        Object.entries(oldValueObj).forEach(([key, value]) => {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .replace(/^./, str => str.toUpperCase())
            .trim();
          
          let formattedValue = value;
          if (typeof value === 'boolean') {
            formattedValue = value ? '✓ Ja' : '✗ Nein';
          } else if (value === null || value === undefined) {
            formattedValue = '-';
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value, null, 2);
          }
          
          printWindow.document.write(`
            <div style="margin-bottom: 2px;">
              <span style="color: #666; display: inline-block; min-width: 120px;">${formattedKey}:</span>
              <span style="color: #333;">${formattedValue}</span>
            </div>
          `);
        });
        
        printWindow.document.write(`
            </div>
          </div>
        `);
      }
      
      if (log.newValue) {
        let newValueObj = {};
        try {
          newValueObj = typeof log.newValue === 'string' ? JSON.parse(log.newValue) : log.newValue;
        } catch {
          newValueObj = { value: log.newValue };
        }
        
        printWindow.document.write(`
          <div style="padding: 8px; background-color: #e6ffe6; border-left: 3px solid #44ff44; margin-left: 10px;">
            <strong style="color: #008800;">Neuer Wert:</strong>
            <div style="margin-top: 5px;">
        `);
        
        Object.entries(newValueObj).forEach(([key, value]) => {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .replace(/^./, str => str.toUpperCase())
            .trim();
          
          let formattedValue = value;
          if (typeof value === 'boolean') {
            formattedValue = value ? '✓ Ja' : '✗ Nein';
          } else if (value === null || value === undefined) {
            formattedValue = '-';
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value, null, 2);
          }
          
          printWindow.document.write(`
            <div style="margin-bottom: 2px;">
              <span style="color: #666; display: inline-block; min-width: 120px;">${formattedKey}:</span>
              <span style="color: #333;">${formattedValue}</span>
            </div>
          `);
        });
        
        printWindow.document.write(`
            </div>
          </div>
        `);
      }
      
      printWindow.document.write(`
          </span>
        </div>
      `);
    }
    
    printWindow.document.write(`
        </div>
      </div>
    `);
  });

  printWindow.document.write(`
      <div style="margin-top: 30px;" class="no-print">
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
