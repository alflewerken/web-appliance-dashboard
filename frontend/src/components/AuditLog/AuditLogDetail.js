import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
} from '@mui/material';
import { Undo2, AlertCircle } from 'lucide-react';
import axios from '../../utils/axiosConfig';

const AuditLogDetail = ({ entry, onClose, onRestore }) => {
  const details = entry.details || {};
  
  // Format field names for display
  const formatFieldName = (fieldName) => {
    const translations = {
      name: 'Name',
      description: 'Beschreibung',
      hostname: 'Hostname',
      port: 'Port',
      username: 'Benutzername',
      password: 'Passwort',
      privateKey: 'Privater Schlüssel',
      private_key: 'Privater Schlüssel',
      sshKeyName: 'SSH-Schlüssel',
      ssh_key_name: 'SSH-Schlüssel',
      icon: 'Icon',
      color: 'Farbe',
      transparency: 'Transparenz',
      blur: 'Unschärfe',
      remoteDesktopEnabled: 'Remote Desktop aktiviert',
      remote_desktop_enabled: 'Remote Desktop aktiviert',
      remoteDesktopType: 'Remote Desktop Typ',
      remote_desktop_type: 'Remote Desktop Typ',
      remoteProtocol: 'Remote Protokoll',
      remote_protocol: 'Remote Protokoll',
      remotePort: 'Remote Port',
      remote_port: 'Remote Port',
      remoteUsername: 'Remote Benutzername',
      remote_username: 'Remote Benutzername',
      remotePassword: 'Remote Passwort',
      remote_password: 'Remote Passwort',
      rustdesk_id: 'RustDesk ID',
      rustdesk_password: 'RustDesk Passwort',
      guacamole_performance_mode: 'Guacamole Performance Mode',
      created_by: 'Erstellt von',
      updated_by: 'Aktualisiert von',
      deleted_by: 'Gelöscht von',
      key_name: 'Schlüssel-Name',
      host: 'Host',
      registered_by: 'Registriert von',
    };
    
    return translations[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format values for display
  const formatValue = (value, fieldName) => {
    if (fieldName.includes('password') || fieldName === 'privateKey' || fieldName === 'private_key') {
      return value ? '••••••••' : '-';
    }
    
    if (fieldName.includes('_enabled') || typeof value === 'boolean') {
      return value ? 'Ja' : 'Nein';
    }
    
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    
    if (fieldName === 'transparency') {
      return `${Math.round((1 - value) * 100)}%`;
    }
    
    if (fieldName === 'blur') {
      return `${value}px`;
    }
    
    if (fieldName === 'color') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 20,
              height: 20,
              backgroundColor: value,
              borderRadius: 1,
              border: '1px solid rgba(0,0,0,0.2)',
            }}
          />
          <span>{value}</span>
        </Box>
      );
    }
    
    return value.toString();
  };

  // Handle restore action
  const handleRestore = async () => {
    try {
      let response;
      
      if (entry.action === 'host_deleted') {
        response = await axios.post(`/api/restore/host/${entry.id}`);
      } else if (entry.action === 'host_updated' && entry.resource_id) {
        response = await axios.post(`/api/restore/host/${entry.resource_id}/revert/${entry.id}`);
      }
      
      if (response?.data?.success) {
        if (onRestore) {
          onRestore();
        }
      }
    } catch (error) {
      console.error('Error restoring:', error);
    }
  };

  // Render different views based on action type
  const renderContent = () => {
    switch (entry.action) {
      case 'host_created':
        return renderCreatedView();
      case 'host_updated':
        return renderUpdatedView();
      case 'host_deleted':
        return renderDeletedView();
      case 'ssh_key_registered':
        return renderSSHKeyRegisteredView();
      default:
        return renderGenericView();
    }
  };

  // Render view for created hosts
  const renderCreatedView = () => {
    const fields = Object.entries(details).filter(([key]) => 
      !['created_by', 'updated_by'].includes(key)
    );

    return (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Feldname</strong></TableCell>
              <TableCell><strong>Wert</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell>{formatFieldName(key)}</TableCell>
                <TableCell>{formatValue(value, key)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render view for updated hosts
  const renderUpdatedView = () => {
    const changes = details.changes || {};
    const oldValues = details.oldValues || {};
    const changedFields = Object.keys(changes);

    return (
      <>
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Feldname</strong></TableCell>
                <TableCell><strong>Alter Wert</strong></TableCell>
                <TableCell><strong>Neuer Wert</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changedFields.map((key) => (
                <TableRow key={key}>
                  <TableCell>{formatFieldName(key)}</TableCell>
                  <TableCell>{formatValue(oldValues[key], key)}</TableCell>
                  <TableCell>{formatValue(changes[key], key)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="warning"
            startIcon={<Undo2 />}
            onClick={handleRestore}
          >
            Änderungen rückgängig machen
          </Button>
        </Box>
      </>
    );
  };

  // Render view for deleted hosts
  const renderDeletedView = () => {
    const fields = Object.entries(details).filter(([key]) => 
      !['deleted_by', 'password', 'remote_password', 'rustdesk_password', 'private_key'].includes(key)
    );

    return (
      <>
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'error.main', borderRadius: 1, color: 'white' }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertCircle size={20} />
            Dieser Host wurde gelöscht. Sie können ihn wiederherstellen.
          </Typography>
        </Box>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Feldname</strong></TableCell>
                <TableCell><strong>Wert</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{formatFieldName(key)}</TableCell>
                  <TableCell>{formatValue(value, key)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<Undo2 />}
            onClick={handleRestore}
          >
            Host wiederherstellen
          </Button>
        </Box>
      </>
    );
  };

  // Render view for SSH key registration
  const renderSSHKeyRegisteredView = () => {
    const fields = Object.entries(details);

    return (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Eigenschaft</strong></TableCell>
              <TableCell><strong>Wert</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell>{formatFieldName(key)}</TableCell>
                <TableCell>{formatValue(value, key)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Generic view for other actions
  const renderGenericView = () => {
    return (
      <Box sx={{ mt: 2 }}>
        <pre style={{ 
          backgroundColor: 'rgba(0,0,0,0.05)', 
          padding: '12px', 
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '400px' 
        }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {entry.action === 'host_created' && 'Host erstellt'}
        {entry.action === 'host_updated' && 'Host aktualisiert'}
        {entry.action === 'host_deleted' && 'Host gelöscht'}
        {entry.action === 'ssh_key_registered' && 'SSH-Schlüssel registriert'}
      </Typography>

      {entry.resource_name && (
        <Chip 
          label={entry.resource_name} 
          color="primary" 
          size="small" 
          sx={{ mb: 2 }}
        />
      )}

      {renderContent()}
    </Box>
  );
};

export default AuditLogDetail;