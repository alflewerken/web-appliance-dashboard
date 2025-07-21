import React from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useTabSwipe } from '../hooks/useTabSwipe';

const EnhancedSwipeableTabPanel = ({ 
  value, 
  onChange, 
  children 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Count children to determine tab count
  const tabCount = React.Children.count(children);
  
  const { 
    containerRef, 
    swipeStyle,
    isSwiping 
  } = useTabSwipe(tabCount, value, onChange, isMobile);

  if (!isMobile) {
    // Desktop: render only active tab
    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        {React.Children.toArray(children)[value]}
      </Box>
    );
  }

  // Mobile: render all tabs for smooth swiping
  return (
    <Box
      ref={containerRef}
      className="tab-swipe-container"
      sx={{
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none', // Handle touch events manually
      }}
    >
      <Box
        className={`tab-swipe-track ${isSwiping ? 'swiping' : ''}`}
        sx={{
          display: 'flex',
          height: '100%',
          transform: `translateX(-${value * 100}%)`,
          ...swipeStyle,
        }}
      >
        {React.Children.map(children, (child, index) => (
          <Box
            key={index}
            className="tab-swipe-panel"
            sx={{
              width: '100%',
              height: '100%',
              flexShrink: 0,
              overflow: 'auto',
              p: 3,
            }}
          >
            {child}
          </Box>
        ))}
      </Box>

      {/* Swipe indicators */}
      <Box className="mobile-swipe-indicators">
        {Array.from({ length: tabCount }).map((_, index) => (
          <Box
            key={index}
            className={`swipe-dot ${index === value ? 'active' : ''}`}
            onClick={() => onChange(null, index)}
          />
        ))}
      </Box>
    </Box>
  );
};

export default EnhancedSwipeableTabPanel;
