import React from 'react';
import { Box } from '@mui/material';
import { useSwipeableViews } from '../hooks/useSwipeableViews';
import '../styles/SwipeableTabs.css';

export const SwipeableTabPanel = ({ children, value, index, ...other }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`swipeable-tabpanel-${index}`}
      aria-labelledby={`swipeable-tab-${index}`}
      sx={{
        height: '100%',
        overflow: 'auto',
        p: 3,
      }}
      {...other}
    >
      {value === index && children}
    </Box>
  );
};

export const SwipeableTabContainer = ({ children, currentTab, onTabChange, tabCount }) => {
  const { containerRef, isSwiping, swipeOffset } = useSwipeableViews(
    currentTab,
    onTabChange,
    tabCount
  );

  return (
    <Box
      ref={containerRef}
      className="swipeable-tabs-container"
      sx={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: `translateX(calc(-${currentTab * 100}% + ${swipeOffset}px))`,
          width: `${tabCount * 100}%`,
          height: '100%',
        }}
      >
        {React.Children.map(children, (child, index) => (
          <Box sx={{ width: `${100 / tabCount}%`, height: '100%', overflow: 'auto' }}>
            {React.cloneElement(child, { value: currentTab, index })}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
