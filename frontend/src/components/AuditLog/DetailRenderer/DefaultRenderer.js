// Default renderer for general audit log details
import React from 'react';
import {
  Box,
  Typography,
  Alert,
} from '@mui/material';

export const renderDefault = (log, details, isDarkMode) => {
  // For delete actions - show deleted resource details
  if (log.action.includes('delete')) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Diese Ressource wurde gelöscht
        </Alert>
        <Box sx={{
          '& table': {
            borderCollapse: 'collapse',
            width: '100%',
          },
          '& td': {
            padding: '8px 12px',
            borderBottom: `1px solid ${isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)' 
              : 'rgba(0, 0, 0, 0.08)'}`,
          },
          '& tr:last-child td': {
            borderBottom: 'none',
          },
        }}>
          <table>
            <tbody>
              {Object.entries(details).map(([key, value]) => {
                if (key === 'password' || key.includes('secret')) return null;
                
                const formattedKey = key
                  .replace(/_/g, ' ')
                  .replace(/([A-Z])/g, ' $1')
                  .trim()
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
                
                let formattedValue = value;
                if (typeof value === 'object' && value !== null) {
                  formattedValue = JSON.stringify(value, null, 2);
                } else if (value === null || value === undefined) {
                  formattedValue = '-';
                } else {
                  formattedValue = value.toString();
                }
                
                return (
                  <tr key={key}>
                    <td style={{ fontWeight: 500, width: '30%' }}>{formattedKey}:</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{formattedValue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>
    );
  }

  // Default view - show all details in table format
  return (
    <Box sx={{
      '& table': {
        borderCollapse: 'collapse',
        width: '100%',
      },
      '& td': {
        padding: '8px 12px',
        borderBottom: `1px solid ${isDarkMode 
          ? 'rgba(255, 255, 255, 0.08)' 
          : 'rgba(0, 0, 0, 0.08)'}`,
      },
    }}>
      <table>
        <tbody>
          {Object.entries(details).map(([key, value]) => {
            if (key === 'password' || key.includes('secret')) return null;
            
            const formattedKey = key
              .replace(/_/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
            
            let formattedValue = value?.toString() || '-';
            
            return (
              <tr key={key}>
                <td style={{ fontWeight: 500, width: '30%' }}>{formattedKey}:</td>
                <td>{formattedValue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
};
