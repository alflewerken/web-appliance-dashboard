import React from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useInternalSwipeableTabs } from '../hooks/useInternalSwipeableTabs';

const SwipeableTabContent = ({ 
  children, 
  value, 
  onChange,
  tabCount 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const {
    containerRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getSwipeStyle,
    isSwiping,
  } = useInternalSwipeableTabs(tabCount, value, onChange, isMobile);

  if (!isMobile) {
    // On desktop, just render children normally
    return children;
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'pan-y',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          width: `${tabCount * 100}%`,
          transform: `translateX(-${value * (100 / tabCount)}%)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          ...getSwipeStyle(),
        }}
      >
        {React.Children.map(children, (child, index) => (
          <Box
            key={index}
            sx={{
              width: `${100 / tabCount}%`,
              height: '100%',
              overflow: 'auto',
              display: value === index ? 'block' : 'none',
            }}
          >
            {child}
          </Box>
        ))}
      </Box>

      {/* Swipe indicators */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 0.5,
            padding: '4px 8px',
            borderRadius: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {Array.from({ length: tabCount }).map((_, index) => (
            <Box
              key={index}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: index === value ? '#007AFF' : 'rgba(255,255,255,0.3)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default SwipeableTabContent;
