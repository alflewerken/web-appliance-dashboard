// Shared utilities for Terminal functionality
import axios from '../../utils/axiosConfig';

/**
 * Opens a terminal for a host
 */
export const openHostTerminal = async (host) => {
  try {
    const response = await axios.post(`/api/hosts/${host.id}/terminal`);
    
    if (response.data.url) {
      // Open in new window
      const terminalWindow = window.open(
        response.data.url,
        `terminal-${host.id}`,
        'width=800,height=600'
      );
      
      if (!terminalWindow) {
        throw new Error('Popup-Blocker verhindert das Öffnen des Terminals. Bitte erlauben Sie Popups für diese Seite.');
      }
      
      return terminalWindow;
    } else {
      throw new Error('Keine Terminal-URL erhalten');
    }
  } catch (error) {
    console.error('Error opening host terminal:', error);
    throw error;
  }
};

/**
 * Opens a terminal for a service/appliance
 */
export const openServiceTerminal = async (appliance, sshConnection) => {
  try {
    const response = await axios.post('/api/terminal/service', { 
      applianceId: appliance.id,
      sshConnection: sshConnection || appliance.sshConnection
    });
    
    if (response.data.url) {
      // Open in new window
      const terminalWindow = window.open(
        response.data.url,
        `terminal-${appliance.id}`,
        'width=800,height=600'
      );
      
      if (!terminalWindow) {
        throw new Error('Popup-Blocker verhindert das Öffnen des Terminals. Bitte erlauben Sie Popups für diese Seite.');
      }
      
      return terminalWindow;
    } else {
      throw new Error('Keine Terminal-URL erhalten');
    }
  } catch (error) {
    console.error('Error opening service terminal:', error);
    throw error;
  }
};

/**
 * Creates a terminal URL for embedding
 */
export const createTerminalUrl = async (entity, entityType, sshConnection) => {
  try {
    let response;
    
    if (entityType === 'host') {
      response = await axios.post(`/api/hosts/${entity.id}/terminal`);
    } else {
      response = await axios.post('/api/terminal/service', { 
        applianceId: entity.id,
        sshConnection: sshConnection || entity.sshConnection
      });
    }
    
    if (response.data.url) {
      return response.data.url;
    } else {
      throw new Error('Keine Terminal-URL erhalten');
    }
  } catch (error) {
    console.error('Error creating terminal URL:', error);
    throw error;
  }
};