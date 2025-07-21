import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';

const TabSwipeableContent = ({ 
  children, 
  value, 
  onChange,
  tabCount 
}) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const containerRef = useRef(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwiping(false);
  };

  const onTouchMove = (e) => {
    if (!touchStart) return;
    
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);
    
    // Check if horizontal swipe
    const diffX = Math.abs(touchStart - currentTouch);
    if (diffX > 10) {
      setSwiping(true);
      // Prevent vertical scroll while swiping horizontally
      e.preventDefault();
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setTouchStart(null);
      setTouchEnd(null);
      setSwiping(false);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && value < tabCount - 1) {
      onChange(null, value + 1);
    } else if (isRightSwipe && value > 0) {
      onChange(null, value - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setSwiping(false);
  };

  // Calculate offset for visual feedback
  const getOffset = () => {
    if (!swiping || !touchStart || !touchEnd) return 0;
    const diff = touchEnd - touchStart;
    // Limit offset to prevent over-swiping
    return Math.max(-100, Math.min(100, diff * 0.3));
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'pan-y pinch-zoom',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          transform: `translateX(calc(-${value * 100}% + ${getOffset()}px))`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {React.Children.map(children, (child, index) => (
          <Box
            key={index}
            sx={{
              minWidth: '100%',
              width: '100%',
              height: '100%',
              overflow: 'auto',
              // Preserve scroll position when switching tabs
              display: index === value ? 'block' : 'none',
            }}
          >
            {child}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default TabSwipeableContent;
