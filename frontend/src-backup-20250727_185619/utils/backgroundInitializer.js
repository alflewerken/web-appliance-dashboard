// Background initialization helper
// This ensures background settings are applied correctly on app startup

export const initializeBackgroundState = () => {
  // Get saved background settings from localStorage
  const savedSettings = localStorage.getItem('backgroundSettings');
  
  if (savedSettings) {
    try {
      const settings = JSON.parse(savedSettings);
      
      // Apply the settings immediately to the DOM
      if (settings.enabled) {
        document.body.classList.add('has-background-image');
        document.body.setAttribute('data-opacity', settings.opacity || 0.3);
        document.body.setAttribute('data-blur', settings.blur || 5);
      }
    } catch (error) {
      console.error('Failed to parse background settings:', error);
    }
  }
  
  // Check for transparent panels setting (independent of background)
  const transparentPanels = localStorage.getItem('transparentPanels');
  if (transparentPanels === 'true') {
    document.body.classList.add('transparent-panels');
  }
  
  // Also check for theme
  const theme = localStorage.getItem('theme');
  if (theme) {
    document.body.className = document.body.className.replace(/theme-\w+/, '');
    document.body.classList.add(`theme-${theme}`);
  }
};

// Call this as early as possible
initializeBackgroundState();
