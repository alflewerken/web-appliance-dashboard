import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { IconButton, Tooltip } from '@mui/material';
import { MoreVertical, Star, Play, XCircle, Terminal } from 'lucide-react';
import SimpleIcon from './SimpleIcon';
import RemoteDesktopButton from './RemoteDesktopButton';
import FileTransferButton from './FileTransferButton';
import ConfirmDialog from './ConfirmDialog';
import proxyService from '../services/proxyService';

import { iconMap } from '../utils/iconMap';
import './ApplianceCard.css';
import './ApplianceCard.mobile.css';
import './MobileButtonFix.css';
import './UnifiedButtonLayout.css';
import './ButtonLayoutOverrides.css';
import './ServiceControls.css';
import './ServiceControlsFix.css';

const ApplianceCard = ({
  appliance,
  onToggleFavorite = () => {},
  onEdit = () => {},
  onFavorite = () => {},
  onServiceAction = () => {},
  onOpen,
  onOpenTerminal,
  onUpdateSettings,
  adminMode,
  cardSize,
}) => {
  // Stelle sicher, dass vncEnabled/rdpEnabled korrekt gesetzt sind
  const enhancedAppliance = {
    ...appliance,
    vncEnabled: appliance.vncEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'vnc'),
    rdpEnabled: appliance.rdpEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'rdp')
  };
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [doubleTapTimer, setDoubleTapTimer] = useState(null);
  const [transparency, setTransparency] = useState(
    appliance.transparency ?? 0.85
  );
  const [blurAmount, setBlurAmount] = useState(appliance.blur ?? 8);
  
  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    action: null,
    title: '',
    message: ''
  });

  // Touch state
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [touchHandled, setTouchHandled] = useState(false);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);

  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Live preview values
  const [liveName, setLiveName] = useState(appliance.name || '');
  const [liveDescription, setLiveDescription] = useState(
    appliance.description || ''
  );
  const [liveIcon, setLiveIcon] = useState(appliance.icon || 'Server');
  const [liveColor, setLiveColor] = useState(appliance.color || '#007AFF');

  const cardContainerRef = useRef(null);

  // Extract RGB values from color for glassmorphism effect
  const hexToRgb = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '59, 130, 246'; // Default blue
  };

  const cardColor = appliance.color || '#3b82f6';
  const cardRgb = hexToRgb(cardColor);

  // Touch support detection
  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // iOS/iPad detection using modern approach
  const isIOS =
    /iPhone|iPod/.test(navigator.userAgent) ||
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isIPad =
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Mobile device detection
  const isMobile =
    isTouchDevice &&
    (window.innerWidth <= 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ));

  // Update live values when appliance changes
  useEffect(() => {
    setTransparency(appliance.transparency ?? 0.85);
    setBlurAmount(appliance.blur ?? 8);
    setLiveColor(appliance.color || '#007AFF');
    setLiveName(appliance.name || '');
    setLiveDescription(appliance.description || '');
    setLiveIcon(appliance.icon || 'Server');
  }, [
    appliance.transparency,
    appliance.blur,
    appliance.color,
    appliance.name,
    appliance.description,
    appliance.icon,
  ]);

  // Combined icon name resolver
  const iconName = useMemo(() => {
    const currentIcon = appliance.icon;

    // 1. If appliance has a specific icon set, use it directly (unless it's the default)
    if (currentIcon && currentIcon !== 'Server') {
      return currentIcon;
    }

    // 2. Check iconMap for name mapping (only if no specific icon is set)
    const mappedIcon = iconMap[appliance.name];
    if (mappedIcon) {
      return mappedIcon;
    }

    // 3. Check iconMap for URL domain
    if (appliance.url) {
      try {
        const url = new URL(appliance.url);
        const domain = url.hostname.replace(/^www\./, '');
        const domainIcon = iconMap[domain];
        if (domainIcon) {
          return domainIcon;
        }
      } catch (e) {
        // Invalid URL, continue with fallback
      }
    }

    // 4. Try to use the appliance name as icon
    if (appliance.name) {
      return appliance.name;
    }

    // 5. Default icon
    return 'Server';
  }, [appliance.icon, appliance.name]);

  // Smart link handling
  const getDisplayUrl = () => {
    if (!appliance.url) return '';
    try {
      const url = new URL(appliance.url);
      // Special handling for local services
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return url.port ? `localhost:${url.port}` : 'localhost';
      }
      // For regular URLs, show clean domain
      return url.hostname.replace(/^www\./, '');
    } catch {
      return appliance.url;
    }
  };

  const openService = async e => {
    console.log('[DEBUG] openService called in ApplianceCard for:', appliance.name, 'v4-external-check'); // Version marker UPDATED
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prüfe ob es eine externe URL ist
    const isExternalUrl = (url) => {
      if (!url) return false;
      return url.startsWith('http://') || url.startsWith('https://');
    };

    let targetUrl;
    
    if (isExternalUrl(appliance.url)) {
      // Externe URL - direkt öffnen ohne Proxy
      targetUrl = appliance.url;
      console.log('[DEBUG] Opening external URL directly:', targetUrl);
    } else {
      // Interne URL oder Service - verwende Proxy
      // convertToProxyUrl fügt bereits den Token hinzu, wenn es eine interne URL ist
      targetUrl = proxyService.convertToProxyUrl(appliance);
      
      console.log('[DEBUG] Using proxy URL:', targetUrl);
    }

    // The onOpen callback from useAppliances will handle updating lastUsed and creating audit log
    if (onOpen) {
      console.log('[DEBUG] onOpen callback exists, delegating to parent');
      // Let the parent handle the opening
      onOpen(appliance);
      return; // Don't open URL here, let parent handle it
    }

    console.log('[DEBUG] No onOpen callback, opening URL directly from ApplianceCard');

    // Only open URL if no onOpen callback is provided
    // Determine the correct open mode based on device type
    let openMode = 'browser_tab'; // default

    // Check if in mini dashboard mode
    const isMiniDashboard =
      document.querySelector('.music-app.mini-dashboard') !== null;
    if (isMiniDashboard) {
      openMode = appliance.openModeMini || 'browser_tab';
    } else if (isTouchDevice || isMobile) {
      openMode = appliance.openModeMobile || 'browser_tab';
    } else {
      openMode = appliance.openModeDesktop || 'browser_tab';
    }

    switch (openMode) {
      case 'browser_window':
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        break;
      case 'safari_pwa':
        // PWA mode - add minimal UI
        window.open(targetUrl, '_blank', 'noopener,noreferrer,minimal-ui');
        break;
      case 'browser_tab':
      default:
        window.open(targetUrl, '_blank');
        break;
    }
  };

  const handleTouchStart = e => {
    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = e => {
    // Prevent scrolling while touching the card
    e.preventDefault();
  };

  const handleCardTouch = e => {
    // If we're saving, ignore all touches
    if (isSavingSettings) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Prevent if clicking on interactive elements
    if (
      e.target.closest(
        '.action-button, .action-btn, .edit-menu-toggle, .flip-btn, .service-actions, .settings-btn-icon, .service-controls-bottom, .file-transfer-button, .remote-desktop-btn'
      )
    ) {
      return;
    }

    // Check if this was a swipe or a tap
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // If the touch moved more than 10 pixels, consider it a swipe and ignore
    if (deltaX > 10 || deltaY > 10) {
      return;
    }

    // Mobile double-tap detection
    if (doubleTapTimer) {
      // Second tap detected
      clearTimeout(doubleTapTimer);
      setDoubleTapTimer(null);
      // Open URL on double tap
      openService(e);
      setTouchHandled(true);
    } else {
      // First tap - set timer and toggle buttons
      setHasBeenTouched(true);
      const timer = setTimeout(() => {
        setDoubleTapTimer(null);
      }, 300);
      setDoubleTapTimer(timer);
    }
  };

  const handleCardClick = e => {
    console.log('[DEBUG] handleCardClick called for:', appliance.name, 'isMobile:', isMobile);
    
    // If we're saving, ignore all clicks
    if (isSavingSettings) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // If touch was already handled, ignore click
    if (touchHandled) {
      console.log('[DEBUG] Click ignored - touch already handled');
      setTouchHandled(false);
      return;
    }

    // Prevent click if clicking on interactive elements
    if (
      e.target.closest(
        '.action-button, .action-btn, .edit-menu-toggle, .flip-btn, .service-actions, .settings-btn-icon, .service-controls-bottom, .file-transfer-button, .remote-desktop-btn'
      )
    ) {
      return;
    }

    // For desktop, open service directly on click
    if (!isMobile) {
      openService(e);
    }
  };

  // Handle touch outside the card
  useEffect(() => {
    if (!isMobile) return; // Nur für mobile Geräte

    const handleOutsideClick = e => {
      // Check if clicking on another card
      const clickedCard = e.target.closest('.appliance-card-container');

      if (clickedCard && clickedCard !== cardContainerRef.current) {
        // Clicked on another card - reset this card's state
        setHasBeenTouched(false);
      } else if (!cardContainerRef.current?.contains(e.target)) {
        // Clicked outside all cards
        setHasBeenTouched(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isMobile]);

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (doubleTapTimer) {
        clearTimeout(doubleTapTimer);
      }
    },
    [doubleTapTimer]
  );

  const handleServiceAction = async action => {
    console.log('[DEBUG] handleServiceAction called:', action, 'for', appliance?.name, 'at', new Date().toISOString());
    
    if (!appliance.sshConnection || isProcessing) return;

    // Zeige den Confirm Dialog
    setConfirmDialog({
      isOpen: true,
      action: action,
      title: action === 'start' ? 'Service starten?' : 'Service stoppen?',
      message: action === 'start' 
        ? `Möchten Sie den Service wirklich starten?`
        : `Möchten Sie den Service wirklich stoppen? Dies kann laufende Prozesse unterbrechen.`
    });
  };

  const handleConfirmServiceAction = async () => {
    const action = confirmDialog.action;
    console.log('[DEBUG] handleConfirmServiceAction:', action, 'for', appliance?.name, 'at', new Date().toISOString());
    
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    
    setIsProcessing(true);

    try {
      // Simply call the action and let the parent handle the output
      await onServiceAction(appliance, action);
    } catch (error) {
      console.error('Service action error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditClick = e => {
    e.preventDefault();
    e.stopPropagation();
    // Direkt den Bearbeitungsdialog öffnen
    onEdit(appliance);
  };

  const handleFavoriteClick = e => {
    e.preventDefault();
    e.stopPropagation();
    onFavorite(appliance);
  };

  // Tooltip handlers
  const handleMouseEnter = e => {
    // Only show tooltip in mini dashboard mode
    const isMiniDashboard =
      document.querySelector('.music-app.mini-dashboard') !== null;
    if (isMiniDashboard) {
      const rect = e.currentTarget.getBoundingClientRect();
      // Position tooltip at mouse cursor position instead of card position
      setTooltipPosition({
        x: e.clientX,
        y: e.clientY - 10, // Small offset above cursor
      });
      setShowTooltip(true);
    }
  };

  const handleMouseMove = e => {
    if (showTooltip) {
      // Update tooltip position to follow mouse
      setTooltipPosition({
        x: e.clientX,
        y: e.clientY - 10,
      });
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <>
      {/* Tooltip for mini dashboard */}
      {showTooltip &&
        ReactDOM.createPortal(
          <div
            className="card-tooltip"
            style={{
              position: 'fixed',
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              zIndex: 10000,
              pointerEvents: 'none',
              marginTop: '-20px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {appliance.name}
          </div>,
          document.body
        )}

      <div
        className={`appliance-card-container ${isMobile ? 'mobile-card' : 'desktop-card'}`}
        ref={cardContainerRef}
        style={{ '--card-size': `${cardSize}px` }}
      >
        <div className="appliance-card">
          {/* Front Side */}
          <div
            className={`card-side card-front ${hasBeenTouched ? 'mobile-tap-hint' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleCardTouch}
            onClick={handleCardClick}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              '--card-bg-color': cardColor,
              '--card-rgb': cardRgb,
              '--card-transparency': transparency || 0.85,
              '--card-blur': `${blurAmount || 8}px`,
              backgroundColor: `rgba(${cardRgb}, ${transparency || 0.85})`,
              backdropFilter: `blur(${blurAmount || 8}px)`,
              WebkitBackdropFilter: `blur(${blurAmount || 8}px)`,
              cursor: 'pointer',
            }}
          >
            {/* Card Cover with Icon */}
            <div className="card-cover">
              {/* Main Icon */}
              <div className="card-icon">
                <SimpleIcon name={iconName} size="100%" />
              </div>

              {/* Left Button Column - Service Controls */}
              {(isTouchDevice ? hasBeenTouched : true) && adminMode && (
                <div className="card-buttons-left">
                  <Tooltip title="Service bearbeiten">
                    <IconButton
                      onClick={handleEditClick}
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
                      <MoreVertical size={16} />
                    </IconButton>
                  </Tooltip>
                  {appliance.sshConnection && (
                    <>
                      <Tooltip title="Service starten">
                        <IconButton
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleServiceAction('start');
                          }}
                          disabled={isProcessing || !appliance.startCommand}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(76, 175, 80, 0.3)',
                            border: '1px solid rgba(76, 175, 80, 0.5)',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'rgba(76, 175, 80, 0.5)',
                            },
                            '&:disabled': {
                              opacity: 0.5,
                            },
                            width: 28,
                            height: 28,
                            padding: 0,
                          }}
                        >
                          <Play size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Service stoppen">
                        <IconButton
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleServiceAction('stop');
                          }}
                          disabled={isProcessing || !appliance.stopCommand}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(244, 67, 54, 0.3)',
                            border: '1px solid rgba(244, 67, 54, 0.5)',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'rgba(244, 67, 54, 0.5)',
                            },
                            '&:disabled': {
                              opacity: 0.5,
                            },
                            width: 28,
                            height: 28,
                            padding: 0,
                          }}
                        >
                          <XCircle size={16} />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </div>
              )}

              {/* Right Button Column - Other Functions */}
              {(isTouchDevice ? hasBeenTouched : true) && (
                <div className="card-buttons-right">
                  <Tooltip title={appliance.isFavorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}>
                    <IconButton
                      onClick={handleFavoriteClick}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: appliance.isFavorite ? '#FFD700' : 'white',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        },
                        width: 28,
                        height: 28,
                        padding: 0,
                      }}
                    >
                      <Star
                        size={16}
                        fill={appliance.isFavorite ? 'currentColor' : 'none'}
                      />
                    </IconButton>
                  </Tooltip>
                  {adminMode && appliance.sshConnection && (
                    <Tooltip title="Terminal öffnen">
                      <IconButton
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpenTerminal(appliance);
                        }}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(156, 39, 176, 0.3)',
                          border: '1px solid rgba(156, 39, 176, 0.5)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'rgba(156, 39, 176, 0.5)',
                          },
                          width: 28,
                          height: 28,
                          padding: 0,
                        }}
                      >
                        <Terminal size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {/* Remote Desktop Button */}
                  <RemoteDesktopButton appliance={enhancedAppliance} />
                  {/* File Transfer Button */}
                  <FileTransferButton appliance={enhancedAppliance} />
                </div>
              )}
              
              {/* Service Controls Bottom - Removed, buttons are now in card-buttons-right */}
            </div>

            {/* Card Info */}
            <div className="card-info">
              <h3 className="card-title">{appliance.name}</h3>
              <p className="card-description">
                {appliance.description || appliance.url}
              </p>
            </div>

            {/* Service Status Bar - Moved outside card-info for mini-dashboard visibility */}
            {appliance.statusCommand && (
              <div
                className="service-status-bar"
                key={`status-${appliance.id}-${appliance.serviceStatus}-${appliance.lastStatusUpdate || ''}`}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: (() => {
                    switch (appliance.serviceStatus) {
                      case 'running':
                        return '#34C759';
                      case 'stopped':
                        return '#FF3B30';
                      case 'error':
                        return '#FF9500';
                      case 'offline':
                        return '#8E8E93';
                      default:
                        return '#FFD60A';
                    }
                  })(),
                  borderRadius: '0 0 16px 16px',
                  transition: 'background-color 0.3s ease',
                  zIndex: 10,
                }}
                title={(() => {
                  let statusText = 'unbekannt';
                  switch (appliance.serviceStatus) {
                    case 'running':
                      statusText = 'aktiv';
                      break;
                    case 'stopped':
                      statusText = 'gestoppt';
                      break;
                    case 'error':
                      statusText = 'fehlerhaft';
                      break;
                    case 'offline':
                      statusText = 'nicht erreichbar';
                      break;
                  }
                  return `Service ist ${statusText} (Zuletzt geprüft: ${new Date().toLocaleTimeString()})`;
                })()}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmServiceAction}
        title={confirmDialog.title}
        message={confirmDialog.message}
        action={confirmDialog.action}
        serviceName={appliance.name}
      />
      
    </>
  );
};

export default ApplianceCard;
