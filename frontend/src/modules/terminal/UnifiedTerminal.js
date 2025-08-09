import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import TTYDTerminal from '../../components/TTYDTerminal';
import axios from '../../utils/axiosConfig';

/**
 * Unified Terminal Component for both Hosts and Services
 * @param {Object} entity - The host or appliance object
 * @param {string} entityType - 'host' or 'service'
 * @param {string} sshConnection - SSH connection string (for services)
 * @param {Function} onClose - Callback when terminal is closed
 */
export const UnifiedTerminal = ({ 
  entity, 
  entityType = 'host',
  sshConnection = null,
  onClose 
}) => {
  const [terminalUrl, setTerminalUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (entity) {
      startTerminal();
    }
  }, [entity, entityType, sshConnection]);

  const startTerminal = async () => {
    try {
      setLoading(true);
      setError(null);

      let endpoint;
      let payload;

      if (entityType === 'host') {
        // Direct host terminal
        endpoint = `/api/hosts/${entity.id}/terminal`;
        payload = {};
      } else if (entityType === 'service') {
        // Service terminal through SSH connection
        if (!sshConnection) {
          throw new Error('Keine SSH-Verbindung konfiguriert');
        }
        endpoint = `/api/terminal/service`;
        payload = { 
          applianceId: entity.id,
          sshConnection: sshConnection 
        };
      }

      const response = await axios.post(endpoint, payload);
      
      if (response.data.url) {
        setTerminalUrl(response.data.url);
      } else if (response.data.terminalUrl) {
        setTerminalUrl(response.data.terminalUrl);
      } else {
        throw new Error('Keine Terminal-URL erhalten');
      }
    } catch (err) {
      console.error('Terminal start error:', err);
      setError(err.response?.data?.error || err.message || 'Fehler beim Starten des Terminals');
    } finally {
      setLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalUrl && entityType === 'host') {
        // Cleanup terminal session if needed
        axios.delete(`/api/hosts/${entity.id}/terminal`).catch(err => {
          console.error('Error cleaning up terminal:', err);
        });
      }
    };
  }, [terminalUrl, entity, entityType]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Terminal wird gestartet...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!terminalUrl) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Keine Terminal-URL verfügbar</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <TTYDTerminal
        url={terminalUrl}
        title={`Terminal - ${entity.name || entity.hostname || 'Unknown'}`}
        onClose={onClose}
      />
    </Box>
  );
};

export default UnifiedTerminal;
