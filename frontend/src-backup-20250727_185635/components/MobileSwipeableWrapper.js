import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import '../styles/mobile-swipeable-panels.css';

const MobileSwipeableWrapper = ({ 
  children, 
  panels, 
  onClose,
  isMobile 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const contentRef = useRef(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  // Get active panels
  const activePanels = panels.filter(p => p.isOpen);

  // Update index when panels change
  useEffect(() => {
    // If current panel closes, go to previous
    if (currentIndex >= activePanels.length && activePanels.length > 0) {
      setCurrentIndex(activePanels.length - 1);
    }
  }, [activePanels.length, currentIndex]);

  // Add class to body
  useEffect(() => {
    if (isMobile && activePanels.length > 0) {
      document.body.classList.add('has-swipeable-panels');
      return () => {
        document.body.classList.remove('has-swipeable-panels');
      };
    }
  }, [isMobile, activePanels.length]);

  // Only render on mobile with active panels
  if (!isMobile || activePanels.length === 0) {
    return children;
  }

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < activePanels.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleTabClick = (index) => {
    setCurrentIndex(index);
  };

  return (
    <>
      {/* Render regular panels for desktop */}
      {children}
      
      {/* Mobile swipeable wrapper */}
      <div className="mobile-swipeable-wrapper">
        <div className="swipeable-panels-container">
          {/* Header */}
          <div className="swipeable-panels-header">
            <div className="panel-tabs">
              {activePanels.map((panel, index) => (
                <div
                  key={panel.key}
                  className={`panel-tab ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => handleTabClick(index)}
                >
                  {panel.title}
                </div>
              ))}
            </div>
            <button className="swipeable-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Swipeable content */}
          <div 
            className="swipeable-panels-content"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            ref={contentRef}
          >
            <div 
              className="swipeable-panels-track"
              style={{
                transform: `translateX(-${currentIndex * 100}%)`
              }}
            >
              {activePanels.map((panel, index) => (
                <div key={panel.key} className="swipeable-panel-slot">
                  {panel.component}
                </div>
              ))}
            </div>

            {/* Indicators */}
            <div className="swipe-indicators">
              {activePanels.map((_, index) => (
                <div
                  key={index}
                  className={`swipe-indicator ${index === currentIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileSwipeableWrapper;