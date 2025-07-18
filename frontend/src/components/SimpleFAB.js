import React from 'react';
import { Sliders } from 'lucide-react';

const SimpleFAB = ({ cardSize, setCardSize }) => {
  const [showPanel, setShowPanel] = React.useState(false);

  return (
    <>
      {/* Simple FAB Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#007AFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 122, 255, 0.4)',
          cursor: 'pointer',
          zIndex: 9999,
          color: 'white',
        }}
        onClick={() => setShowPanel(!showPanel)}
      >
        <Sliders size={24} />
      </div>

      {/* Simple Panel */}
      {showPanel && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10000,
            }}
            onClick={() => setShowPanel(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              zIndex: 10001,
              minWidth: '300px',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#000' }}>
              Kachelgröße: {cardSize}px
            </h3>
            <input
              type="range"
              min="140"
              max="240"
              value={cardSize}
              onChange={e => setCardSize(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                color: '#666',
              }}
            >
              <span>140px</span>
              <span>240px</span>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SimpleFAB;
