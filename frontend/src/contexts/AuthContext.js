import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from '../utils/axiosConfig';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [permissions, setPermissions] = useState([]);

  // Configure axios defaults
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      setToken(storedToken);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await axios.get('/api/auth/me');
          setUser(response.data.user);
          setPermissions(response.data.permissions || []);
        } catch (authError) {
          // Token is invalid, remove it
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
      });
      const { token, user, permissions } = response.data;

      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setToken(token);
      setUser(user);
      setPermissions(permissions || []);

      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      // Continue with logout even if server call fails
      console.error('Logout error:', error);
    }

    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
    setPermissions([]);
  };

  // Role check functions
  const isAdmin = () => user?.role === 'Administrator';

  const isPowerUser = () =>
    user?.role === 'Power User' || user?.role === 'Administrator';

  const isAuthenticated = () => !!user && user.role !== 'Gast';

  const isGuest = () => user?.role === 'Gast';

  // Permission check function
  const hasPermission = (resource, action) => {
    if (isAdmin()) return true; // Admin has all permissions
    const permission = `${resource}:${action}`;
    return permissions.includes(permission);
  };

  // Check if user can access an appliance
  const canAccessAppliance = appliance => {
    if (!user) return appliance.visibility === 'public';
    if (isAdmin()) return true;

    switch (appliance.visibility) {
      case 'public':
        return true;
      case 'authenticated':
        return isAuthenticated();
      case 'power_user':
        return isPowerUser();
      case 'admin':
        return isAdmin();
      default:
        return false;
    }
  };

  // Check if user can execute commands on an appliance
  const canExecuteOnAppliance = appliance => {
    if (!user) return false;
    if (isAdmin() || isPowerUser()) return true;
    if (isGuest()) return false;

    return (
      appliance.visibility === 'public' ||
      appliance.visibility === 'authenticated'
    );
  };

  const updateProfile = async profileData => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update profile',
      };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post('/api/auth/changePassword', {
        currentPassword,
        newPassword,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to change password',
      };
    }
  };

  const value = {
    user,
    loading,
    token,
    permissions,
    login,
    logout,
    isAdmin,
    isPowerUser,
    isAuthenticated,
    isGuest,
    hasPermission,
    canAccessAppliance,
    canExecuteOnAppliance,
    updateProfile,
    changePassword,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
