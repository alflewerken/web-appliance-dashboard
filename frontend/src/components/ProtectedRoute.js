import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, authEnabled, loading } = useAuth();

  // If auth is disabled, always show the content
  if (!authEnabled) {
    return children;
  }

  // Still loading auth status
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <div>Lade...</div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null; // App.js will handle showing the login
  }

  // Requires admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: '#ff3b30',
        }}
      >
        <h2>Zugriff verweigert</h2>
        <p>Sie benötigen Administratorrechte für diese Funktion.</p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
