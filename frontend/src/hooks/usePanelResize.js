import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Einheitlicher Resize-Hook für alle Panels
 * Mit Delta-Berechnung um Sprünge zu vermeiden
 * 
 * @param {string} storageKey - Key für localStorage (z.B. 'settingsPanelWidth')
 * @param {number} defaultWidth - Standard-Breite
 * @param {function} onWidthChange - Optional: Callback bei Width-Änderung
 * @returns {object} - { panelWidth, isResizing, startResize, panelRef }
 */
export const usePanelResize = (storageKey, defaultWidth = 600, onWidthChange = null) => {
  // State
  const [panelWidth, setPanelWidth] = useState(() => {
    const savedWidth = localStorage.getItem(storageKey);
    return savedWidth ? parseInt(savedWidth) : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  
  // Refs für Delta-Berechnung
  const panelRef = useRef(null);
  const onWidthChangeRef = useRef(onWidthChange);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  
  // Update ref when prop changes
  useEffect(() => {
    onWidthChangeRef.current = onWidthChange;
  }, [onWidthChange]);
  
  // Setze initiale CSS-Variable für Layout-System
  useEffect(() => {
    const panelName = storageKey
      .replace('PanelWidth', '')
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
    
    document.documentElement.style.setProperty(
      `--${panelName}-panel-width`,
      `${panelWidth}px`
    );
  }, [panelWidth, storageKey]);

  // Start resize handler - für alle drei Event-Typen
  const startResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // WICHTIG: Speichere initiale Position UND Width für Delta-Berechnung
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    startXRef.current = clientX;
    startWidthRef.current = panelWidth;
    
    console.log(`[PanelResize] Started for ${storageKey}`, {
      type: e.type,
      startX: clientX,
      startWidth: panelWidth,
      windowWidth: window.innerWidth,
      handlePosition: window.innerWidth - panelWidth
    });
    
    setIsResizing(true);
  }, [storageKey, panelWidth]);

  // Resize effect mit Delta-Berechnung
  useEffect(() => {
    if (!isResizing) return;

    // DELTA-BASIERTE Move-Handler (keine Sprünge!)
    const handleMove = (clientX) => {
      // Berechne Delta von der Start-Position
      const deltaX = startXRef.current - clientX;
      
      // Neue Width = Start-Width + Delta
      // Bei Panels von rechts: nach links ziehen = größer
      const newWidth = startWidthRef.current + deltaX;
      
      const minWidth = 400;
      const maxWidth = window.innerWidth - 100;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
        
        // Force update für Safari/iPad
        if (panelRef.current) {
          panelRef.current.style.width = `${newWidth}px`;
        }
        
        if (onWidthChangeRef.current) {
          onWidthChangeRef.current(newWidth);
        }
        
        // Setze CSS-Variable für Layout-System
        const panelName = storageKey
          .replace('PanelWidth', '')
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .replace(/^-/, '');
        
        document.documentElement.style.setProperty(
          `--${panelName}-panel-width`,
          `${newWidth}px`
        );
      }
    };

    const handleMouseMove = (e) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e) => {
      // Wichtig für iPad: preventDefault verhindert Scrollen
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches && e.touches[0]) {
        const touch = e.touches[0];
        console.log(`[PanelResize Touch] Move at ${touch.clientX}`);
        handleMove(touch.clientX);
      }
    };

    const handlePointerMove = (e) => {
      handleMove(e.clientX);
    };

    // Einheitlicher End-Handler
    const handleEnd = () => {
      console.log(`[PanelResize] Ended for ${storageKey}, final width:`, panelWidth);
      setIsResizing(false);
      localStorage.setItem(storageKey, panelWidth.toString());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Event-Listener registrieren (passive: false für Touch wichtig!)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('pointerup', handleEnd);
    
    // Globale Styles während Resize
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('pointerup', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, storageKey]); // panelWidth nicht als Dependency!

  return {
    panelWidth,
    isResizing,
    startResize,
    panelRef,
    setPanelWidth // Falls manuelles Setzen nötig
  };
};

/**
 * Standard Panel-Styles für konsistentes Layout
 * WICHTIG: Width wird separat als style-Attribut gesetzt für bessere Performance
 * @param {boolean} isResizing - Ob gerade resized wird
 */
export const getPanelStyles = (isResizing) => ({
  // KEINE position, right, top, bottom hier!
  // Das macht der Container
  // KEINE width hier - wird als style-Attribut gesetzt
  height: '100%',
  backgroundColor: 'rgba(118, 118, 128, 0.12)',
  backdropFilter: 'blur(30px) saturate(150%)',
  WebkitBackdropFilter: 'blur(30px) saturate(150%)',
  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  transition: isResizing ? 'none' : 'width 0.3s ease',
  boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.5)',
  // Panel füllt seinen Container aus
  position: 'relative',
});

/**
 * Standard Resize-Handle Styles
 * Mit verbesserter Touch/iPad-Unterstützung
 */
export const getResizeHandleStyles = () => ({
  position: 'absolute',
  left: 0, // Am linken Rand des Panels
  top: 0,
  bottom: 0,
  width: '10px',
  cursor: 'ew-resize',
  backgroundColor: 'transparent',
  zIndex: 10,
  '&:hover': {
    backgroundColor: 'var(--primary-color, #007AFF)',
    opacity: 0.3,
  },
  // Touch-freundlicher Bereich für iPad/Tablets
  '@media (pointer: coarse)': {
    width: '20px', // Größerer Touch-Bereich
    left: '-10px', // Zentriert über der Kante
    '&::before': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '4px',
      height: '60px',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: '2px',
    },
  },
  // Extra großer Touch-Bereich (unsichtbar)
  '&::after': {
    content: '""',
    position: 'absolute',
    left: '-20px',
    right: '-20px',
    top: 0,
    bottom: 0,
    // Unsichtbar, aber touch-aktiv
  }
});
