import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Grid,
  X,
  Activity,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

const AppHeader = ({
  searchTerm,
  setSearchTerm,
  cardSize,
  setCardSize,
  showOnlyWithStatus,
  setShowOnlyWithStatus,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const clearSearch = () => {
    // Debug-Log
    setSearchTerm('');
  };

  // ESC-Taste Event Listener
  useEffect(() => {
    const handleKeyDown = event => {
      // ESC-Taste gedrückt und Suchfeld hat Inhalt
      if (event.key === 'Escape' && searchTerm) {
        event.preventDefault();
        clearSearch();
        // Debug-Log
      }
    };

    // Event Listener hinzufügen
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup: Event Listener entfernen beim Unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchTerm, clearSearch]); // Dependencies auf searchTerm und clearSearch

  // Debug-Log

  // On mobile, return null - header is handled by MobileHeader component
  if (isMobile) {
    return null;
  }

  return (
    <header className="content-header">
      <div className="header-controls">
        <button
          onClick={onToggleSidebar}
          className="sidebar-toggle-button"
          title={sidebarCollapsed ? t('common.showSidebar') : t('common.hideSidebar')}
        >
          {sidebarCollapsed ? (
            <PanelLeft size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
        </button>

        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="search-clear-button"
              title={t('common.clearSearch')}
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="size-control">
          <Grid size={18} className="size-icon" />
          <input
            type="range"
            min="50"
            max="300"
            value={cardSize}
            onChange={e => setCardSize(Number(e.target.value))}
            className="size-slider"
            title={t('common.adjustTileSize')}
          />
        </div>

        <div className="status-toggle-control">
          <button
            onClick={() => setShowOnlyWithStatus(!showOnlyWithStatus)}
            className={`status-toggle-button ${showOnlyWithStatus ? 'active' : ''}`}
            title={
              showOnlyWithStatus
                ? t('common.showAllServices')
                : t('common.showOnlyServicesWithStatus')
            }
          >
            <Activity size={18} />
            <span>Status</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
