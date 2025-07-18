import React from 'react';
import { Box, Tabs, Tab, useMediaQuery, useTheme } from '@mui/material';
import {
  Home,
  Image,
  FolderOpen,
  Monitor,
  Archive,
  RefreshCw,
} from 'lucide-react';

const SwipeableSettingsTabs = ({ 
  tabs, 
  currentTab, 
  onTabChange, 
  children 
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [startX, setStartX] = React.useState(null);
  const [currentX, setCurrentX] = React.useState(null);
  const [containerRef, setContainerRef] = React.useState(null);

  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!startX) return;
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!startX || !currentX) {
      setStartX(null);
      setCurrentX(null);
      return;
    }

    const diff = startX - currentX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentTab < tabs.length - 1) {
        // Swipe left - next tab
        onTabChange(currentTab + 1);
      } else if (diff < 0 && currentTab > 0) {
        // Swipe right - previous tab
        onTabChange(currentTab - 1);
      }
    }

    setStartX(null);
    setCurrentX(null);
  };

  const offset = currentX && startX ? currentX - startX : 0;

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        value={currentTab}
        onChange={(e, newValue) => onTabChange(newValue)}
        variant={isMobile ? "scrollable" : "fullWidth"}
        scrollButtons={isMobile ? "auto" : false}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          '& .MuiTab-root': {
            color: 'var(--text-secondary)',
            '&.Mui-selected': {
              color: 'var(--text-primary)',
            },
          },
        }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.key}
            icon={tab.icon}
            label={tab.label}
            id={`settings-tab-${index}`}
            aria-controls={`settings-tabpanel-${index}`}
          />
        ))}
      </Tabs>

      <Box
        ref={setContainerRef}
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
            width: `${tabs.length * 100}%`,
            transform: `translateX(calc(-${currentTab * (100 / tabs.length)}% + ${offset}px))`,
            transition: offset === 0 ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          {React.Children.map(children, (child, index) => (
            <Box
              key={index}
              sx={{
                width: `${100 / tabs.length}%`,
                height: '100%',
                overflow: 'auto',
              }}
              role="tabpanel"
              hidden={currentTab !== index}
              id={`settings-tabpanel-${index}`}
              aria-labelledby={`settings-tab-${index}`}
            >
              {currentTab === index && child}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Swipe Indicator for mobile */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 0.5,
            padding: 1,
            pointerEvents: 'none',
          }}
        >
          {tabs.map((_, index) => (
            <Box
              key={index}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: index === currentTab ? 'primary.main' : 'rgba(255,255,255,0.3)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default SwipeableSettingsTabs;
