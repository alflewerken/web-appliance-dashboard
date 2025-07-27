import React, { createContext, useContext, useEffect, useState } from 'react';
import sseService from '../services/sseService';

export const SSEContext = createContext();

export const SSEProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const initializeSSE = async () => {
      try {
        // Add connection status listener before connecting
        const unsubscribe = sseService.addEventListener('connection', data => {
          if (mounted) {
            setIsConnected(data.status === 'connected');
          }
        });

        // Add restore completed listener to reconnect after restore
        const restoreUnsubscribe = sseService.addEventListener(
          'restore_completed',
          async data => {
            console.log('🔄 Restore completed, reconnecting SSE...');
            if (mounted) {
              // Disconnect and reconnect to ensure fresh connection
              sseService.disconnect();
              setTimeout(async () => {
                if (mounted) {
                  try {
                    await sseService.connect();
                    console.log('✅ SSE reconnected after restore');
                  } catch (error) {
                    console.error(
                      '❌ Failed to reconnect SSE after restore:',
                      error
                    );
                  }
                }
              }, 1000);
            }
          }
        );

        // Connect to SSE service with delay to avoid initialization issues
        setTimeout(async () => {
          if (mounted) {
            try {
              await sseService.connect();
            } catch (error) {
              if (mounted) {
                setConnectionError(error.message);
              }
            }
          }
        }, 1000);

        // Add debug window function
        if (typeof window !== 'undefined') {
          window.sseDebug = () => sseService.debugListeners();
        }

        return () => {
          unsubscribe();
          restoreUnsubscribe();
          if (window.sseDebug) {
            delete window.sseDebug;
          }
        };
      } catch (error) {
        if (mounted) {
          setConnectionError(error.message);
        }
      }
    };

    // Initialize SSE connection
    initializeSSE();

    return () => {
      mounted = false;
      sseService.disconnect();
    };
  }, []);

  const value = {
    isConnected,
    connectionError,
    addEventListener: sseService.addEventListener.bind(sseService),
    removeEventListener: sseService.removeEventListener.bind(sseService),
    getConnectionStatus: sseService.getConnectionStatus.bind(sseService),
    service: sseService, // Direct access to service for debugging
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
};

export const useSSEContext = () => {
  const context = useContext(SSEContext);
  // Return a dummy context if SSEProvider is not available
  if (!context) {
    return {
      addEventListener: () => () => {},
      removeEventListener: () => {},
      getConnectionStatus: () => ({ isConnected: false }),
      isConnected: false,
      connectionError: null,
    };
  }
  return context;
};
