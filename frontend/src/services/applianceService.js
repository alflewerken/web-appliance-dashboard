import axios from '../utils/axiosConfig';

// API Service für Appliances
export class ApplianceService {
  static async fetchAppliances() {
    try {
      const response = await axios.get('/api/appliances');
      const { data } = response;

      // The backend now returns properly mapped data, so we just ensure defaults
      const enhancedData = data.map(app => {
        const enhanced = {
          ...app,
          // Ensure all fields have proper defaults
          description: app.description || '',
          category: app.category || 'productivity',
          lastUsed:
            app.lastUsed ||
            new Date(
              Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          // WICHTIG: isFavorite nicht mit || false überschreiben!
          // Prüfe beide möglichen Feldnamen
          isFavorite: app.isFavorite === true || app.isFavorite === 1 || app.isFavorite === '1' ||
                     app.is_favorite === true || app.is_favorite === 1 || app.is_favorite === '1',
          color: app.color || '#007AFF',
          icon: app.icon || 'Server',
          transparency: app.transparency !== undefined ? app.transparency : 0.7,
          blur:
            app.blur !== undefined
              ? app.blur
              : app.blurAmount !== undefined
                ? app.blurAmount
                : 8,
          blurAmount: app.blurAmount !== undefined ? app.blurAmount : 8,
          startCommand: app.startCommand || '',
          stopCommand: app.stopCommand || '',
          statusCommand: app.statusCommand || '',
          serviceStatus: app.serviceStatus || 'unknown',
          sshConnection: app.sshConnection || '',
          // Remote Desktop Felder - Mapping von DB-Feldern
          vncEnabled: app.vncEnabled || 
                     (app.remoteDesktopEnabled && app.remoteProtocol === 'vnc') || 
                     false,
          rdpEnabled: app.rdpEnabled || 
                     (app.remoteDesktopEnabled && app.remoteProtocol === 'rdp') || 
                     false,
          remoteDesktopEnabled: app.remoteDesktopEnabled || false,
          remoteProtocol: app.remoteProtocol || 'vnc',
        };
        
        return enhanced;
      });

      return enhancedData;
    } catch (error) {
      console.error('Fetch appliances error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to fetch appliances'
      );
    }
  }

  static async createAppliance(appliance) {
    try {
      const response = await axios.post('/api/appliances', appliance);
      const createdAppliance = response.data;

      // Backend returns properly mapped data
      return createdAppliance;
    } catch (error) {
      console.error('Create appliance error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to create appliance'
      );
    }
  }

  static async updateAppliance(id, appliance) {
    try {
      const response = await axios.put(`/api/appliances/${id}`, appliance);
      return response.data;
    } catch (error) {
      console.error('Update appliance error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to update appliance'
      );
    }
  }

  static async patchAppliance(id, updates) {
    try {
      const response = await axios.patch(`/api/appliances/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error('Patch appliance error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to patch appliance'
      );
    }
  }

  static async deleteAppliance(id) {
    try {
      await axios.delete(`/api/appliances/${id}`);
      return true;
    } catch (error) {
      console.error('Delete appliance error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to delete appliance'
      );
    }
  }

  static async toggleFavorite(id) {
    try {
      const response = await axios.patch(`/api/appliances/${id}/favorite`);
      return response.data;
    } catch (error) {
      console.error('Toggle favorite error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to toggle favorite'
      );
    }
  }

  static async updateLastUsed(id) {
    try {
      const response = await axios.patch(`/api/appliances/${id}/lastUsed`);
      return response.data;
    } catch (error) {
      console.error('Update lastUsed error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to update lastUsed'
      );
    }
  }

  static async startService(id) {
    try {
      const response = await axios.post(`/api/services/${id}/start`);
      return response.data;
    } catch (error) {
      console.error('Start service error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to start service'
      );
    }
  }

  static async stopService(id) {
    try {
      const response = await axios.post(`/api/services/${id}/stop`);
      return response.data;
    } catch (error) {
      console.error('Stop service error:', error);
      throw new Error(
        error.response?.data?.error || error.message || 'Failed to stop service'
      );
    }
  }

  static async checkServiceStatus(id) {
    try {
      const response = await axios.get(`/api/services/${id}/status`);
      return response.data;
    } catch (error) {
      console.error('Check service status error:', error);
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          'Failed to check service status'
      );
    }
  }

  static async checkAllServiceStatus() {
    try {
      // Trigger a backend check for all services
      const response = await axios.post(`/api/services/checkAll`);
      return response.data;
    } catch (error) {
      console.error('Check all services status error:', error);
      // Don't throw, just log - this is a background operation
      return null;
    }
  }
}

// Export as default for backward compatibility
export default ApplianceService;
