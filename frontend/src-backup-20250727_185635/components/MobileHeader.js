import React from 'react';
import { Menu } from 'lucide-react';

const MobileHeader = ({ onMenuClick, title = 'Meine Services' }) => (
  <div className="mobile-header">
    <button
      className="mobile-menu-btn"
      onClick={onMenuClick}
      title="Menü öffnen"
    >
      <Menu size={24} />
    </button>
    <h1 className="mobile-title">{title}</h1>
  </div>
);

export default MobileHeader;
