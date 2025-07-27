import { useEffect, useCallback, useRef, useState } from 'react';

export const useCategorySwipe = (
  categories,
  selectedCategory,
  setSelectedCategory
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false);
  const [isVerticalScroll, setIsVerticalScroll] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0); // For animation progress

  const containerRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const scrollPositions = useRef({});
  const initialTouchRef = useRef({ x: 0, y: 0 });
  const hasDecidedDirectionRef = useRef(false);
  const velocityRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const lastMoveXRef = useRef(0);
  const hasAutoCompletedRef = useRef(false);

  // Get current category index
  const getCurrentIndex = useCallback(
    () => categories.findIndex(cat => cat.id === selectedCategory),
    [categories, selectedCategory]
  );

  const isMobile = () => window.innerWidth <= 768;
  const isIPad = () =>
    /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Calculate the translate position based on current index
  const getTranslateForIndex = index => -index * 100; // Each category takes 100% width
  // Save scroll position before switching categories
  const saveScrollPosition = useCallback(() => {
    const currentSlide = containerRef.current?.querySelector(
      '.category-slide:nth-child(' + (getCurrentIndex() + 1) + ')'
    );
    if (currentSlide) {
      scrollPositions.current[selectedCategory] = currentSlide.scrollTop;
    }
  }, [getCurrentIndex, selectedCategory]);

  // Restore scroll position after switching categories
  const restoreScrollPosition = useCallback(() => {
    setTimeout(() => {
      const currentSlide = containerRef.current?.querySelector(
        '.category-slide:nth-child(' + (getCurrentIndex() + 1) + ')'
      );
      if (currentSlide && scrollPositions.current[selectedCategory]) {
        currentSlide.scrollTop = scrollPositions.current[selectedCategory];
      }
    }, 50);
  }, [getCurrentIndex, selectedCategory]);

  // Animate to a specific index
  const animateToIndex = useCallback(
    targetIndex => {
      if (targetIndex < 0 || targetIndex >= categories.length) return;
      if (isAnimatingRef.current) return; // Prevent multiple animations

      isAnimatingRef.current = true;

      const targetTranslate = getTranslateForIndex(targetIndex);

      // Set the target position - CSS transition will handle the animation
      setTranslateX(targetTranslate);

      // Haptic feedback on iOS when changing categories
      if (
        targetIndex !== getCurrentIndex() &&
        window.navigator &&
        window.navigator.vibrate
      ) {
        window.navigator.vibrate(10);
      }

      // Change category after animation completes
      setTimeout(() => {
        if (targetIndex !== getCurrentIndex()) {
          setSelectedCategory(categories[targetIndex].id);
        }
        isAnimatingRef.current = false;
        hasAutoCompletedRef.current = false;
        setIsDragging(false);
        setIsTransitioning(false);
      }, 400); // Match CSS transition duration
    },
    [categories, getCurrentIndex, setSelectedCategory]
  );

  // Update position when category changes
  useEffect(() => {
    if (!isMobile()) return;

    const currentIndex = getCurrentIndex();
    const targetTranslate = getTranslateForIndex(currentIndex);
    setTranslateX(targetTranslate);
    restoreScrollPosition();
  }, [selectedCategory, getCurrentIndex, restoreScrollPosition]);

  const handleTouchStart = useCallback(e => {
    if (!isMobile() || isAnimatingRef.current) return;

    const touch = e.touches[0];
    setStartX(touch.clientX);
    setStartY(touch.clientY);
    setCurrentX(touch.clientX);
    initialTouchRef.current = { x: touch.clientX, y: touch.clientY };
    hasDecidedDirectionRef.current = false;
    hasAutoCompletedRef.current = false;
    setIsHorizontalSwipe(false);
    setIsVerticalScroll(false);
    setIsDragging(false);
  }, []);

  const handleTouchMove = useCallback(
    e => {
      if (!isMobile() || isAnimatingRef.current) return;

      const touch = e.touches[0];
      const diffX = Math.abs(touch.clientX - initialTouchRef.current.x);
      const diffY = Math.abs(touch.clientY - initialTouchRef.current.y);

      // Determine swipe direction on first significant move
      if (!hasDecidedDirectionRef.current && (diffX > 5 || diffY > 5)) {
        hasDecidedDirectionRef.current = true;

        // Use a more strict angle check - 2:1 ratio
        if (diffX > diffY * 2) {
          // Definitely horizontal
          setIsHorizontalSwipe(true);
          setIsVerticalScroll(false);
          setIsDragging(true);
          saveScrollPosition();
        } else if (diffY > diffX * 1.5) {
          // Definitely vertical
          setIsVerticalScroll(true);
          setIsHorizontalSwipe(false);
          return;
        } else {
          // Diagonal or unclear - default to vertical scroll
          setIsVerticalScroll(true);
          setIsHorizontalSwipe(false);
          return;
        }
      }

      // If vertical scroll detected, don't interfere
      if (isVerticalScroll) return;

      // Only handle horizontal swipes
      if (!isHorizontalSwipe) return;

      // Prevent default to stop vertical scrolling during horizontal swipe
      e.preventDefault();
      e.stopPropagation();

      setCurrentX(touch.clientX);

      const diff = touch.clientX - startX;
      const currentIndex = getCurrentIndex();
      const baseTranslate = getTranslateForIndex(currentIndex);

      // Convert pixel difference to percentage
      const diffPercent = (diff / window.innerWidth) * 100;

      // Apply resistance at edges
      let adjustedDiff = diffPercent;
      if (
        (currentIndex === 0 && diff > 0) ||
        (currentIndex === categories.length - 1 && diff < 0)
      ) {
        adjustedDiff = diffPercent * 0.3;
      }

      // Update the visual position while dragging
      setTranslateX(baseTranslate + adjustedDiff);

      // Check if we should trigger auto-complete
      const autoCompleteThreshold = window.innerWidth * 0.25; // 25% of screen width
      if (
        Math.abs(diff) > autoCompleteThreshold &&
        !hasAutoCompletedRef.current
      ) {
        hasAutoCompletedRef.current = true;

        // Determine target index
        let targetIndex = currentIndex;
        if (diff > 0 && currentIndex > 0) {
          targetIndex = currentIndex - 1;
        } else if (diff < 0 && currentIndex < categories.length - 1) {
          targetIndex = currentIndex + 1;
        }

        // If we have a valid target, complete the animation
        if (targetIndex !== currentIndex) {
          // Enable transition for smooth animation
          setIsTransitioning(true);

          // Small delay to ensure transition is applied
          requestAnimationFrame(() => {
            animateToIndex(targetIndex);
          });
        }
      }
    },
    [
      isDragging,
      isHorizontalSwipe,
      isVerticalScroll,
      startX,
      getCurrentIndex,
      categories.length,
      saveScrollPosition,
      animateToIndex,
    ]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isMobile() || isAnimatingRef.current) return;

    // If auto-complete already triggered, just clean up
    if (hasAutoCompletedRef.current) {
      setIsDragging(false);
      setIsHorizontalSwipe(false);
      setIsVerticalScroll(false);
      hasDecidedDirectionRef.current = false;
      return;
    }

    // If we were dragging horizontally, check if we should complete the swipe
    if (isDragging && isHorizontalSwipe) {
      const diff = currentX - startX;
      const threshold = window.innerWidth * 0.15; // 15% to complete
      const currentIndex = getCurrentIndex();

      let targetIndex = currentIndex;

      // Determine if we should change category
      if (Math.abs(diff) > threshold) {
        if (diff > 0 && currentIndex > 0) {
          targetIndex = currentIndex - 1;
        } else if (diff < 0 && currentIndex < categories.length - 1) {
          targetIndex = currentIndex + 1;
        }
      }

      // Animate to target (or back to current)
      setIsTransitioning(true);
      animateToIndex(targetIndex);
    }

    // Reset all states
    setIsDragging(false);
    setIsHorizontalSwipe(false);
    setIsVerticalScroll(false);
    hasDecidedDirectionRef.current = false;
    hasAutoCompletedRef.current = false;
  }, [
    isDragging,
    isHorizontalSwipe,
    currentX,
    startX,
    getCurrentIndex,
    categories,
    animateToIndex,
  ]);

  // Mouse events for desktop testing
  const handleMouseDown = useCallback(e => {
    if (!isMobile() || isAnimatingRef.current) return;

    setStartX(e.clientX);
    setStartY(e.clientY);
    setCurrentX(e.clientX);
    initialTouchRef.current = { x: e.clientX, y: e.clientY };
    hasDecidedDirectionRef.current = false;
    hasAutoCompletedRef.current = false;
    setIsHorizontalSwipe(false);
    setIsVerticalScroll(false);
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    e => {
      if (!isMobile() || isAnimatingRef.current) return;

      const diffX = Math.abs(e.clientX - initialTouchRef.current.x);
      const diffY = Math.abs(e.clientY - initialTouchRef.current.y);

      if (!hasDecidedDirectionRef.current && (diffX > 5 || diffY > 5)) {
        hasDecidedDirectionRef.current = true;

        if (diffX > diffY * 2) {
          setIsHorizontalSwipe(true);
          setIsVerticalScroll(false);
          setIsDragging(true);
          saveScrollPosition();
        } else if (diffY > diffX * 1.5) {
          setIsVerticalScroll(true);
          setIsHorizontalSwipe(false);
          return;
        } else {
          setIsVerticalScroll(true);
          setIsHorizontalSwipe(false);
          return;
        }
      }

      if (isVerticalScroll) return;
      if (!isHorizontalSwipe) return;

      e.preventDefault();
      setCurrentX(e.clientX);

      const diff = e.clientX - startX;
      const currentIndex = getCurrentIndex();
      const baseTranslate = getTranslateForIndex(currentIndex);
      const diffPercent = (diff / window.innerWidth) * 100;

      let adjustedDiff = diffPercent;
      if (
        (currentIndex === 0 && diff > 0) ||
        (currentIndex === categories.length - 1 && diff < 0)
      ) {
        adjustedDiff = diffPercent * 0.3;
      }

      setTranslateX(baseTranslate + adjustedDiff);

      // Auto-complete for mouse
      const autoCompleteThreshold = window.innerWidth * 0.25;
      if (
        Math.abs(diff) > autoCompleteThreshold &&
        !hasAutoCompletedRef.current
      ) {
        hasAutoCompletedRef.current = true;

        let targetIndex = currentIndex;
        if (diff > 0 && currentIndex > 0) {
          targetIndex = currentIndex - 1;
        } else if (diff < 0 && currentIndex < categories.length - 1) {
          targetIndex = currentIndex + 1;
        }

        if (targetIndex !== currentIndex) {
          setIsTransitioning(true);

          requestAnimationFrame(() => {
            animateToIndex(targetIndex);
          });
        }
      }
    },
    [
      isDragging,
      isHorizontalSwipe,
      isVerticalScroll,
      startX,
      getCurrentIndex,
      categories.length,
      saveScrollPosition,
      animateToIndex,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if (!isMobile()) return;
    handleTouchEnd();
  }, [handleTouchEnd]);

  useEffect(() => {
    if (!isMobile()) return;

    const container = containerRef.current;
    if (!container) return;

    // Touch events
    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    container.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Mouse events for testing
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  ]);

  return {
    containerRef,
    translateX,
    isDragging,
    isHorizontalSwipe,
    isVerticalScroll,
    isAnimating: isAnimatingRef.current,
    isTransitioning,
    currentIndex: getCurrentIndex(),
    isMobile: isMobile(),
  };
};

export default useCategorySwipe;
