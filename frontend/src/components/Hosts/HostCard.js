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
        navigator.msMaxTouchPoints > 0
      );
      
      // iOS specific detection
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      
      // Check if device also has hover capability (tablets with stylus/mouse)
      const hasHover = window.matchMedia('(hover: hover)').matches;
      
      // Treat iOS devices always as touch-only
      // OR treat as touch-only if it has touch AND no hover
      const isTouchOnly = isIOS || (hasTouch && !hasHover);
      
      setIsTouchDevice(isTouchOnly);
      
      // Debug logging für iOS
      if (isIOS) {
        console.log('[HostCard] iOS detected - Touch mode enabled');
        console.log('[HostCard] hasTouch:', hasTouch, 'hasHover:', hasHover);
      }
    };

    checkTouch();
    window.addEventListener('resize', checkTouch);
    
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // State für Touch-Aktivierung
  const [wasTouched, setWasTouched] = useState(false);
  
  // Reset wasTouched when card becomes inactive, set it when active on touch devices
  useEffect(() => {
    if (!isActive) {
      setWasTouched(false);
    } else if (isTouchDevice) {
      // Auf Touch-Geräten: Wenn aktiv, dann automatisch touched setzen
      setWasTouched(true);
      console.log(`[HostCard ${host.name}] Active on touch device - buttons should be visible`);
    }
  }, [isActive, isTouchDevice, host.name]);
  
  const handleCardTouch = useCallback((e) => {
    // Don't handle touch if clicking on a button
    if (e.target.closest('button') || e.target.closest('[role="button"]')) {
      return;
    }
    
    // Auf Touch-Geräten: Aktiviere die Karte beim ersten Touch
    if (isTouchDevice) {
      e.preventDefault(); // Verhindere Standard-Touch-Verhalten
      e.stopPropagation();
      
      // Setze touched state
      setWasTouched(true);
      
      // Aktiviere die Karte
      if (!isActive && onActivate) {
        onActivate();
      }
    }
  }, [isTouchDevice, isActive, onActivate]);

  const handleEdit = (event) => {
    event.stopPropagation();
    // Nur ausführen wenn Karte aktiv oder kein Touch-Device
    if (!isTouchDevice || isActive || wasTouched) {
      onEdit(host);
    }
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
  
  // Debug: Log button visibility state
  useEffect(() => {
    if (isTouchDevice) {
      console.log(`[HostCard ${host.name}] Button visibility:`, {
        isTouchDevice,
        isActive,
        wasTouched,
        shouldShowButtons: !isTouchDevice || isActive || wasTouched,
        className: (isTouchDevice && !isActive && !wasTouched) ? 'hidden-buttons' : 'visible-buttons'
      });
    }
  }, [isTouchDevice, isActive, wasTouched, host.name]);

  return (
    <div 
      className="appliance-card-container"
      style={{ '--card-size': `${cardSize || 180}px` }}
      onClick={handleCardTouch}
      onTouchStart={(e) => {
        // Zusätzlicher Touch-Handler für bessere Mobile-Unterstützung
        if (isTouchDevice) {
          // Prüfe ob nicht auf Button getippt wurde
          if (!e.target.closest('button') && !e.target.closest('[role="button"]')) {
            setWasTouched(true);
            if (!isActive && onActivate) {
              onActivate();
            }
          }
        }
      }}
    >
      <div className="appliance-card">
        {/* Front Side */}
        <div 
          className={`card-side card-front ${isActive ? 'active-card' : ''}`}
          style={{
            '--card-bg-color': cardColor,
            '--card-rgb': cardRgb,
            '--card-transparency': opacity,
            '--card-blur': `${blurAmount}px`,
            backgroundColor: `rgba(${cardRgb}, ${opacity})`,
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
            cursor: 'pointer',
            border: isActive ? '2px solid rgba(255, 255, 255, 0.5)' : 'none',
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
            {/* Show buttons based on touch state and active state - Desktop relies on CSS hover */}
            <div 
              className={`card-buttons-left ${(isTouchDevice && !isActive && !wasTouched) ? 'hidden-buttons' : ''}`}
              style={{
                pointerEvents: (isTouchDevice && !isActive && !wasTouched) ? 'none' : 'auto'
              }}
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
            
            {/* Right Button Column - Action Buttons */}
            <div 
              className={`card-buttons-right ${(isTouchDevice && !isActive && !wasTouched) ? 'hidden-buttons' : ''}`}
              style={{
                pointerEvents: (isTouchDevice && !isActive && !wasTouched) ? 'none' : 'auto'
              }}
            >
                <Tooltip title="Terminal">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      // Nur ausführen wenn Karte aktiv oder kein Touch-Device
                      if (!isTouchDevice || isActive || wasTouched) {
                        onTerminal(host);
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
                    <Terminal size={16} />
                  </IconButton>
                </Tooltip>
                
                {/* Only show Remote Desktop button if enabled */}
                {(host.remoteDesktopEnabled) && (
                  <Tooltip title="Remote Desktop">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        // Nur ausführen wenn Karte aktiv oder kein Touch-Device
                        if (!isTouchDevice || isActive || wasTouched) {
                          if (onRemoteDesktop) {
                            onRemoteDesktop(host);
                          } else {
                            console.error('[HostCard] onRemoteDesktop function not provided!');
                          }
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
                      // Nur ausführen wenn Karte aktiv oder kein Touch-Device
                      if (!isTouchDevice || isActive || wasTouched) {
                        onFileTransfer(host);
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
                    <Upload size={16} />
                  </IconButton>
                </Tooltip>
              </div>
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
