import { useState, useEffect, useCallback } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

export const useMobileSwipeablePanels = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activePanels, setActivePanels] = useState([]);
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState(null);
  const [swipeCurrentX, setSwipeCurrentX] = useState(null);

  // Update active panels list when panels open/close
  const updateActivePanels = useCallback((panels) => {
    if (isMobile) {
      const active = panels.filter(p => p.isOpen);
      setActivePanels(active);
      
      // Set current index to the most recently opened panel
      if (active.length > 0) {
        const lastOpenedIndex = active.length - 1;
        setCurrentPanelIndex(lastOpenedIndex);
      }
    }
  }, [isMobile]);

  // Handle swipe gestures
  const handleSwipeStart = useCallback((e) => {
    if (!isMobile) return;
    
    const touch = e.touches ? e.touches[0] : e;
    setSwipeStartX(touch.clientX);
    setSwipeCurrentX(touch.clientX);
  }, [isMobile]);

  const handleSwipeMove = useCallback((e) => {
    if (!isMobile || !swipeStartX) return;
    
    const touch = e.touches ? e.touches[0] : e;
    setSwipeCurrentX(touch.clientX);
  }, [isMobile, swipeStartX]);

  const handleSwipeEnd = useCallback(() => {
    if (!isMobile || !swipeStartX || !swipeCurrentX) {
      setSwipeStartX(null);
      setSwipeCurrentX(null);
      return;
    }

    const diff = swipeStartX - swipeCurrentX;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentPanelIndex < activePanels.length - 1) {
        // Swipe left - next panel
        setCurrentPanelIndex(currentPanelIndex + 1);
      } else if (diff < 0 && currentPanelIndex > 0) {
        // Swipe right - previous panel
        setCurrentPanelIndex(currentPanelIndex - 1);
      }
    }

    setSwipeStartX(null);
    setSwipeCurrentX(null);
  }, [isMobile, swipeStartX, swipeCurrentX, currentPanelIndex, activePanels.length]);

  // Calculate swipe offset
  const getSwipeOffset = useCallback(() => {
    if (!swipeStartX || !swipeCurrentX) return 0;
    return swipeCurrentX - swipeStartX;
  }, [swipeStartX, swipeCurrentX]);

  // Navigate to specific panel
  const goToPanel = useCallback((index) => {
    if (index >= 0 && index < activePanels.length) {
      setCurrentPanelIndex(index);
    }
  }, [activePanels.length]);

  return {
    isMobile,
    activePanels,
    currentPanelIndex,
    updateActivePanels,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
    getSwipeOffset,
    goToPanel,
  };
};
