import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mui/material';
import axios from '../utils/axiosConfig';
import HostCard from './HostCard';
import sseService from '../services/sseService';
import './ApplianceCard.css';

const HostsView = ({
  hosts: propsHosts,
  onAddHost,
  onEditHost,
  onTerminal,
  onRemoteDesktop,
  onFileTransfer,
  onShowAuditLog,
  isAdmin,
  isMobile,
  cardSize,
}) => {
  const [hosts, setHosts] = useState(propsHosts || []);
  const [loading, setLoading] = useState(!propsHosts);
  const [error, setError] = useState(null);

  // Update hosts when propsHosts change
  useEffect(() => {
    if (propsHosts) {
      setHosts(propsHosts);
    }
  }, [propsHosts]);

  // Load hosts from API and subscribe to SSE events
  useEffect(() => {
    // Only load if no props provided
    if (!propsHosts) {
      loadHosts();
    }
    
    // Subscribe to SSE events for real-time updates
    const handleHostCreated = (data) => {
      loadHosts();
    };
    
    const handleHostUpdated = (data) => {
      loadHosts();
    };
    
    const handleHostDeleted = (data) => {
      loadHosts();
    };
    
    const handleHostRestored = (data) => {
      loadHosts();
    };
    
    const handleHostReverted = (data) => {
      loadHosts();
    };
    
    // Connect to SSE and add event listeners
    sseService.connect().then(() => {
      sseService.addEventListener('host_created', handleHostCreated);
      sseService.addEventListener('host_updated', handleHostUpdated);
      sseService.addEventListener('host_deleted', handleHostDeleted);
      sseService.addEventListener('host_restored', handleHostRestored);
      sseService.addEventListener('host_reverted', handleHostReverted);
    });
    
    // Cleanup listeners on unmount
    return () => {
      sseService.removeEventListener('host_created', handleHostCreated);
      sseService.removeEventListener('host_updated', handleHostUpdated);
      sseService.removeEventListener('host_deleted', handleHostDeleted);
      sseService.removeEventListener('host_restored', handleHostRestored);
      sseService.removeEventListener('host_reverted', handleHostReverted);
    };
  }, [propsHosts]);

  const loadHosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/hosts');
      setHosts(response.data.hosts || []);
      setError(null);
    } catch (err) {
      console.error('Error loading hosts:', err);
      setError('Fehler beim Laden der Hosts');
    } finally {
      setLoading(false);
    }
  };

  const handleShowAuditLog = (host) => {
    // Navigate to audit log panel with host filter
    if (onShowAuditLog) {
      onShowAuditLog(host);
    }
  };

  if (loading) {
    return (
      <div className="content-wrapper">
        <div className="loading-message">Lade Hosts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-wrapper">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="content-wrapper">
      {/* Add Host Button - top left */}
      <div style={{
        marginBottom: '20px',
        paddingLeft: '10px'
      }}>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={onAddHost}
          sx={{
            backgroundColor: '#007AFF',
            color: 'white',
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 16px',
            '&:hover': {
              backgroundColor: '#0056CC',
            },
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          Host hinzufügen
        </Button>
      </div>
      
      {/* Hosts Grid */}
      <div className="appliances-grid" style={{ 
        '--card-size': cardSize ? `${Math.max(cardSize, 150)}px` : '180px' 
      }}>
        {/* Host Cards */}
        {hosts.map(host => (
          <HostCard
            key={host.id}
            host={host}
            onEdit={onEditHost}
            onTerminal={onTerminal}
            onRemoteDesktop={onRemoteDesktop}
            onFileTransfer={onFileTransfer}
            onShowAuditLog={handleShowAuditLog}
            isAdmin={isAdmin}
            cardSize={Math.max(cardSize || 180, 150)}
          />
        ))}
        
        {/* Empty state */}
        {hosts.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '40px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '16px'
          }}>
            Keine Hosts vorhanden. Klicken Sie auf "Host hinzufügen", um einen neuen Host zu erstellen.
          </div>
        )}
      </div>
    </div>
  );
};

export default HostsView;
