// File transfer renderer for SSH upload/download actions - COMPLETE VERSION
import React from 'react';
import {
  Box,
  Typography,
  Alert,
} from '@mui/material';

export const renderFileTransfer = (log, details, isDarkMode) => {
  // Handle different data structures from backend
  let fileName = details.fileName || details.file_name || details.filename || '-';
  let fileSize = details.fileSize || details.file_size || details.size || '-';
  let hostName = details.hostname || details.hostName || details.host_name || details.host || '-';
  let targetPath = details.target_path || details.targetPath || details.destinationPath || details.destination_path || details.destination || '-';
  
  // Check if files array exists (new structure from sshUploadHandler)
  if (details.files && Array.isArray(details.files) && details.files.length > 0) {
    const firstFile = details.files[0];
    fileName = firstFile.name || firstFile.filename || fileName;
    fileSize = firstFile.bytes || firstFile.size || fileSize;
  }
  
  const hostIp = details.host_ip || details.hostIp || '-';
  const sourcePath = details.sourcePath || details.source_path || details.source || '-';
  const transferredBy = details.transferredBy || details.transferred_by || details.username || log.username || '-';
  const timestamp = log.createdAt || details.timestamp || log.timestamp || '-';
  
  // Format file size
  const formatFileSize = (size) => {
    if (!size || size === '-') return '-';
    const bytes = parseInt(size);
    if (isNaN(bytes)) return size;
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let formattedSize = bytes;
    
    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }
    
    return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date || date === '-') return '-';
    try {
      return new Date(date).toLocaleString('de-DE');
    } catch {
      return date;
    }
  };
  
  const isUpload = log.action.includes('upload');
  
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        {isUpload ? 'Datei wurde hochgeladen' : 'Datei wurde heruntergeladen'}
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Dateiübertragung-Details:
      </Typography>
      
      <Box sx={{
        '& table': {
          borderCollapse: 'collapse',
          width: '100%',
        },
        '& td': {
          padding: '10px 12px',
          borderBottom: `1px solid ${isDarkMode 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(0, 0, 0, 0.08)'}`,
        },
        '& tr:last-child td': {
          borderBottom: 'none',
        },
        '& td:first-of-type': {
          fontWeight: 500,
          color: isDarkMode 
            ? 'rgba(255, 255, 255, 0.6)' 
            : 'rgba(0, 0, 0, 0.6)',
          width: '35%',
        },
      }}>
        <table>
          <tbody>
            {fileName !== '-' && (
              <tr><td>Dateiname:</td><td style={{ fontFamily: 'monospace' }}>{fileName}</td></tr>
            )}
            {fileSize !== '-' && (
              <tr><td>Dateigröße:</td><td>{formatFileSize(fileSize)}</td></tr>
            )}
            {hostName !== '-' && (
              <tr><td>Host:</td><td style={{ fontWeight: 600 }}>{hostName}</td></tr>
            )}
            {hostIp !== '-' && (
              <tr><td>Host-IP:</td><td style={{ fontFamily: 'monospace' }}>{hostIp}</td></tr>
            )}
            {targetPath !== '-' && (
              <tr><td>Zielpfad:</td><td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{targetPath}</td></tr>
            )}
            {sourcePath !== '-' && (
              <tr><td>Quellpfad:</td><td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{sourcePath}</td></tr>
            )}
            {transferredBy !== '-' && (
              <tr><td>Übertragen von:</td><td>{transferredBy}</td></tr>
            )}
            <tr><td>Zeitstempel:</td><td>{formatDate(timestamp)}</td></tr>
          </tbody>
        </table>
      </Box>
    </Box>
  );
};
