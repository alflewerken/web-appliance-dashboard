import React from 'react';
import { Search, X, Grid, Activity } from 'lucide-react';

const MobileSearchHeader = ({
  searchTerm,
  setSearchTerm,
  cardSize,
  setCardSize,
  showOnlyWithStatus,
  setShowOnlyWithStatus,
}) => {
  const [showSizeSlider, setShowSizeSlider] = React.useState(false);
  const sliderRef = React.useRef(null);

  // Prevent swipe gestures on slider
  React.useEffect(() => {
    const dropdown = document.querySelector('.mobile-size-dropdown');
    if (!dropdown || !showSizeSlider) return;

    const preventSwipe = e => {
      e.stopPropagation();
    };

    dropdown.addEventListener('touchstart', preventSwipe, { passive: false });
    dropdown.addEventListener('touchmove', preventSwipe, { passive: false });

    return () => {
      dropdown.removeEventListener('touchstart', preventSwipe);
      dropdown.removeEventListener('touchmove', preventSwipe);
    };
  }, [showSizeSlider]);

  return (
    <div className="mobile-search-header">
      {/* Search Field */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#8e8e93',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Suchen"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="mobile-search-input"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="search-clear-button"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(142, 142, 147, 0.6)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Size Control Button */}
      <button
        onClick={() => setShowSizeSlider(!showSizeSlider)}
        className="mobile-size-control-btn"
      >
        <Grid size={20} />
        <span>{cardSize}px</span>
      </button>

      {/* Status Toggle Button */}
      <button
        onClick={() => setShowOnlyWithStatus(!showOnlyWithStatus)}
        className={`mobile-status-toggle-btn ${showOnlyWithStatus ? 'active' : ''}`}
        title={
          showOnlyWithStatus
            ? 'Alle Services anzeigen'
            : 'Nur Services mit Status anzeigen'
        }
      >
        <Activity size={20} />
      </button>

      {/* Size Slider Dropdown */}
      {showSizeSlider && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 200,
            }}
            onClick={() => setShowSizeSlider(false)}
          />
          <div className="mobile-size-dropdown" ref={sliderRef}>
            <div
              style={{
                marginBottom: '12px',
                fontSize: '16px',
                color: '#fff',
                fontWeight: '600',
              }}
            >
              Kachelgröße: {cardSize}px
            </div>
            <input
              type="range"
              min="50"
              max="300"
              value={cardSize}
              onChange={e => setCardSize(Number(e.target.value))}
              className="mobile-size-slider"
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <span>Klein</span>
              <span>Mittel</span>
              <span>Groß</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileSearchHeader;
