import axios from 'axios';

// Set default timeout to 60 seconds
axios.defaults.timeout = 60000;

// Configure axios interceptors
axios.interceptors.request.use(
  config => {
    // Get token from localStorage
    const token = localStorage.getItem('token');

    // If token exists, add it to the request
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor to handle 401 errors
axios.interceptors.response.use(
  response => response,
  error => {
    // If we get a 401, clear the token and reload
    if (error.response && error.response.status === 401) {
      // Don't reload for certain endpoints that should work without auth
      const url = error.config?.url || '';
      const skipReloadEndpoints = [
        '/api/settings',
        '/api/background',
        '/api/categories',
      ];

      if (!skipReloadEndpoints.some(endpoint => url.includes(endpoint))) {
        localStorage.removeItem('token');
        // Don't reload if we're already on the login page
        if (!window.location.pathname.includes('/login')) {
          window.location.reload();
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
