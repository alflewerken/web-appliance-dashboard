import { useState, useCallback, useRef, useEffect } from 'react';

export const useTabSwipe = (tabCount, currentTab, onTabChange, enabled = true) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef(null);
  const startY = useRef(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;
  const swipeThreshold = 0.3; // 30% of container width

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    setTouchStart(touch.clientX);
    startY.current = touch.clientY;
    setTouchEnd(null);
    setIsSwiping(false);
    setSwipeOffset(0);
  }, [enabled]);

  const handleTouchMove = useCallback((e) => {
    if (!enabled || touchStart === null) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart;
    const deltaY = touch.clientY - startY.current;
    
    // Determine if this is a horizontal swipe
    if (!isSwiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      setIsSwiping(true);
    }
    
    if (isSwiping) {
      e.preventDefault(); // Prevent vertical scroll
      setTouchEnd(touch.clientX);
      
      // Calculate offset with resistance at edges
      let offset = deltaX;
      if ((currentTab === 0 && deltaX > 0) || 
          (currentTab === tabCount - 1 && deltaX < 0)) {
        offset = deltaX * 0.3; // Add resistance
      }
      setSwipeOffset(offset);
    }
  }, [enabled, touchStart, isSwiping, currentTab, tabCount]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || touchStart === null || touchEnd === null) {
      resetSwipe();
      return;
    }

    const deltaX = touchEnd - touchStart;
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const swipeRatio = Math.abs(deltaX) / containerWidth;

    // Check if swipe is significant enough
    if (Math.abs(deltaX) > minSwipeDistance && swipeRatio > swipeThreshold) {
      if (deltaX > 0 && currentTab > 0) {
        // Swipe right - previous tab
        onTabChange(null, currentTab - 1);
      } else if (deltaX < 0 && currentTab < tabCount - 1) {
        // Swipe left - next tab
        onTabChange(null, currentTab + 1);
      }
    }

    resetSwipe();
  }, [enabled, touchStart, touchEnd, currentTab, tabCount, onTabChange]);

  const resetSwipe = useCallback(() => {
    setTouchStart(null);
    setTouchEnd(null);
    setIsSwiping(false);
    setSwipeOffset(0);
    startY.current = null;
  }, []);

  // Add passive event listeners for better performance
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const options = { passive: false };
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', resetSwipe, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', resetSwipe);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, resetSwipe, enabled]);

  return {
    containerRef,
    isSwiping,
    swipeOffset,
    swipeStyle: {
      transform: `translateX(${swipeOffset}px)`,
      transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
    },
  };
};
