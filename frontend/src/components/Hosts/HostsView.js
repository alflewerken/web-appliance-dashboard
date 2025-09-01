import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from '../../utils/axiosConfig';
import HostCard from './HostCard';
import sseService from '../../services/sseService';
import '../Appliances/ApplianceCard.css';

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
  const { t } = useTranslation();
  const [hosts, setHosts] = useState(propsHosts || []);
  const [loading, setLoading] = useState(!propsHosts);
  const [error, setError] = useState(null);
  const [activeCardId, setActiveCardId] = useState(null); // Track which card is active on touch devices

  // Auto-hide active card after timeout
  useEffect(() => {
    if (activeCardId) {
      const timeout = setTimeout(() => {
        setActiveCardId(null);
      }, 10000); // Hide after 10 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [activeCardId]);

  // Handle clicks outside of cards to deactivate
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is outside any card
      if (!e.target.closest('.appliance-card-container')) {
        setActiveCardId(null);
      }
    };

    // Add event listeners for both mouse and touch
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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
    
    // Handle ping status updates
    const handleHostPingStatus = (data) => {
      setHosts(prevHosts => 
        prevHosts.map(host => 
          host.id === data.id 
            ? { 
                ...host, 
                pingStatus: data.status, 
                pingResponseTime: data.responseTime,
                statusColor: data.statusColor 
              }
            : host
        )
      );
    };
    
    // Connect to SSE and add event listeners
    sseService.connect().then(() => {
      sseService.addEventListener('host_created', handleHostCreated);
      sseService.addEventListener('host_updated', handleHostUpdated);
      sseService.addEventListener('host_deleted', handleHostDeleted);
      sseService.addEventListener('host_restored', handleHostRestored);
      sseService.addEventListener('host_reverted', handleHostReverted);
      sseService.addEventListener('host_ping_status', handleHostPingStatus);
    });
    
    // Cleanup listeners on unmount
    return () => {
      sseService.removeEventListener('host_created', handleHostCreated);
      sseService.removeEventListener('host_updated', handleHostUpdated);
      sseService.removeEventListener('host_deleted', handleHostDeleted);
      sseService.removeEventListener('host_restored', handleHostRestored);
      sseService.removeEventListener('host_reverted', handleHostReverted);
      sseService.removeEventListener('host_ping_status', handleHostPingStatus);
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
      setError(t('hosts.errors.loadFailed'));
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
        <div className="loading-message">{t('hosts.loading')}</div>
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
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 16px',
            '&:hover': {
              backgroundColor: '#0056CC',
            },
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          {t('hosts.addHost')}
        </Button>
      </div>
      
      {/* Hosts Grid */}
      <div className="appliances-grid" style={{ 
        '--card-size': cardSize ? `${Math.max(cardSize, 50)}px` : '180px' 
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
            cardSize={Math.max(cardSize || 180, 50)}
            isActive={activeCardId === host.id}
            onActivate={() => setActiveCardId(host.id)}
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
            {t('hosts.noHostsMessage')}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostsView;
