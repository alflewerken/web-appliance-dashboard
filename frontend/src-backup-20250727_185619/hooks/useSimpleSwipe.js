import { useEffect, useCallback, useRef } from 'react';

export const useSimpleSwipe = (isOpen, onToggle) => {
  // Use useRef to persist values across renders
  const trackingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);

  const isMobile = () => window.innerWidth <= 768;

  const handleTouchStart = useCallback(e => {
    if (!isMobile()) return;

    // Ignore touches on interactive elements
    const { target } = e;
    const isInteractive =
      target.closest('input[type="range"]') ||
      target.closest('.settings-slider') ||
      target.closest('.card-back') ||
      target.closest('.card-back-content') ||
      target.closest('.settings-control') ||
      target.closest('.modal') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select');

    if (isInteractive) {
      trackingRef.current = false;
      return;
    }

    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = startXRef.current;
    currentYRef.current = startYRef.current;
    trackingRef.current = true;
  }, []);

  const handleTouchMove = useCallback(e => {
    if (!trackingRef.current || !isMobile()) return;

    // Additional check during move
    const { target } = e;
    const isInteractive =
      target.closest('input[type="range"]') ||
      target.closest('.settings-slider') ||
      target.closest('.card-back');

    if (isInteractive) {
      trackingRef.current = false;
      return;
    }

    const touch = e.touches[0];
    currentXRef.current = touch.clientX;
    currentYRef.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!trackingRef.current || !isMobile()) return;

    const deltaX = currentXRef.current - startXRef.current;
    const deltaY = currentYRef.current - startYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Only process horizontal swipes that are long enough
    if (absDeltaX > absDeltaY && absDeltaX > 80) {
      const isRightSwipe = deltaX > 0;
      const isLeftSwipe = deltaX < 0;

      // Open sidebar: swipe right from left edge when closed
      if (isRightSwipe && !isOpen && startXRef.current <= 50) {
        onToggle(true);
      }
      // Close sidebar: swipe left when open
      else if (isLeftSwipe && isOpen) {
        onToggle(false);
      }
    }

    trackingRef.current = false;
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isMobile()) return;

    const options = { passive: true, capture: true };

    document.addEventListener('touchstart', handleTouchStart, options);
    document.addEventListener('touchmove', handleTouchMove, options);
    document.addEventListener('touchend', handleTouchEnd, options);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, options);
      document.removeEventListener('touchmove', handleTouchMove, options);
      document.removeEventListener('touchend', handleTouchEnd, options);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { isMobile: isMobile() };
};

export default useSimpleSwipe;
