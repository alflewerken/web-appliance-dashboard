import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Search, X } from 'lucide-react';
import { getIconNames } from '../utils/lucideIconsLoader';
import SimpleIcon from './SimpleIcon';
import './IconSelector.css';

// Icon-Kategorien für bessere Organisation
const ICON_CATEGORIES = {
  Basis: [
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
  Geräte: [
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
  Kommunikation: [
    'Mail',
    'MessageCircle',
    'MessageSquare',
    'Phone',
    'PhoneCall',
    'Video',
    'Share',
    'Link',
  ],
  Dateien: [
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
  Bücher: ['BookOpen', 'Bookmark'],
  Medien: ['Music', 'Video', 'Image', 'Film', 'Youtube'],
  Produktivität: [
    'Calendar',
    'Timer',
    'Bell',
    'Calculator',
    'Search',
    'Filter',
    'Edit',
  ],
  'Smart Home': ['Thermometer', 'Lightbulb', 'Fan', 'Plug', 'Battery', 'Power'],
  Benutzerverwaltung: [
    'Users',
    'User',
    'UserPlus',
    'UserCheck',
    'UserX',
    'Crown',
    'Lock',
    'Key',
  ],
  'Charts & Trends': [
    'TrendingUp',
    'TrendingDown',
    'BarChart',
    'PieChart',
    'Target',
  ],
  Navigation: [
    'MapPin',
    'Map',
    'Compass',
    'Navigation',
    'Car',
    'Plane',
    'Train',
  ],
  'Shopping & Finanzen': [
    'ShoppingCart',
    'CreditCard',
    'Wallet',
    'DollarSign',
    'Euro',
  ],
  Werkzeuge: ['Wrench', 'Hammer', 'Paintbrush', 'Palette'],
  'Essen & Trinken': ['Coffee', 'Pizza', 'Utensils', 'Wine'],
  Wetter: [
    'Sun',
    'Moon',
    'CloudRain',
    'CloudSnow',
    'Wind',
    'Umbrella',
    'Droplets',
    'Snowflake',
  ],
  Natur: ['TreePine', 'Flower', 'Leaf', 'Fish', 'Bird'],
  Aktionen: [
    'Plus',
    'Minus',
    'X',
    'Check',
    'CheckCircle',
    'XCircle',
    'Eye',
    'EyeOff',
  ],
  Warnungen: ['AlertTriangle', 'AlertCircle', 'Info', 'HelpCircle'],
  Symbole: [
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [tempSelectedIcon, setTempSelectedIcon] = useState(currentIcon || selectedIcon);

  const allIcons = getIconNames();

  // Gefilterte Icons basierend auf Suche und Kategorie
  const filteredIcons = useMemo(() => {
    let icons = allIcons;

    // Kategorie-Filter - versuche beide Varianten (mit und ohne "Icon" suffix)
    if (selectedCategory !== 'Alle') {
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

  const categories = ['Alle', ...Object.keys(ICON_CATEGORIES)];

  return ReactDOM.createPortal(
    <div className="icon-selector-overlay" onClick={onClose}>
      <div className="icon-selector-modal" onClick={e => e.stopPropagation()}>
        <div className="icon-selector-header">
          <h3>Icon auswählen</h3>
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
              placeholder="Icon suchen..."
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
                {category}
                {category !== 'Alle' && (
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
              <p>Keine Icons gefunden</p>
              <small>
                Versuchen Sie einen anderen Suchbegriff oder eine andere
                Kategorie
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
                Ausgewählt: <strong>{tempSelectedIcon}</strong>
              </div>
            )}
            <div className="footer-buttons">
              <button className="cancel-btn" onClick={onClose}>
                Abbrechen
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
                Auswählen
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
