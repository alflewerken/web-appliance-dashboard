import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getIconNames } from '../utils/lucideIconsLoader';
import SimpleIcon from './SimpleIcon';
import './IconSelector.css';

// Icon-Kategorien für bessere Organisation - mit Keys die zu den Übersetzungen passen
const ICON_CATEGORIES = {
  basics: [
    'Home',
    'Server',
    'Cloud',
    'Database',
    'Monitor',
    'Activity',
    'Shield',
    'Zap',
    'Globe',
    'Box',
    'Heart',
    'Star',
    'Settings',
  ],
  devices: [
    'Smartphone',
    'Tv',
    'Camera',
    'Gamepad',
    'Headphones',
    'Printer',
    'Router',
    'Wifi',
    'Cpu',
    'HardDrive',
  ],
  communication: [
    'Mail',
    'MessageCircle',
    'MessageSquare',
    'Phone',
    'PhoneCall',
    'Video',
    'Share',
    'Link',
  ],
  files: [
    'FileText',
    'Archive',
    'Folder',
    'FolderOpen',
    'File',
    'Files',
    'Download',
    'Upload',
    'Save',
    'Copy',
  ],
  books: ['BookOpen', 'Bookmark'],
  media: ['Music', 'Video', 'Image', 'Film', 'Youtube'],
  productivity: [
    'Calendar',
    'Timer',
    'Bell',
    'Calculator',
    'Search',
    'Filter',
    'Edit',
  ],
  smartHome: ['Thermometer', 'Lightbulb', 'Fan', 'Plug', 'Battery', 'Power'],
  userManagement: [
    'Users',
    'User',
    'UserPlus',
    'UserCheck',
    'UserX',
    'Crown',
    'Lock',
    'Key',
  ],
  chartsAndTrends: [
    'TrendingUp',
    'TrendingDown',
    'BarChart',
    'PieChart',
    'Target',
  ],
  navigation: [
    'MapPin',
    'Map',
    'Compass',
    'Navigation',
    'Car',
    'Plane',
    'Train',
  ],
  shoppingFinance: [
    'ShoppingCart',
    'CreditCard',
    'Wallet',
    'DollarSign',
    'Euro',
  ],
  tools: ['Wrench', 'Hammer', 'Paintbrush', 'Palette'],
  foodDrink: ['Coffee', 'Pizza', 'Utensils', 'Wine'],
  weather: [
    'Sun',
    'Moon',
    'CloudRain',
    'CloudSnow',
    'Wind',
    'Umbrella',
    'Droplets',
    'Snowflake',
  ],
  nature: ['TreePine', 'Flower', 'Leaf', 'Fish', 'Bird'],
  actions: [
    'Plus',
    'Minus',
    'X',
    'Check',
    'CheckCircle',
    'XCircle',
    'Eye',
    'EyeOff',
  ],
  warnings: ['AlertTriangle', 'AlertCircle', 'Info', 'HelpCircle'],
  symbols: [
    'Hash',
    'AtSign',
    'Percent',
    'Slash',
    'MoreHorizontal',
    'MoreVertical',
    'Menu',
    'Grid',
  ],
};

const IconSelector = ({ currentIcon, selectedIcon, onSelect, onIconSelect, onClose }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tempSelectedIcon, setTempSelectedIcon] = useState(currentIcon || selectedIcon);

  const allIcons = getIconNames();

  // Gefilterte Icons basierend auf Suche und Kategorie
  const filteredIcons = useMemo(() => {
    let icons = allIcons;

    // Kategorie-Filter - versuche beide Varianten (mit und ohne "Icon" suffix)
    if (selectedCategory !== 'all') {
      icons = icons.filter(icon => {
        const baseIconName = icon.replace(/Icon$/, '');
        return (
          ICON_CATEGORIES[selectedCategory]?.includes(baseIconName) ||
          ICON_CATEGORIES[selectedCategory]?.includes(icon)
        );
      });
    }

    // Such-Filter
    if (searchTerm) {
      icons = icons.filter(icon =>
        icon.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return icons;
  }, [searchTerm, selectedCategory, allIcons]);

  const categories = ['all', ...Object.keys(ICON_CATEGORIES)];

  return ReactDOM.createPortal(
    <div className="icon-selector-overlay" onClick={onClose}>
      <div className="icon-selector-modal" onClick={e => e.stopPropagation()}>
        <div className="icon-selector-header">
          <h3>{t('iconSelector.title')}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="icon-selector-controls">
          {/* Suchfeld */}
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={t('common.search') + '...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Kategorie-Filter */}
          <div className="category-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {t(`iconCategories.${category}`)}
                {category !== 'all' && (
                  <span className="category-count">
                    {ICON_CATEGORIES[category]?.length || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="icon-selector-content">
          {filteredIcons.length === 0 ? (
            <div className="no-icons-found">
              <p>{t('iconSelector.noIconsFound')}</p>
              <small>
                {t('iconSelector.tryDifferentSearch')}
              </small>
            </div>
          ) : (
            <div className="icon-grid">
              {filteredIcons.map(icon => (
                <button
                  key={icon}
                  className={`icon-item ${tempSelectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setTempSelectedIcon(icon)}
                  title={icon}
                >
                  <SimpleIcon name={icon} size={24} />
                  <span className="icon-name">{icon}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="icon-selector-footer">
          <div className="footer-content">
            {tempSelectedIcon && (
              <div className="current-selection">
                {t('iconSelector.selected')}: <strong>{tempSelectedIcon}</strong>
              </div>
            )}
            <div className="footer-buttons">
              <button className="cancel-btn" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                className="select-btn"
                onClick={() => {
                  if (tempSelectedIcon) {
                    if (onSelect) {
                      onSelect(tempSelectedIcon);
                    } else if (onIconSelect) {
                      onIconSelect(tempSelectedIcon);
                    }
                    onClose();
                  }
                }}
                disabled={!tempSelectedIcon}
              >
                {t('common.select')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IconSelector;
