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
      // Open the Guacamole connection in a new window
      const guacWindow = window.open(response.data.url, '_blank');
      
      if (!guacWindow) {
        throw new Error('Popup-Blocker verhindert das Öffnen des Remote Desktop. Bitte erlauben Sie Popups für diese Seite.');
      }
      
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
    // Log the access
    await axios.post(`/api/rustdesk/access/${appliance.id}`, {
      action: 'connect',
      rustdesk_id: rustdeskId
    });
    
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