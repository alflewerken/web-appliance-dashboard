import { useEffect } from 'react';
import { useSSE } from './useSSE';

// Hook to handle background tab synchronization
export const useBackgroundSync = onSync => {
  const { addEventListener } = useSSE();

  useEffect(() => {
    // Force update when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Small delay to ensure all state updates are processed
        setTimeout(() => {
          onSync();
        }, 100);
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also listen for focus events as backup
    const handleFocus = () => {
      setTimeout(() => {
        onSync();
      }, 100);
    };

    window.addEventListener('focus', handleFocus);

    // Custom event for manual sync trigger
    const handleManualSync = () => {
      onSync();
    };

    window.addEventListener('backgroundSettingsSync', handleManualSync);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('backgroundSettingsSync', handleManualSync);
    };
  }, [onSync]);

  // Also listen for SSE events and trigger sync when tab becomes visible
  useEffect(() => {
    let pendingSync = false;

    const unsubscribe = addEventListener('setting_update', data => {
      if (data.key?.startsWith('background_')) {
        if (document.hidden) {
          // Tab is hidden, mark sync as pending
          pendingSync = true;
          }
      }
    });

    const handleVisibilityChange = () => {
      if (!document.hidden && pendingSync) {
        pendingSync = false;
        onSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [addEventListener, onSync]);
};
