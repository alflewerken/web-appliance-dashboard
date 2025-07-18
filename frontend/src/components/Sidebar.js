/**
 * Sidebar Component
 *
 * Navigation sidebar with service categories, counts, add button, and settings.
 * Displays different categories and their respective service counts.
 *
 * @author Web Appliance Dashboard
 * @version 1.0.0
 */

import React from 'react';
import { Plus, Settings, LogOut } from 'lucide-react';
import { SERVICE_CATEGORIES, UI_TEXT } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';

/**
 * Sidebar - Navigation component with categories and actions
 *
 * @param {Object} props - Component props
 * @param {Array} props.appliances - All appliances for counting
 * @param {string} props.selectedCategory - Currently selected category
 * @param {Function} props.onCategorySelect - Callback when category is selected
 * @param {Function} props.onAddService - Callback when add button is clicked
 * @param {Function} props.onSettingsClick - Callback when settings button is clicked
 * @returns {JSX.Element} The rendered sidebar component
 */
const Sidebar = ({
  appliances,
  selectedCategory,
  onCategorySelect,
  onAddService,
  onSettingsClick,
}) => {
  const { user, logout } = useAuth();

  /**
   * Convert hex color to RGB values
   */
  const hexToRgb = hex => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    return `${r}, ${g}, ${b}`;
  };

  /**
   * Calculate count for each category
   */
  const getCategoryCount = categoryId => {
    switch (categoryId) {
      case 'all':
        return appliances.length;
      case 'favorites':
        return appliances.filter(app => app.isFavorite).length;
      case 'recent':
        return appliances.filter(app => app.lastUsed).length;
      default:
        return appliances.filter(app => app.category === categoryId).length;
    }
  };

  /**
   * Handle category click
   */
  const handleCategoryClick = categoryId => {
    onCategorySelect(categoryId);

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      }
  };

  /**
   * Handle add service button click
   */
  const handleAddClick = () => {
    onAddService();

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      }
  };

  /**
   * Handle settings button click
   */
  const handleSettingsClick = () => {
    onSettingsClick?.();

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      }
  };

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="library-header">
          <h2>{UI_TEXT.MY_SERVICES}</h2>
          <div className="header-actions">
            <button
              className="settings-btn"
              onClick={handleSettingsClick}
              title="Einstellungen"
              aria-label="Einstellungen öffnen"
            >
              <Settings size={20} />
            </button>
            <button
              className="add-btn"
              onClick={handleAddClick}
              title={UI_TEXT.ADD_SERVICE}
              aria-label={UI_TEXT.ADD_SERVICE}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          {SERVICE_CATEGORIES.map(category => {
            const IconComponent = category.icon;
            const count = getCategoryCount(category.id);
            const isActive = selectedCategory === category.id;

            const categoryColor = category.color || '#007AFF';
            const categoryRgb = hexToRgb(categoryColor);

            return (
              <div
                key={category.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                data-category={category.id}
                onClick={() => handleCategoryClick(category.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCategoryClick(category.id);
                  }
                }}
                aria-label={`${category.name} (${count} Services)`}
                style={{
                  '--category-color': categoryColor,
                  '--category-rgb': categoryRgb,
                }}
              >
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

        {/* Auth Section - Always show when user is logged in */}
        {user && (
          <div className="nav-section auth-section">
            <div className="nav-divider"></div>
            <div
              className="nav-item logout-item"
              onClick={logout}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  logout();
                }
              }}
              aria-label="Abmelden"
            >
              <LogOut size={20} />
              <span className="nav-text">Abmelden</span>
              <span className="nav-user">{user.username}</span>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
