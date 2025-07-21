import React, { useState, useEffect } from 'react';
import { Box, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MobileTabSwipeHelper = ({ 
  currentTab, 
  tabCount, 
  onTabChange,
  isMobile 
}) => {
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    if (showHint) {
      const timer = setTimeout(() => setShowHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showHint]);

  if (!isMobile) return null;

  const handlePrevious = () => {
    if (currentTab > 0) {
      onTabChange(null, currentTab - 1);
    }
  };

  const handleNext = () => {
    if (currentTab < tabCount - 1) {
      onTabChange(null, currentTab + 1);
    }
  };

  return (
    <>
      {/* Navigation buttons */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          px: 2,
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        <IconButton
          onClick={handlePrevious}
          disabled={currentTab === 0}
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            pointerEvents: 'auto',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            },
            '&.Mui-disabled': {
              opacity: 0.3,
            },
          }}
        >
          <ChevronLeft />
        </IconButton>

        <IconButton
          onClick={handleNext}
          disabled={currentTab === tabCount - 1}
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            pointerEvents: 'auto',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            },
            '&.Mui-disabled': {
              opacity: 0.3,
            },
          }}
        >
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Swipe hint */}
      {showHint && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 20,
            fontSize: 12,
            zIndex: 101,
            animation: 'fadeInOut 3s ease-in-out',
            '@keyframes fadeInOut': {
              '0%': { opacity: 0 },
              '20%': { opacity: 1 },
              '80%': { opacity: 1 },
              '100%': { opacity: 0 },
            },
          }}
        >
          Nutzen Sie die Pfeile oder wischen Sie für weitere Tabs
        </Box>
      )}

      {/* Tab indicators */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 0.5,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          px: 1.5,
          py: 0.5,
          borderRadius: 20,
          zIndex: 100,
        }}
      >
        {Array.from({ length: tabCount }).map((_, index) => (
          <Box
            key={index}
            onClick={() => onTabChange(null, index)}
            sx={{
              width: index === currentTab ? 20 : 6,
              height: 6,
              borderRadius: index === currentTab ? 3 : '50%',
              backgroundColor: index === currentTab ? '#007AFF' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.3s',
              cursor: 'pointer',
            }}
          />
        ))}
      </Box>
    </>
  );
};

export default MobileTabSwipeHelper;
