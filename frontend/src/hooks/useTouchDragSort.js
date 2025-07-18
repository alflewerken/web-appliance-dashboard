import { useState, useRef, useCallback, useEffect } from 'react';

export const useTouchDragSort = (items, onReorder) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [targetIndex, setTargetIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchY, setTouchY] = useState(0);
  const [initialTouchY, setInitialTouchY] = useState(0);
  const [initialTouchX, setInitialTouchX] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const containerRef = useRef(null);
  const draggedElementRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const hasMovedRef = useRef(false);
  const scrollStartRef = useRef(0);
  const isScrollingRef = useRef(false);
  const scrollPositionRef = useRef(0); // Store scroll position during drag

  // Constants for gesture detection
  const LONG_PRESS_DURATION = 400; // Increased from 300ms
  const SCROLL_THRESHOLD = 10; // Pixels before considering it a scroll
  const HORIZONTAL_SWIPE_THRESHOLD = 30; // Pixels for horizontal swipe detection

  // Calculate which item is under the touch point
  const getTargetIndex = useCallback(
    y => {
      if (!containerRef.current) return null;

      const container = containerRef.current;
      const itemElements = container.querySelectorAll('.category-item');
      const containerRect = container.getBoundingClientRect();

      // Use the stored scroll position during drag, otherwise current scroll
      const scrollTop = isDragging
        ? scrollPositionRef.current
        : container.scrollTop;
      const relativeY = y - containerRect.top + scrollTop;

      for (let i = 0; i < itemElements.length; i++) {
        const rect = itemElements[i].getBoundingClientRect();
        const itemTop = rect.top - containerRect.top + scrollTop;
        const itemBottom = itemTop + rect.height;

        if (relativeY >= itemTop && relativeY <= itemBottom) {
          return i;
        }
      }

      // If beyond last item, return last index
      if (itemElements.length > 0) {
        const lastItem = itemElements[itemElements.length - 1];
        const lastRect = lastItem.getBoundingClientRect();
        const lastBottom = lastRect.bottom - containerRect.top + scrollTop;

        if (relativeY > lastBottom) {
          return items.length;
        }
      }

      return 0;
    },
    [items.length, isDragging]
  );

  // Handle long press to start drag
  const handleTouchStart = useCallback((e, index) => {
    // Don't start drag if touching action buttons
    if (e.target.closest('.category-actions')) {
      return;
    }

    // Prevent text selection on iOS
    e.preventDefault();

    const touch = e.touches[0];
    setInitialTouchY(touch.clientY);
    setInitialTouchX(touch.clientX);
    hasMovedRef.current = false;
    isScrollingRef.current = false;

    // Store initial scroll position
    if (containerRef.current) {
      scrollStartRef.current = containerRef.current.scrollTop;
      scrollPositionRef.current = containerRef.current.scrollTop;
    }

    // Disable text selection on the entire document during potential drag
    document.body.style.webkitUserSelect = 'none';
    document.body.style.userSelect = 'none';

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      // Only start drag if we haven't moved much (not scrolling or swiping)
      if (!hasMovedRef.current && !isScrollingRef.current) {
        // Haptic feedback
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(20);
        }

        setDraggedIndex(index);
        setTargetIndex(index);
        setIsDragging(true);
        setTouchY(touch.clientY);

        // Add drag class to element
        const element = e.currentTarget;
        element.classList.add('dragging-touch');
        draggedElementRef.current = element;

        // AGGRESSIVELY prevent scrolling
        if (containerRef.current) {
          // Store scroll position
          const scrollPos = containerRef.current.scrollTop;
          scrollPositionRef.current = scrollPos;

          // Lock the container
          containerRef.current.style.overflowY = 'hidden';
          containerRef.current.style.touchAction = 'none';
          containerRef.current.style.position = 'relative';

          // Force the scroll position
          containerRef.current.scrollTop = scrollPos;

          // Add a fixed height to prevent any layout shifts
          const currentHeight = containerRef.current.offsetHeight;
          containerRef.current.style.height = `${currentHeight}px`;
        }

        // Lock the entire modal body
        const modalBody = containerRef.current?.closest('.modal-body');
        if (modalBody) {
          modalBody.style.overflow = 'hidden';
          modalBody.style.touchAction = 'none';
        }

        // Lock the settings content
        const settingsContent = containerRef.current?.closest(
          '.settings-tab-content'
        );
        if (settingsContent) {
          settingsContent.style.overflow = 'hidden';
          settingsContent.style.touchAction = 'none';
        }

        // Also prevent on the document level
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';

        // Clear any existing text selection
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      }
    }, LONG_PRESS_DURATION);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback(
    e => {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - initialTouchX);
      const deltaY = Math.abs(touch.clientY - initialTouchY);

      // If we haven't started dragging yet
      if (!isDragging) {
        // Check for horizontal swipe (tab switching)
        if (deltaX > HORIZONTAL_SWIPE_THRESHOLD && deltaX > deltaY) {
          hasMovedRef.current = true;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          return; // Let the tab swipe handler take over
        }

        // Check for vertical scroll
        if (deltaY > SCROLL_THRESHOLD) {
          isScrollingRef.current = true;
          hasMovedRef.current = true;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          return; // Let normal scrolling happen
        }

        return;
      }

      // We're dragging - MUST prevent default to stop scrolling
      e.preventDefault();
      e.stopPropagation();

      setTouchY(touch.clientY);

      // Update visual position of dragged element
      if (draggedElementRef.current) {
        const deltaY = touch.clientY - initialTouchY;
        draggedElementRef.current.style.transform = `translateY(${deltaY}px) scale(1.05)`;
        draggedElementRef.current.style.zIndex = '1000';
        draggedElementRef.current.style.opacity = '0.9';
        draggedElementRef.current.style.position = 'relative'; // Ensure position is set
      }

      // Calculate target index
      const newTargetIndex = getTargetIndex(touch.clientY);
      if (newTargetIndex !== null && newTargetIndex !== targetIndex) {
        setTargetIndex(newTargetIndex);
      }

      // REMOVED AUTO-SCROLL - it was causing the jumping
    },
    [isDragging, initialTouchY, initialTouchX, targetIndex, getTargetIndex]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    e => {
      // Clear long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Re-enable text selection
      document.body.style.webkitUserSelect = '';
      document.body.style.userSelect = '';

      // Re-enable scrolling on all elements
      if (containerRef.current) {
        containerRef.current.style.overflowY = '';
        containerRef.current.style.touchAction = '';
        containerRef.current.style.position = '';
        containerRef.current.style.height = ''; // Remove fixed height
      }

      // Unlock modal body
      const modalBody = containerRef.current?.closest('.modal-body');
      if (modalBody) {
        modalBody.style.overflow = '';
        modalBody.style.touchAction = '';
      }

      // Unlock settings content
      const settingsContent = containerRef.current?.closest(
        '.settings-tab-content'
      );
      if (settingsContent) {
        settingsContent.style.overflow = '';
        settingsContent.style.touchAction = '';
      }

      // Re-enable on document
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.body.style.position = '';
      document.body.style.width = '';

      // Re-enable on document
      document.body.style.overflow = '';
      document.body.style.touchAction = '';

      if (!isDragging || draggedIndex === null) return;

      e.preventDefault();

      // Reset dragged element style with animation
      if (draggedElementRef.current) {
        draggedElementRef.current.style.transition =
          'transform 0.3s ease, opacity 0.3s ease';
        draggedElementRef.current.style.transform = '';
        draggedElementRef.current.style.zIndex = '';
        draggedElementRef.current.style.opacity = '';

        // Remove classes after animation
        setTimeout(() => {
          if (draggedElementRef.current) {
            draggedElementRef.current.classList.remove('dragging-touch');
            draggedElementRef.current.style.transition = '';
          }
        }, 300);
      }

      // Perform reorder if needed
      if (targetIndex !== null && targetIndex !== draggedIndex && onReorder) {
        const newItems = [...items];
        const [removed] = newItems.splice(draggedIndex, 1);

        // Adjust target index if necessary
        let adjustedTargetIndex = targetIndex;
        if (targetIndex > draggedIndex) {
          adjustedTargetIndex--;
        }

        newItems.splice(adjustedTargetIndex, 0, removed);
        onReorder(newItems);

        // Haptic feedback on drop
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(10);
        }
      }

      // Reset state
      setDraggedIndex(null);
      setTargetIndex(null);
      setIsDragging(false);
      draggedElementRef.current = null;
      isScrollingRef.current = false;
    },
    [isDragging, draggedIndex, targetIndex, items, onReorder]
  );

  // Handle touch cancel (e.g., when another app takes over)
  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Re-enable text selection
    document.body.style.webkitUserSelect = '';
    document.body.style.userSelect = '';

    // Re-enable scrolling on all elements
    if (containerRef.current) {
      containerRef.current.style.overflowY = '';
      containerRef.current.style.touchAction = '';
      containerRef.current.style.position = '';
      containerRef.current.style.height = '';
    }

    // Unlock modal body
    const modalBody = containerRef.current?.closest('.modal-body');
    if (modalBody) {
      modalBody.style.overflow = '';
      modalBody.style.touchAction = '';
    }

    // Unlock settings content
    const settingsContent = containerRef.current?.closest(
      '.settings-tab-content'
    );
    if (settingsContent) {
      settingsContent.style.overflow = '';
      settingsContent.style.touchAction = '';
    }

    // Re-enable on document
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.width = '';

    // Re-enable on document
    document.body.style.overflow = '';
    document.body.style.touchAction = '';

    if (draggedElementRef.current) {
      draggedElementRef.current.style.transform = '';
      draggedElementRef.current.style.zIndex = '';
      draggedElementRef.current.style.opacity = '';
      draggedElementRef.current.classList.remove('dragging-touch');
    }

    setDraggedIndex(null);
    setTargetIndex(null);
    setIsDragging(false);
    draggedElementRef.current = null;
  }, []);

  // Effect to handle document-level touch move when dragging
  useEffect(() => {
    if (!isDragging) return;

    let rafId;
    const handleDocumentTouchMove = e => {
      // Prevent scrolling when dragging
      e.preventDefault();
    };

    // Continuously lock scroll position using RAF
    const lockScroll = () => {
      if (containerRef.current && scrollPositionRef.current !== undefined) {
        containerRef.current.scrollTop = scrollPositionRef.current;
      }
      rafId = requestAnimationFrame(lockScroll);
    };

    // Start the RAF loop
    rafId = requestAnimationFrame(lockScroll);

    // Add passive: false to allow preventDefault
    document.addEventListener('touchmove', handleDocumentTouchMove, {
      passive: false,
    });

    // Also prevent wheel events
    const handleWheel = e => {
      e.preventDefault();
    };
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('touchmove', handleDocumentTouchMove);
      document.removeEventListener('wheel', handleWheel);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isDragging]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      // Ensure we reset body styles on unmount
      document.body.style.webkitUserSelect = '';
      document.body.style.userSelect = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    },
    []
  );

  return {
    containerRef,
    draggedIndex,
    targetIndex,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
};

export default useTouchDragSort;
