import React, { useState, useRef, useEffect } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';

const MobileTabSwiper = ({ 
  children, 
  value, 
  onChange,
  tabCount 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef(null);
  
  // Minimum swipe distance
  const minSwipeDistance = 50;

  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;
    
    const handleTouchStart = (e) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
      if (!touchStart) return;
      
      const currentTouch = e.targetTouches[0].clientX;
      setTouchEnd(currentTouch);
      
      // Check if horizontal swipe
      const diffX = Math.abs(touchStart - currentTouch);
      if (diffX > 10) {
        setIsSwiping(true);
        // Prevent vertical scroll when swiping horizontally
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) {
        setTouchStart(null);
        setTouchEnd(null);
        setIsSwiping(false);
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
      setIsSwiping(false);
    };

    // Add event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, touchStart, touchEnd, value, tabCount, onChange]);

  if (!isMobile) {
    return children;
  }

  const currentOffset = isSwiping && touchStart && touchEnd 
    ? (touchEnd - touchStart) * 0.3 
    : 0;

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        touchAction: 'pan-y',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          transform: `translateX(calc(-${value * 100}% + ${currentOffset}px))`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {Array.from({ length: tabCount }).map((_, index) => (
          <Box
            key={index}
            sx={{
              width: '100%',
              height: '100%',
              flexShrink: 0,
              overflow: 'auto',
              display: value === index ? 'block' : 'none',
            }}
          >
            {children[index]}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default MobileTabSwiper;
