import React from 'react';
import {
  Plus,
  Sliders,
  X,
  Server,
  Users,
  Monitor,
  LogOut,
  FileText,
} from 'lucide-react';
import { getCategoryCount } from '../utils/applianceUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSidebarTooltips } from '../hooks/useSidebarTooltips';
import './Sidebar.css';

const AppSidebar = ({
  allCategories,
  selectedCategory,
  setSelectedCategory,
  appliances,
  onAddService,
  setShowSettingsModal,
  setShowUserManagement,
  setShowHostsView,
  setShowAuditLog,
  showSettingsModal = false,
  showUserManagement = false,
  showHostsView = false,
  showAuditLog = false,
  isOpen = true,
  onClose,
  isMobile = false,
  isCollapsed = false,
}) => {
  const { user, isAdmin, logout } = useAuth();
  const authEnabled = true; // Auth ist immer aktiviert in dieser Version
  
  // Tooltip Hook für collapsed sidebar
  const tooltipElement = useSidebarTooltips(isCollapsed);

  /**
   * Convert hex color to RGB values
   */
  const hexToRgb = hex => {
    if (!hex) return '0, 122, 255'; // Fallback zu Blau

    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `${r}, ${g}, ${b}`;
  };

  // Style-Tag für dynamische Farben generieren
  const generateDynamicStyles = () => {
    if (!Array.isArray(allCategories)) {
      console.error(
        'generateDynamicStyles: allCategories is not an array:',
        allCategories
      );
      return '';
    }
    const styles = allCategories
      .map(category => {
        const color = category.color || '#007AFF';
        const rgb = hexToRgb(color);

        return `
        .nav-item[data-category="${category.id}"].active {
          background: rgba(${rgb}, 0.15) !important;
        }
        .nav-item[data-category="${category.id}"].active .nav-item-indicator {
          background-color: ${color} !important;
        }
      `;
      })
      .join('\n');

    // Zusätzliche Styles für Settings/Users/Audit
    const additionalStyles = `
      .nav-item[data-category="users"].active {
        background: rgba(0, 122, 255, 0.15) !important;
      }
      .nav-item[data-category="users"].active .nav-item-indicator {
        background-color: #007AFF !important;
      }
      .nav-item[data-category="hosts"].active {
        background: rgba(0, 122, 255, 0.15) !important;
      }
      .nav-item[data-category="hosts"].active .nav-item-indicator {
        background-color: #007AFF !important;
      }
      .nav-item[data-category="settings"].active {
        background: rgba(0, 122, 255, 0.15) !important;
      }
      .nav-item[data-category="settings"].active .nav-item-indicator {
        background-color: #007AFF !important;
      }
      .nav-item[data-category="audit"].active {
        background: rgba(0, 122, 255, 0.15) !important;
      }
      .nav-item[data-category="audit"].active .nav-item-indicator {
        background-color: #007AFF !important;
      }
    `;

    return styles + additionalStyles;
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    // Deactivate hosts view when selecting a category
    if (setShowHostsView) {
      setShowHostsView(false);
    }
    // Auto-close sidebar on mobile after selection
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleAddService = () => {
    onAddService();
    // Auto-close sidebar on mobile after action
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleSettingsOpen = (e) => {
    if (e) e.stopPropagation();
    if (setShowSettingsModal) {
      setShowSettingsModal(prev => !prev);
    } else {
      console.error('setShowSettingsModal is not defined!');
    }
    // Auto-close sidebar on mobile after action
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleUserManagementOpen = (e) => {
    if (e) e.stopPropagation();
    setShowUserManagement(prev => !prev);
    // Auto-close sidebar on mobile after action
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleHostsViewOpen = (e) => {
    if (e) e.stopPropagation();
    setShowHostsView(prev => !prev);
    // Auto-close sidebar on mobile after action
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleAuditLogOpen = (e) => {
    if (e) e.stopPropagation();
    setShowAuditLog(prev => !prev);
    // Auto-close sidebar on mobile after action
    if (isMobile && onClose) {
      onClose();
    }
  };

  // On mobile, render the mobile sidebar conditionally
  if (isMobile) {
    return (
      <>
        {/* Dynamic Styles */}
        <style dangerouslySetInnerHTML={{ __html: generateDynamicStyles() }} />

        {/* Mobile Overlay - always render but conditionally visible */}
        {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

        {/* Mobile Sidebar - always render but conditionally positioned */}
        <aside
          className={`sidebar mobile-sidebar ${isOpen ? 'open' : 'closed'}`}
        >
          <div className="sidebar-header">
            <div className="library-header">
              <h2>Meine Services</h2>
              <div className="header-actions">
                <button
                  className="add-btn"
                  onClick={handleAddService}
                  title="Service hinzufügen"
                >
                  <Plus size={20} />
                </button>
                <button
                  className="close-btn"
                  onClick={onClose}
                  title="Sidebar schließen"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">
              {Array.isArray(allCategories) &&
                allCategories.map(category => {
                  // Icon ist bereits eine React-Komponente von getAllCategories
                  const IconComponent =
                    category.icon &&
                    (typeof category.icon === 'function' ||
                      typeof category.icon === 'object')
                      ? category.icon
                      : Server;

                  const count = getCategoryCount(category.id, appliances);
                  // Nimm die Farbe direkt vom Icon-Container Style, falls category.color nicht definiert ist
                  const iconContainerColor = category.color || '#007AFF';
                  const categoryColor = iconContainerColor;
                  const categoryRgb = hexToRgb(categoryColor);

                  // Debug nur für Monitoring
                  if (category.id === 'monitoring') {
                    }

                  return (
                    <div
                      key={category.id}
                      className={`nav-item ${selectedCategory === category.id ? 'active' : ''}`}
                      data-category={category.id}
                      data-tooltip={category.name}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      {selectedCategory === category.id && (
                        <div className="nav-item-indicator" />
                      )}
                      <div
                        className="nav-icon-container"
                        data-category={category.id}
                        style={{ backgroundColor: categoryColor }}
                      >
                        <IconComponent size={20} />
                      </div>
                      <span className="nav-text">{category.name}</span>
                      <span className="nav-count">{count}</span>
                    </div>
                  );
                })}
            </div>

            {/* Settings Button - with extra margin for scrolling */}
            <div
              className="nav-section"
              style={{
                marginTop: '24px',
                borderTop: '1px solid #2c2c2e',
                paddingTop: '16px',
                paddingBottom: '40px', // Extra padding am Ende
              }}
            >
              {/* Hosts Button */}
              <div
                className={`nav-item ${showHostsView ? 'active' : ''}`}
                onClick={handleHostsViewOpen}
                title="Hosts verwalten"
                data-tooltip="Hosts"
                data-category="hosts"
              >
                {showHostsView && <div className="nav-item-indicator" />}
                <div className="nav-icon-container" data-category="hosts">
                  <Monitor size={20} />
                </div>
                <span className="nav-text">Hosts</span>
              </div>
              {authEnabled && (
                <div
                  className={`nav-item ${showUserManagement ? 'active' : ''}`}
                  onClick={handleUserManagementOpen}
                  title="Benutzerverwaltung"
                  data-tooltip="Benutzer"
                  data-category="users"
                >
                  {showUserManagement && <div className="nav-item-indicator" />}
                  <div className="nav-icon-container" data-category="users">
                    <Users size={20} />
                  </div>
                  <span className="nav-text">Benutzer</span>
                </div>
              )}
              <div
                className={`nav-item ${showSettingsModal ? 'active' : ''}`}
                onClick={handleSettingsOpen}
                title="Einstellungen"
                data-tooltip="Einstellungen"
                data-category="settings"
              >
                {showSettingsModal && <div className="nav-item-indicator" />}
                <div className="nav-icon-container" data-category="settings">
                  <Sliders size={20} />
                </div>
                <span className="nav-text">Einstellungen</span>
              </div>
              {authEnabled && isAdmin && (
                <div
                  className={`nav-item ${showAuditLog ? 'active' : ''}`}
                  onClick={handleAuditLogOpen}
                  title="Audit Log"
                  data-tooltip="Audit Log"
                  data-category="audit"
                >
                  {showAuditLog && <div className="nav-item-indicator" />}
                  <div className="nav-icon-container" data-category="audit">
                    <FileText size={20} />
                  </div>
                  <span className="nav-text">Audit Log</span>
                </div>
              )}

              {/* Logout Button */}
              {user && (
                <div
                  className="nav-item logout-item"
                  onClick={logout}
                  title="Abmelden"
                  data-tooltip="Abmelden"
                >
                  <div className="nav-icon-container" data-category="logout">
                    <LogOut size={20} />
                  </div>
                  <span className="nav-text">Abmelden</span>
                  <span className="nav-user">{user.username}</span>
                </div>
              )}
            </div>
          </nav>
        </aside>
      </>
    );
  }

  // Desktop sidebar - always visible
  return (
    <>
      {/* Dynamic Styles */}
      <style dangerouslySetInnerHTML={{ __html: generateDynamicStyles() }} />
      
      {/* Tooltip Element */}
      {tooltipElement}

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="library-header">
            <h2>Meine Services</h2>
            <div className="header-actions">
              <button
                className="add-btn"
                onClick={handleAddService}
                title="Service hinzufügen"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {Array.isArray(allCategories) &&
              allCategories.map(category => {
                // Icon ist bereits eine React-Komponente von getAllCategories
                const IconComponent =
                  category.icon &&
                  (typeof category.icon === 'function' ||
                    typeof category.icon === 'object')
                    ? category.icon
                    : Server;

                const count = getCategoryCount(category.id, appliances);
                const categoryColor = category.color || '#007AFF';
                const categoryRgb = hexToRgb(categoryColor);

                // Debug nur für Monitoring
                if (category.id === 'monitoring') {
                  }

                return (
                  <div
                    key={category.id}
                    className={`nav-item ${selectedCategory === category.id ? 'active' : ''}`}
                    data-category={category.id}
                    data-tooltip={category.name}
                    onClick={() => handleCategorySelect(category.id)}
                  >
                    {selectedCategory === category.id && (
                      <div className="nav-item-indicator" />
                    )}
                    <div
                      className="nav-icon-container"
                      data-category={category.id}
                      style={{ backgroundColor: categoryColor }}
                    >
                      <IconComponent size={20} />
                    </div>
                    <span className="nav-text">{category.name}</span>
                    <span className="nav-count">{count}</span>
                  </div>
                );
              })}
          </div>

          {/* Settings Button */}
          <div
            className="nav-section"
            style={{
              marginTop: '24px',
              borderTop: '1px solid #2c2c2e',
              paddingTop: '16px',
            }}
          >
            {/* Hosts Button */}
            <div
              className={`nav-item ${showHostsView ? 'active' : ''}`}
              onClick={handleHostsViewOpen}
              title="Hosts verwalten"
              data-tooltip="Hosts"
              data-category="hosts"
            >
              {showHostsView && <div className="nav-item-indicator" />}
              <div className="nav-icon-container" data-category="hosts">
                <Monitor size={20} />
              </div>
              <span className="nav-text">Hosts</span>
            </div>
            {authEnabled && (
              <div
                className={`nav-item ${showUserManagement ? 'active' : ''}`}
                onClick={handleUserManagementOpen}
                title="Benutzerverwaltung"
                data-tooltip="Benutzer"
                data-category="users"
              >
                {showUserManagement && <div className="nav-item-indicator" />}
                <div className="nav-icon-container" data-category="users">
                  <Users size={20} />
                </div>
                <span className="nav-text">Benutzer</span>
              </div>
            )}
            <div
              className={`nav-item ${showSettingsModal ? 'active' : ''}`}
              onClick={handleSettingsOpen}
              title="Einstellungen"
              data-tooltip="Einstellungen"
              data-category="settings"
            >
              {showSettingsModal && <div className="nav-item-indicator" />}
              <div className="nav-icon-container" data-category="settings">
                <Sliders size={20} />
              </div>
              <span className="nav-text">Einstellungen</span>
            </div>
            {authEnabled && isAdmin && (
              <div
                className={`nav-item ${showAuditLog ? 'active' : ''}`}
                onClick={handleAuditLogOpen}
                title="Audit Log"
                data-tooltip="Audit Log"
                data-category="audit"
              >
                {showAuditLog && <div className="nav-item-indicator" />}
                <div className="nav-icon-container" data-category="audit">
                  <FileText size={20} />
                </div>
                <span className="nav-text">Audit Log</span>
              </div>
            )}

            {/* Logout Button */}
            {user && (
              <div
                className="nav-item logout-item"
                onClick={logout}
                title="Abmelden"
                data-tooltip="Abmelden"
              >
                <div className="nav-icon-container" data-category="logout">
                  <LogOut size={20} />
                </div>
                <span className="nav-text">Abmelden</span>
                <span className="nav-user">{user.username}</span>
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
};

export default AppSidebar;
