import { useState, useEffect, useCallback, useRef } from 'react';

export const useInternalSwipeableTabs = (tabCount, currentTab, onTabChange, isMobile) => {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const handleTouchStart = useCallback((e) => {
    if (!isMobile) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(false);
  }, [isMobile]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile || !touchStart) return;
    setTouchEnd(e.targetTouches[0].clientX);
    
    // Detect if user is swiping horizontally
    const distance = Math.abs(touchStart - e.targetTouches[0].clientX);
    if (distance > 10) {
      setIsSwiping(true);
    }
  }, [isMobile, touchStart]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !touchStart || !touchEnd) {
      setTouchStart(null);
      setTouchEnd(null);
      setIsSwiping(false);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentTab < tabCount - 1) {
      // Swipe left - next tab
      onTabChange(null, currentTab + 1);
    } else if (isRightSwipe && currentTab > 0) {
      // Swipe right - previous tab
      onTabChange(null, currentTab - 1);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsSwiping(false);
  }, [isMobile, touchStart, touchEnd, currentTab, tabCount, onTabChange]);

  // Add swipe indicators
  const getSwipeStyle = useCallback(() => {
    if (!isSwiping || !touchStart || !touchEnd) return {};
    
    const currentX = touchEnd - touchStart;
    return {
      transform: `translateX(${currentX * 0.3}px)`,
      transition: 'none',
    };
  }, [isSwiping, touchStart, touchEnd]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    // Prevent default scrolling when swiping
    const preventScroll = (e) => {
      if (isSwiping) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventScroll, { passive: false });
    
    return () => {
      container.removeEventListener('touchmove', preventScroll);
    };
  }, [isSwiping, isMobile]);

  return {
    containerRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getSwipeStyle,
    isSwiping,
  };
};
