import React from 'react';
import { Search, X } from 'lucide-react';
import MobileSizeControlV2 from './MobileSizeControlV2';

const MobileControls = ({
  searchTerm,
  setSearchTerm,
  cardSize,
  setCardSize,
}) => {
  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <>
      {/* Suchleiste im Content-Bereich */}
      <div className="search-container-mobile">
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Suchen"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="search-clear-button"
              title="Suche löschen"
              type="button"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* FAB für Kachelgröße */}
      <MobileSizeControlV2
        cardSize={cardSize}
        setCardSize={setCardSize}
        variant="fab"
        panelPosition="center"
      />
    </>
  );
};

export default MobileControls;
