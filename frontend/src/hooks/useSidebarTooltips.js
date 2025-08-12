import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const SidebarTooltip = ({ text, position }) => {
  if (!text || !position) return null;

  const style = {
    position: 'fixed',
    left: `${position.left}px`,
    top: `${position.top}px`,
    transform: 'translateY(-50%)',
    background: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    zIndex: 999999,
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  };

  // Render tooltip in document body (portal)
  return ReactDOM.createPortal(
    <div style={style}>
      {text}
      <div
        style={{
          position: 'absolute',
          left: '-8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: '6px 8px 6px 0',
          borderColor: 'transparent rgba(0, 0, 0, 0.9) transparent transparent',
        }}
      />
    </div>,
    document.body
  );
};

export const useSidebarTooltips = (isCollapsed) => {
  const [tooltip, setTooltip] = useState({ text: null, position: null });

  useEffect(() => {
    if (!isCollapsed) return;

    const handleMouseEnter = (e) => {
      const navItem = e.currentTarget;
      let tooltipText = navItem.getAttribute('data-tooltip') || navItem.getAttribute('title');
      
      // Fallback: Versuche den Text aus dem nav-text Element zu holen
      if (!tooltipText) {
        const textElement = navItem.querySelector('.nav-text');
        if (textElement) {
          tooltipText = textElement.textContent;
        }
      }
      
      if (tooltipText) {
        const rect = navItem.getBoundingClientRect();
        setTooltip({
          text: tooltipText,
          position: {
            left: rect.right + 10, // 10px rechts vom Element
            top: rect.top + rect.height / 2,
          },
        });
      }
    };

    const handleMouseLeave = () => {
      setTooltip({ text: null, position: null });
    };

    // Funktion um Event Listener zu attachieren
    const attachListeners = () => {
      const sidebar = document.querySelector('.sidebar.collapsed');
      if (!sidebar) return [];

      // Finde ALLE nav-items, inklusive benutzerdefinierte Kategorien
      // Erweitere den Selektor um alle nav-items zu erfassen
      const elements = sidebar.querySelectorAll('.nav-item, .add-btn, .settings-btn');
      
      elements.forEach((element) => {
        // Entferne erst alte Listener um Duplikate zu vermeiden
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
        // Füge neue hinzu
        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);
      });

      return elements;
    };

    // Initial attachment
    let elements = attachListeners();

    // MutationObserver für dynamisch hinzugefügte Elemente
    const observer = new MutationObserver((mutations) => {
      // Prüfe ob neue nav-items hinzugefügt wurden
      const hasRelevantChanges = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          return node.nodeType === 1 && (
            node.classList?.contains('nav-item') ||
            node.querySelector?.('.nav-item')
          );
        });
      });

      if (hasRelevantChanges) {
        // Re-attach listeners wenn neue Elemente hinzugefügt wurden
        elements = attachListeners();
      }
    });

    // Beobachte die Sidebar für Änderungen
    const sidebar = document.querySelector('.sidebar.collapsed');
    if (sidebar) {
      observer.observe(sidebar, {
        childList: true,
        subtree: true,
      });
    }

    // Cleanup
    return () => {
      observer.disconnect();
      elements.forEach((element) => {
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, [isCollapsed]);

  return <SidebarTooltip text={tooltip.text} position={tooltip.position} />;
};
