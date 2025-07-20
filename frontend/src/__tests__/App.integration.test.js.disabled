import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from '../App';

jest.mock('axios');

// Mock SSEContext before importing components that use it
jest.mock('../contexts/SSEContext', () => ({
  SSEProvider: ({ children }) => <div>{children}</div>,
  useSSEContext: () => ({
    subscribe: jest.fn(() => jest.fn()),
    unsubscribe: jest.fn(),
    isConnected: true,
    connectionError: null,
  }),
}));

// Mock hooks before they are used
jest.mock('../hooks/useSSE', () => ({
  useSSE: () => ({
    addEventListener: jest.fn(() => jest.fn()),
    removeEventListener: jest.fn(),
    getConnectionStatus: jest.fn(),
    isReady: true,
    isConnected: true,
    connectionError: null,
  }),
}));

// Mock all child components to isolate App testing
jest.mock(
  '../components/AppHeader',
  () =>
    function MockAppHeader() {
      return <div data-testid="app-header">Header</div>;
    }
);

jest.mock(
  '../components/AppContent',
  () =>
    function MockAppContent({ appliances }) {
      return (
        <div data-testid="app-content">
          {appliances.map(app => (
            <div key={app.id}>{app.name}</div>
          ))}
        </div>
      );
    }
);

// Mock other components that might be imported
jest.mock(
  '../components/BackgroundImage',
  () =>
    function MockBackgroundImage() {
      return <div data-testid="background-image" />;
    }
);

// Mock window.alert and confirm
global.alert = jest.fn();
global.confirm = jest.fn(() => true);

describe('App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: [] });
  });

  test('loads appliances on mount', async () => {
    const mockAppliances = [
      { id: 1, name: 'Service 1' },
      { id: 2, name: 'Service 2' },
    ];

    axios.get.mockResolvedValue({ data: mockAppliances });

    render(<App />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/appliances');
    });

    // Check if services are rendered
    await waitFor(() => {
      expect(screen.getByText('Service 1')).toBeInTheDocument();
      expect(screen.getByText('Service 2')).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    axios.get.mockRejectedValue(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/appliances');
    });

    // App should still render despite error
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('app-content')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  test('refreshes appliances when requested', async () => {
    const mockAppliances = [{ id: 1, name: 'Initial Service' }];

    const updatedAppliances = [
      { id: 1, name: 'Initial Service' },
      { id: 2, name: 'New Service' },
    ];

    axios.get
      .mockResolvedValueOnce({ data: mockAppliances })
      .mockResolvedValueOnce({ data: updatedAppliances });

    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Initial Service')).toBeInTheDocument();
    });

    // Trigger refresh (this would normally be done through UI interaction)
    rerender(<App />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
});
