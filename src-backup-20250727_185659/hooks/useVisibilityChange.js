import { useEffect, useRef } from 'react';

export const useVisibilityChange = onVisible => {
  const lastVisibleTime = useRef(0);
  const isWindowOpenInProgress = useRef(false);

  useEffect(() => {
    // Track window.open calls safely
    let originalWindowOpen;
    try {
      originalWindowOpen = window.open;
      window.open = function (...args) {
        isWindowOpenInProgress.current = true;
        const result = originalWindowOpen.apply(window, args);
        // Reset flag after a delay
        setTimeout(() => {
          isWindowOpenInProgress.current = false;
        }, 1000);
        return result;
      };
    } catch (error) {}

    const handleVisibilityChange = () => {
      if (!document.hidden && !isWindowOpenInProgress.current) {
        const now = Date.now();
        // Prevent rapid successive calls (debounce for 2 seconds)
        if (now - lastVisibleTime.current > 2000) {
          lastVisibleTime.current = now;
          onVisible();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // iOS specific: Also listen for pageshow event
    const handlePageShow = event => {
      if (event.persisted && !isWindowOpenInProgress.current) {
        const now = Date.now();
        if (now - lastVisibleTime.current > 2000) {
          lastVisibleTime.current = now;
          onVisible();
        }
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    // When app comes to foreground - but not when opening new windows
    const handleFocus = () => {
      if (!isWindowOpenInProgress.current) {
        const now = Date.now();
        if (now - lastVisibleTime.current > 2000) {
          lastVisibleTime.current = now;
          onVisible();
        }
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      // Restore original window.open safely
      try {
        if (originalWindowOpen) {
          window.open = originalWindowOpen;
        }
      } catch (error) {}

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
    };
  }, [onVisible]);
};
