import { useContext } from 'react';
import { SSEContext } from '../contexts/SSEContext';

export const useSSE = () => {
  const context = useContext(SSEContext);

  // Return dummy implementation if not in SSEProvider
  if (!context) {
    return {
      addEventListener: () => () => {},
      removeEventListener: () => {},
      getConnectionStatus: () => ({ isConnected: false }),
      isReady: false,
      isConnected: false,
      connectionError: null,
    };
  }

  return {
    addEventListener: context.addEventListener,
    removeEventListener: context.removeEventListener,
    getConnectionStatus: context.getConnectionStatus,
    isReady: context.isConnected,
    isConnected: context.isConnected,
    connectionError: context.connectionError,
  };
};
