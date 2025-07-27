import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, AlertCircle } from 'lucide-react';
import '../styles/Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async e => {
    e.preventDefault();
    e.stopPropagation(); // Verhindere Event-Bubbling

    // Verhindere doppelte Submits
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);

      if (!result.success) {
        setError(result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(
        'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Web Appliance Dashboard</h1> <p>Bitte melden Sie sich an</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">
              <User size={20} />
              <span>Benutzername</span>
            </label>
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Benutzername oder E-Mail"
              required
              autoFocus={window.innerWidth > 768}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={20} />
              <span>Passwort</span>{' '}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Passwort"
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
