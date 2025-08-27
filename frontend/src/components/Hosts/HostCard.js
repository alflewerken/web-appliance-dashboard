import React, { useState, useCallback, useEffect } from 'react';
import { Settings, Monitor, Terminal, Upload } from 'lucide-react';
import { IconButton, Tooltip } from '@mui/material';
import SimpleIcon from '../SimpleIcon';
import sseService from '../../services/sseService';
import '../Appliances/ApplianceCard.css';
import './HostCard.css';

const HostCard = ({
  host,
  onEdit,
  onTerminal,
  onRemoteDesktop,
  onFileTransfer,
  onShowAuditLog,
  isAdmin,
  cardSize,
  isActive,
  onActivate,
}) => {
  // Touch detection state
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Ping status state
  const [pingStatus, setPingStatus] = useState(host.pingStatus || 'unknown');
  const [responseTime, setResponseTime] = useState(host.pingResponseTime || null);

  // Subscribe to SSE events for this host
  useEffect(() => {
    const handlePingStatus = (data) => {
      if (data.id === host.id) {
        setPingStatus(data.status);
        setResponseTime(data.responseTime);
      }
    };

    // Connect and subscribe to ping status events
    sseService.connect().then(() => {
      sseService.addEventListener('host_ping_status', handlePingStatus);
    });

    return () => {
      sseService.removeEventListener('host_ping_status', handlePingStatus);
    };
  }, [host.id]);

  useEffect(() => {
    // Detect if device supports touch
    const checkTouch = () => {
      const hasTouch = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0 ||
        window.matchMedia('(hover: none)').matches
      );
      setIsTouchDevice(hasTouch);
    };

    checkTouch();
    window.addEventListener('resize', checkTouch);
    
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const handleCardTouch = useCallback((e) => {
    // Don't handle touch if clicking on a button
    if (e.target.closest('button') || e.target.closest('[role="button"]')) {
      return;
    }
    
    if (isTouchDevice && !isActive && onActivate) {
      e.stopPropagation();
      onActivate();
    }
  }, [isTouchDevice, isActive, onActivate]);

  const handleEdit = (event) => {
    event.stopPropagation();
    // Direkt das Host-Panel öffnen
    onEdit(host);
  };
  
  const cardColor = host.color || '#007AFF';
  const transparency = host.transparency || 0.15; // Default to 15% transparency = 85% opacity
  const blurAmount = host.blur || 8;
  
  // transparency value in database is actually opacity (0 = transparent, 1 = opaque)
  // So we use it directly as the alpha value
  const opacity = transparency;
  
  // Convert hex to RGB for better transparency support
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 122, 255';
  };
  
  const cardRgb = hexToRgb(cardColor);

  return (
    <div 
      className="appliance-card-container"
      style={{ '--card-size': `${cardSize || 180}px` }}
      onClick={handleCardTouch}
    >
      <div className="appliance-card">
        {/* Front Side */}
        <div 
          className="card-side card-front"
          style={{
            '--card-bg-color': cardColor,
            '--card-rgb': cardRgb,
            '--card-transparency': opacity,
            '--card-blur': `${blurAmount}px`,
            backgroundColor: `rgba(${cardRgb}, ${opacity})`,
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
            cursor: 'pointer',
          }}
        >
          {/* Card Cover with Icon */}
          <div className="card-cover">
            {/* Main Icon */}
            <div className="card-icon">
              <SimpleIcon 
                name={host.icon || 'Server'} 
                size="100%" 
              />
            </div>
            
            {/* Left Button Column - Edit Button */}
            {(!isTouchDevice || isActive) && (
              <div 
                className="card-buttons-left"
              >
                <Tooltip title="Host bearbeiten">
                  <IconButton
                    onClick={handleEdit}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      },
                      width: 28,
                      height: 28,
                      padding: 0,
                    }}
                  >
                    <Settings size={16} />
                  </IconButton>
                </Tooltip>
              </div>
            )}
            
            {/* Right Button Column - Action Buttons */}
            {(!isTouchDevice || isActive) && (
              <div 
                className="card-buttons-right"
              >
                <Tooltip title="Terminal">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onTerminal(host);
                    }}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      },
                      width: 28,
                      height: 28,
                      padding: 0,
                    }}
                  >
                    <Terminal size={16} />
                  </IconButton>
                </Tooltip>
                
                {/* Only show Remote Desktop button if enabled */}
                {(host.remoteDesktopEnabled) && (
                  <Tooltip title="Remote Desktop">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[HostCard] Remote Desktop clicked for host:', host);
                        if (onRemoteDesktop) {
                          onRemoteDesktop(host);
                        } else {
                          console.error('[HostCard] onRemoteDesktop function not provided!');
                        }
                      }}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        },
                        width: 28,
                        height: 28,
                        padding: 0,
                      }}
                    >
                      <Monitor size={16} />
                    </IconButton>
                  </Tooltip>
                )}
                
                <Tooltip title="Datei übertragen">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileTransfer(host);
                    }}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      },
                      width: 28,
                      height: 28,
                      padding: 0,
                    }}
                  >
                    <Upload size={16} />
                  </IconButton>
                </Tooltip>
              </div>
            )}
          </div>
          
          {/* Title with dark background */}
          <div className="card-info-overlay">
            <h3 className="card-title">{host.name || 'Unnamed Host'}</h3>
            {host.description && (
              <p className="card-description" style={{ 
                fontSize: '0.75em', 
                margin: '4px 0 0 0',
                opacity: 0.8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {host.description}
              </p>
            )}
          </div>
          
          {/* Ping Status Bar */}
          {(pingStatus !== 'unknown' || responseTime !== null) && (
            <div
              className="host-ping-status-bar"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                backgroundColor: (() => {
                  if (pingStatus === 'offline') return '#FF3B30'; // Rot - Host offline
                  if (responseTime === null) return '#8E8E93'; // Grau - Unbekannt
                  if (responseTime < 50) return '#34C759'; // Grün - Exzellent
                  if (responseTime < 150) return '#FFCC00'; // Gelb - Gut
                  if (responseTime < 500) return '#FF9500'; // Orange - Fair
                  return '#FF3B30'; // Rot - Schlecht
                })(),
                borderRadius: '0 0 16px 16px',
                transition: 'background-color 0.3s ease',
                zIndex: 10,
              }}
              title={responseTime !== null ? `Ping: ${responseTime}ms` : 'Host offline'}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default HostCard;
