// Enhanced Mobile Auto-Update Hook for Audit Log
import { useEffect, useRef, useCallback } from 'react';

export const useMobileAutoUpdate = (fetchFunction, dependencies = []) => {
  const intervalRef = useRef(null);
  const lastFetchRef = useRef(Date.now());
  const isVisibleRef = useRef(true);
  
  // Detect if we're on a mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                   window.innerWidth <= 768;
  
  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = !document.hidden;
    
    if (!document.hidden && isMobile) {
      // When app becomes visible again on mobile, fetch immediately
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchRef.current;
      
      // If more than 5 seconds have passed, fetch new data
      if (timeSinceLastFetch > 5000) {
        fetchFunction();
        lastFetchRef.current = now;
      }
    }
  }, [fetchFunction, isMobile]);
  
  // Setup polling for mobile devices
  useEffect(() => {
    if (!isMobile) return;
    
    // Initial fetch
    fetchFunction();
    lastFetchRef.current = Date.now();
    
    // Setup polling interval (every 5 seconds on mobile)
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        fetchFunction();
        lastFetchRef.current = Date.now();
      }
    }, 5000); // Poll every 5 seconds on mobile
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add focus listener for additional safety
    const handleFocus = () => {
      if (isMobile) {
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchRef.current;
        
        if (timeSinceLastFetch > 5000) {
          fetchFunction();
          lastFetchRef.current = now;
        }
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchFunction, handleVisibilityChange, isMobile, ...dependencies]);
  
  // Return a manual refresh function
  const manualRefresh = useCallback(() => {
    fetchFunction();
    lastFetchRef.current = Date.now();
  }, [fetchFunction]);
  
  return { manualRefresh, isMobile };
};
