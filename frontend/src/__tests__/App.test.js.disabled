import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../../App';
import api from '../../services/api';

// Mock the API service
jest.mock('../../services/api');

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should show login screen when not authenticated', () => {
    render(<App />);

    expect(screen.getByText(/Web Appliance Dashboard/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('should login successfully with valid credentials', async () => {
    const mockToken = 'mock-jwt-token';
    const mockUser = { id: 1, username: 'testuser', role: 'admin' };

    api.post.mockResolvedValueOnce({
      data: { token: mockToken, user: mockUser },
    });

    api.get.mockResolvedValueOnce({ data: [] }); // appliances
    api.get.mockResolvedValueOnce({ data: [] }); // categories

    render(<App />);

    const usernameInput = screen.getByPlaceholderText(/Username/i);
    const passwordInput = screen.getByPlaceholderText(/Password/i);
    const loginButton = screen.getByRole('button', { name: /Login/i });

    await userEvent.type(usernameInput, 'testuser');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe(mockToken);
      expect(screen.queryByText(/Login/i)).not.toBeInTheDocument();
    });
  });

  it('should show error message on login failure', async () => {
    api.post.mockRejectedValueOnce({
      response: { data: { error: 'Invalid credentials' } },
    });

    render(<App />);

    const usernameInput = screen.getByPlaceholderText(/Username/i);
    const passwordInput = screen.getByPlaceholderText(/Password/i);
    const loginButton = screen.getByRole('button', { name: /Login/i });

    await userEvent.type(usernameInput, 'wronguser');
    await userEvent.type(passwordInput, 'wrongpass');
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('should logout when logout is triggered', async () => {
    // Set initial auth state
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem(
      'user',
      JSON.stringify({ username: 'testuser', role: 'admin' })
    );

    api.get.mockResolvedValue({ data: [] });

    render(<App />);

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.queryByText(/Login/i)).not.toBeInTheDocument();
    });

    // Simulate logout
    const logoutButton = screen.getByLabelText(/Logout/i);
    await userEvent.click(logoutButton);

    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByText(/Login/i)).toBeInTheDocument();
  });
});
