// API Base URL Configuration
// For mobile devices, we need to use the actual IP or relative URL
const getApiUrl = () => {
  // If we have an environment variable, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Always use relative URLs in production
  // This ensures it works through nginx proxy on any domain/port
  return ''; // Use relative URLs like /api/...
};

const API_BASE_URL = getApiUrl();

// Guacamole URL Configuration
const getGuacamoleUrl = () => {
  if (process.env.REACT_APP_GUACAMOLE_URL) {
    return process.env.REACT_APP_GUACAMOLE_URL;
  }
  
  // Check if we're running in the macOS Electron app
  if (window.electronAPI && window.location.port === '9081') {
    // macOS App uses port 9871 for Guacamole
    return window.location.protocol + '//' + window.location.hostname + ':9871/guacamole';
  }
  
  // Default to local Guacamole instance
  return window.location.protocol + '//' + window.location.hostname + ':9070/guacamole';
};

const GUACAMOLE_URL = getGuacamoleUrl();

export default API_BASE_URL;
export { API_BASE_URL, GUACAMOLE_URL };
