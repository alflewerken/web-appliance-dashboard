import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { IconButton, Tooltip } from '@mui/material';
import { MoreVertical, Star, Play, XCircle, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SimpleIcon from '../SimpleIcon';
import RemoteDesktopButton from './RemoteDesktopButton';
import FileTransferButton from './FileTransferButton';
import TerminalButton from './TerminalButton';
import ConfirmDialog from '../ConfirmDialog';
import proxyService from '../../services/proxyService';

import { iconMap } from '../../utils/iconMap';
import './ApplianceCard.css'; /* EINZIGE CSS-DATEI - Alles konsolidiert */

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
  const { t } = useTranslation();
  // Stelle sicher, dass vncEnabled/rdpEnabled korrekt gesetzt sind
  const enhancedAppliance = {
    ...appliance,
    vncEnabled: appliance.vncEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'vnc'),
    rdpEnabled: appliance.rdpEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'rdp'),
    rustdeskEnabled: appliance.rustdeskEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteDesktopType === 'rustdesk'),
    // Ensure remoteDesktopType is included for RemoteDesktopButton
    remoteDesktopType: appliance.remoteDesktopType,
    rustdeskInstalled: appliance.rustdeskInstalled,
    rustdeskId: appliance.rustdeskId
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
  
  // Compact mode bar tooltips
  const [compactTooltip, setCompactTooltip] = useState({ show: false, text: '', position: '' });

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

    } else {
      // Interne URL oder Service - verwende Proxy
      // convertToProxyUrl fügt bereits den Token hinzu, wenn es eine interne URL ist
      targetUrl = proxyService.convertToProxyUrl(appliance);

    }

    // The onOpen callback from useAppliances will handle updating lastUsed and creating audit log
    if (onOpen) {

      // Let the parent handle the opening
      onOpen(appliance);
      return; // Don't open URL here, let parent handle it
    }

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
        '.action-button, .action-btn, .edit-menu-toggle, .flip-btn, .service-actions, .settings-btn-icon, .service-controls-bottom, .file-transfer-button, .remote-desktop-btn, .MuiIconButton-root, .card-buttons-left, .card-buttons-right'
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

    // If we're saving, ignore all clicks
    if (isSavingSettings) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // If touch was already handled, ignore click
    if (touchHandled) {

      setTouchHandled(false);
      return;
    }

    // Prevent click if clicking on interactive elements
    if (
      e.target.closest(
        '.action-button, .action-btn, .edit-menu-toggle, .flip-btn, .service-actions, .settings-btn-icon, .service-controls-bottom, .file-transfer-button, .remote-desktop-btn, .remote-desktop-button, .remote-desktop-button-wrapper, .MuiIconButton-root, .card-buttons-left, .card-buttons-right'
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
    if (!isMobile && !isIPad) return; // Für mobile Geräte UND iPads

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

    // Global event handler to reset all cards when another is touched
    const handleGlobalTouch = e => {
      const touchedCard = e.target.closest('.appliance-card-container');
      
      if (touchedCard && touchedCard !== cardContainerRef.current) {
        // Another card was touched - hide our buttons
        setHasBeenTouched(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('touchstart', handleGlobalTouch);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchstart', handleGlobalTouch);
    };
  }, [isMobile, isIPad]);

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
    if (!appliance.sshConnection || isProcessing) return;

    // Auf Mobile: Direkte Ausführung ohne Dialog
    if (isMobile || isTouchDevice) {
      setIsProcessing(true);
      try {
        await onServiceAction(appliance, action);
      } catch (error) {
        console.error('Service action error:', error);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Zeige den Confirm Dialog
    setConfirmDialog({
      isOpen: true,
      action: action,
      title: action === 'start' ? t('services.startService') + '?' : t('services.stopService') + '?',
      message: action === 'start' 
        ? t('services.confirmStart')
        : t('services.confirmStop')
    });
  };

  const handleConfirmServiceAction = async () => {
    const action = confirmDialog.action;

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
            className={`card-side card-front ${hasBeenTouched ? 'mobile-tap-hint' : ''} ${
              appliance.isFavorite ? 'is-favorite' : ''
            } ${
              appliance.serviceStatus && appliance.serviceStatus === 'stopped' ? 'service-stopped' : ''
            } ${
              appliance.remoteDesktopEnabled ? 'has-remote' : ''
            } ${
              appliance.sshEnabled && appliance.targetPath ? 'has-file-transfer' : ''
            }`}
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
              
              {/* Kompakt-Modus: Minimierte Button-Balken (nur bei kleinen Karten < 90px) */}
              {/* Zeige Balken nur bei Hover (Desktop) oder nach Touch (Mobile) */}
              {cardSize < 90 && (isTouchDevice ? hasBeenTouched : true) && (
                <>
                  {/* Linke Seite - Service Controls als vertikale Balken */}
                  {adminMode && (
                    <div 
                      className="compact-bars-left"
                      style={{ 
                        position: 'absolute', 
                        left: '8px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '4px', 
                        zIndex: 20, // Höher als andere Elemente
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        pointerEvents: 'auto', // Explizit klickbar machen
                      }}
                    >
                      {/* Edit Button als Balken */}
                      <Tooltip title={t('services.editService')} placement="right" arrow enterDelay={0} disableInteractive={false}>
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEditClick(e);
                          }}
                          style={{
                            width: '4px',
                            height: '20px',
                            background: 'rgba(255, 255, 255, 0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderRadius: '2px',
                            pointerEvents: 'auto',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.width = '8px';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.width = '4px';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                          }}
                        />
                      </Tooltip>
                      
                      {/* Start Button als grüner Balken (wenn SSH vorhanden) */}
                      {appliance.sshConnection && appliance.startCommand && (
                        <Tooltip title={t('services.startService')} placement="right" arrow enterDelay={0} disableInteractive={false}>
                          <div 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isProcessing) {
                                handleServiceAction('start');
                              }
                            }}
                            style={{
                              width: '4px',
                              height: '20px',
                              background: 'rgba(76, 175, 80, 0.7)',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              opacity: isProcessing ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                              borderRadius: '2px',
                              pointerEvents: 'auto',
                            }}
                            onMouseEnter={e => {
                              if (!isProcessing) {
                                e.currentTarget.style.width = '8px';
                                e.currentTarget.style.background = 'rgba(76, 175, 80, 1)';
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.width = '4px';
                              e.currentTarget.style.background = 'rgba(76, 175, 80, 0.7)';
                            }}
                          />
                        </Tooltip>
                      )}
                      
                      {/* Stop Button als roter Balken (wenn SSH vorhanden) */}
                      {appliance.sshConnection && appliance.stopCommand && (
                        <Tooltip title={t('services.stopService')} placement="right" arrow enterDelay={0} disableInteractive={false}>
                          <div 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isProcessing) {
                                handleServiceAction('stop');
                              }
                            }}
                            style={{
                              width: '4px',
                              height: '20px',
                              background: 'rgba(244, 67, 54, 0.7)',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              opacity: isProcessing ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                              borderRadius: '2px',
                              pointerEvents: 'auto',
                            }}
                            onMouseEnter={e => {
                              if (!isProcessing) {
                                e.currentTarget.style.width = '8px';
                                e.currentTarget.style.background = 'rgba(244, 67, 54, 1)';
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.width = '4px';
                              e.currentTarget.style.background = 'rgba(244, 67, 54, 0.7)';
                            }}
                          />
                        </Tooltip>
                      )}
                    </div>
                  )}
                  
                  {/* Rechte Seite - Andere Funktionen als vertikale Balken */}
                  <div 
                    className="compact-bars-right"
                    style={{ 
                      position: 'absolute', 
                      right: '8px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px', 
                      zIndex: 20, // Höher als andere Elemente
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                      pointerEvents: 'auto', // Explizit klickbar machen
                    }}
                  >
                    {/* Favorit Button als goldener Balken */}
                    <Tooltip title={appliance.isFavorite ? t('services.removeFromFavorites') : t('services.addToFavorites')} placement="left" arrow enterDelay={0} disableInteractive={false}>
                      <div 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFavoriteClick(e);
                        }}
                        style={{
                          width: '4px',
                          height: '20px',
                          background: appliance.isFavorite ? 'rgba(255, 215, 0, 0.9)' : 'rgba(255, 255, 255, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderRadius: '2px',
                          pointerEvents: 'auto',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.width = '8px';
                          e.currentTarget.style.background = appliance.isFavorite ? 'rgba(255, 215, 0, 1)' : 'rgba(255, 255, 255, 0.6)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.width = '4px';
                          e.currentTarget.style.background = appliance.isFavorite ? 'rgba(255, 215, 0, 0.9)' : 'rgba(255, 255, 255, 0.3)';
                        }}
                      />
                    </Tooltip>
                    
                    {/* Terminal Button als grauer Balken (wenn SSH vorhanden) */}
                    {adminMode && appliance.sshConnection && (
                      <Tooltip title={t('services.openTerminal')} placement="left" arrow enterDelay={0} disableInteractive={false}>
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onOpenTerminal) {
                              onOpenTerminal(appliance);
                            }
                          }}
                          style={{
                            width: '4px',
                            height: '20px',
                            background: 'rgba(156, 163, 175, 0.7)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderRadius: '2px',
                            pointerEvents: 'auto',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.width = '8px';
                            e.currentTarget.style.background = 'rgba(156, 163, 175, 1)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.width = '4px';
                            e.currentTarget.style.background = 'rgba(156, 163, 175, 0.7)';
                          }}
                        />
                      </Tooltip>
                    )}
                    
                    {/* Remote Desktop Button als blauer Balken */}
                    {appliance.remoteDesktopEnabled && (
                      <Tooltip title={t('services.remoteDesktop')} placement="left" arrow enterDelay={0} disableInteractive={false}>
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Remote Desktop Logik hier

                          }}
                          style={{
                            width: '4px',
                            height: '20px',
                            background: 'rgba(33, 150, 243, 0.7)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderRadius: '2px',
                            pointerEvents: 'auto',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.width = '8px';
                            e.currentTarget.style.background = 'rgba(33, 150, 243, 1)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.width = '4px';
                            e.currentTarget.style.background = 'rgba(33, 150, 243, 0.7)';
                          }}
                        />
                      </Tooltip>
                    )}
                    
                    {/* File Transfer Button als lila Balken */}
                    {appliance.sshEnabled && appliance.targetPath && (
                      <Tooltip title={t('services.fileTransfer')} placement="left" arrow enterDelay={0} disableInteractive={false}>
                        <div 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // File Transfer Logik hier

                          }}
                          style={{
                            width: '4px',
                            height: '20px',
                            background: 'rgba(147, 51, 234, 0.7)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderRadius: '2px',
                            pointerEvents: 'auto',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.width = '8px';
                            e.currentTarget.style.background = 'rgba(147, 51, 234, 1)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.width = '4px';
                            e.currentTarget.style.background = 'rgba(147, 51, 234, 0.7)';
                          }}
                        />
                      </Tooltip>
                    )}
                  </div>
                </>
              )}

              {/* Left Button Column - Service Controls */}
              {(isTouchDevice ? hasBeenTouched : true) && adminMode && (
                <div className="card-buttons-left">
                  <Tooltip title={t('services.editService')}>
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
                      <Tooltip title={t('services.startService')}>
                        <IconButton
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleServiceAction('start');
                          }}
                          onTouchEnd={e => {
                            // Spezielle Touch-Behandlung für Mobile
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
                      <Tooltip title={t('services.stopService')}>
                        <IconButton
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleServiceAction('stop');
                          }}
                          onTouchEnd={e => {
                            // Spezielle Touch-Behandlung für Mobile
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
                  <Tooltip title={appliance.isFavorite ? t('services.removeFromFavorites') : t('services.addToFavorites')}>
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
                    <TerminalButton 
                      appliance={appliance}
                      onClick={onOpenTerminal}
                    />
                  )}
                  {/* Remote Desktop Button */}
                  {appliance.remoteDesktopEnabled && (
                    (() => {
                      return (
                        <RemoteDesktopButton 
                          appliance={enhancedAppliance} 
                          onUpdate={(updatedAppliance) => {
                            // Update the appliance data when RustDesk is installed
                            if (onUpdate) {
                              onUpdate(updatedAppliance);
                            }
                          }}
                        />
                      );
                    })()
                  )}
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
                        return '#34C759'; // Grün - Service läuft
                      case 'stopped':
                      case 'offline':
                        return '#FF3B30'; // Rot - Service ist gestoppt/offline
                      case 'error':
                        return '#FF9500'; // Gelb/Orange - Service hat Probleme
                      case 'unknown':
                      default:
                        return '#FF3B30'; // Rot als Default (sicherer)
                    }
                  })(),
                  borderRadius: '0 0 16px 16px',
                  transition: 'background-color 0.3s ease',
                  zIndex: 10,
                }}
                title={(() => {
                  let statusText = t('services.unknown');
                  switch (appliance.serviceStatus) {
                    case 'running':
                      statusText = 'Service läuft';
                      break;
                    case 'stopped':
                      statusText = 'Service gestoppt';
                      break;
                    case 'error':
                      statusText = 'Service fehlerhaft';
                      break;
                    case 'offline':
                      statusText = 'Service nicht erreichbar';
                      break;
                    case 'unknown':
                    default:
                      statusText = 'Status unbekannt';
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
