// Mock SSE Context Provider for testing
import React from 'react';
import { render } from '@testing-library/react';

// Create mock SSEContext
const mockSSEContext = React.createContext();

// Mock SSEProvider
export const MockSSEProvider = ({ children }) => {
  const mockContextValue = {
    subscribe: jest.fn(() => jest.fn()),
    unsubscribe: jest.fn(),
    isConnected: true,
    connectionError: null,
  };

  return (
    <mockSSEContext.Provider value={mockContextValue}>
      {children}
    </mockSSEContext.Provider>
  );
};

// Mock useSSEContext hook
export const mockUseSSEContext = () => ({
  subscribe: jest.fn(() => jest.fn()),
  unsubscribe: jest.fn(),
  isConnected: true,
  connectionError: null,
});

// Helper function to render with all necessary providers
export const renderWithProviders = (ui, options = {}) =>
  render(<MockSSEProvider>{ui}</MockSSEProvider>, options);

// Mock window.alert
global.alert = jest.fn();

// Mock window.confirm
global.confirm = jest.fn(() => true);

export default {
  MockSSEProvider,
  mockUseSSEContext,
  renderWithProviders,
};
