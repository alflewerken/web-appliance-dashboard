// Shared utilities for Remote Desktop functionality
import axios from '../../utils/axiosConfig';

/**
 * Opens a Guacamole remote desktop connection
 */
/**
 * Opens a Guacamole remote desktop connection
 */
export const openGuacamoleConnection = async (appliance, token, performanceMode = 'balanced') => {
  try {
    // Make POST request to get Guacamole connection URL
    const response = await axios.post(
      `/api/guacamole/token/${appliance.id}`,
      { performanceMode },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (response.data.url) {
      // Calculate window size - 90% of screen size
      const width = Math.floor(window.screen.width * 0.9);
      const height = Math.floor(window.screen.height * 0.9);
      
      // Calculate centered position
      const left = Math.floor((window.screen.width - width) / 2);
      const top = Math.floor((window.screen.height - height) / 2);
      
      // Window features for a proper separate window
      const windowFeatures = [
        `width=${width}`,
        `height=${height}`,
        `left=${left}`,
        `top=${top}`,
        'toolbar=no',
        'menubar=no',
        'location=no',
        'status=yes',
        'scrollbars=yes',
        'resizable=yes'
      ].join(',');
      
      // Open the Guacamole connection in a separate window with specific features
      const guacWindow = window.open(
        response.data.url, 
        `guacamole_${appliance.id}_${Date.now()}`, // Unique window name
        windowFeatures
      );
      
      if (!guacWindow) {
        throw new Error('Popup-Blocker verhindert das Öffnen des Remote Desktop. Bitte erlauben Sie Popups für diese Seite.');
      }
      
      // Focus the new window
      guacWindow.focus();
      
      return guacWindow;
    } else {
      throw new Error('Keine gültige Verbindungs-URL erhalten');
    }
  } catch (error) {
    console.error('Guacamole connection error:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
};

/**
 * Opens a RustDesk connection
 */
export const openRustDeskConnection = async (appliance, token) => {
  const rustdeskId = appliance.rustdeskId || appliance.rustdesk_id;
  const rustdeskPassword = appliance.rustdeskPassword || appliance.rustdesk_password;
  
  if (!rustdeskId) {
    throw new Error('Keine RustDesk ID gefunden');
  }
  
  try {

    // Log the access - ensure this is sent before opening RustDesk
    const auditResponse = await axios.post(
      `/api/rustdesk/access/${appliance.id}`,
      {
        action: 'connect',
        rustdesk_id: rustdeskId
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    // Create RustDesk URL
    let rustdeskUrl = `rustdesk://${rustdeskId}`;
    if (rustdeskPassword) {
      rustdeskUrl += `?password=${encodeURIComponent(rustdeskPassword)}`;
    }

    // Open RustDesk
    window.location.href = rustdeskUrl;
    
    return true;
  } catch (error) {
    console.error('Failed to connect to RustDesk:', error);
    // If audit log fails, we should still show the error but might want to continue
    if (error.response?.status === 404) {
      throw new Error('Appliance nicht gefunden');
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
};

/**
 * Checks if RustDesk is installed and configured
 */
export const checkRustDeskStatus = (appliance) => {
  const rustdeskInstalled = appliance.rustdeskInstalled || appliance.rustdesk_installed;
  const rustdeskId = appliance.rustdeskId || appliance.rustdesk_id;
  
  return {
    installed: rustdeskInstalled,
    hasId: !!rustdeskId,
    isReady: rustdeskInstalled && !!rustdeskId
  };
};

/**
 * Gets the remote desktop type from appliance
 */
export const getRemoteDesktopType = (appliance) => {
  return appliance.remoteDesktopType || appliance.remote_desktop_type || 'guacamole';
};

/**
 * Checks if remote desktop is enabled
 */
export const isRemoteDesktopEnabled = (appliance) => {
  return appliance.remoteDesktopEnabled || appliance.remote_desktop_enabled || false;
};