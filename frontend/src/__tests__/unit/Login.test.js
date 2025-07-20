import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../components/Login';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock the auth context with a more complete implementation
const mockLogin = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
    user: null
  }),
  AuthProvider: ({ children }) => <>{children}</>
}));

describe('Login Component', () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation for each test
    mockLogin.mockReset();
  });

  it('should render login form correctly', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Web Appliance Dashboard/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/benutzername/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/passwort/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anmelden/i })).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    // Setup the mock to return a successful login
    mockLogin.mockResolvedValue({ success: true });
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const usernameInput = screen.getByPlaceholderText(/benutzername/i);
    const passwordInput = screen.getByPlaceholderText(/passwort/i);
    const submitButton = screen.getByRole('button', { name: /anmelden/i });

    // Type in the inputs
    await userEvent.type(usernameInput, 'admin');
    await userEvent.type(passwordInput, 'password123');
    
    // Submit the form
    fireEvent.click(submitButton);

    // Wait for the login function to be called
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'password123');
    });
  });

  it('should display error on failed login', async () => {
    // Setup the mock to return a failed login
    mockLogin.mockResolvedValue({ 
      success: false, 
      error: 'Ungültige Anmeldedaten' 
    });
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const usernameInput = screen.getByPlaceholderText(/benutzername/i);
    const passwordInput = screen.getByPlaceholderText(/passwort/i);
    const submitButton = screen.getByRole('button', { name: /anmelden/i });

    await userEvent.type(usernameInput, 'wronguser');
    await userEvent.type(passwordInput, 'wrongpass');
    fireEvent.click(submitButton);

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/ungültige anmeldedaten/i)).toBeInTheDocument();
    });
  });

  it('should disable form while loading', async () => {
    // Setup a delayed response to test loading state
    mockLogin.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const usernameInput = screen.getByPlaceholderText(/benutzername/i);
    const passwordInput = screen.getByPlaceholderText(/passwort/i);
    const submitButton = screen.getByRole('button', { name: /anmelden/i });

    await userEvent.type(usernameInput, 'admin');
    await userEvent.type(passwordInput, 'password');
    fireEvent.click(submitButton);

    // Check if button shows loading state
    expect(submitButton).toHaveTextContent(/anmelden\.\.\./i);
    expect(submitButton).toBeDisabled();

    // Wait for loading to complete
    await waitFor(() => {
      expect(submitButton).toHaveTextContent(/^anmelden$/i);
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should handle login errors gracefully', async () => {
    // Setup the mock to throw an error
    mockLogin.mockRejectedValue(new Error('Network error'));
    
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const usernameInput = screen.getByPlaceholderText(/benutzername/i);
    const passwordInput = screen.getByPlaceholderText(/passwort/i);
    const submitButton = screen.getByRole('button', { name: /anmelden/i });

    await userEvent.type(usernameInput, 'admin');
    await userEvent.type(passwordInput, 'password');
    fireEvent.click(submitButton);

    // Wait for generic error message
    await waitFor(() => {
      expect(screen.getByText(/fehler ist aufgetreten/i)).toBeInTheDocument();
    });
  });
});
