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

// Make sure we NEVER return undefined or an IP address
let API_BASE_URL = getApiUrl();

// Safety check - if somehow an IP got in there, clear it
if (API_BASE_URL && API_BASE_URL.match(/\d+\.\d+\.\d+\.\d+/)) {
  console.warn('IP address detected in API_BASE_URL, clearing it');
  API_BASE_URL = '';
}

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
  
  // Use relative URL to go through nginx proxy
  // This works for all devices accessing through the main dashboard port
  return '/guacamole';
};

const GUACAMOLE_URL = getGuacamoleUrl();

export default API_BASE_URL;
export { API_BASE_URL, GUACAMOLE_URL };
