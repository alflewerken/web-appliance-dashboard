import axios from '../utils/axiosConfig';

// API Service für Hintergrundbilder
export class BackgroundService {
  static async loadCurrentBackground() {
    try {
      const response = await axios.get('/api/background/current');
      return response.data.background;
    } catch (error) {
      return null;
    }
  }

  static async loadAllBackgroundImages() {
    try {
      const response = await axios.get('/api/background/list');
      return response.data.backgrounds || [];
    } catch (error) {
      return [];
    }
  }

  static async activateBackground(backgroundId) {
    try {
      const response = await axios.post(`/api/background/activate/${backgroundId}`);
      
      // If settings are returned, update localStorage to preserve them
      if (response.data && response.data.settings) {
        const currentSettings = JSON.parse(localStorage.getItem('backgroundSettings') || '{}');
        
        // Preserve blur, opacity, and position values
        const updatedSettings = {
          ...currentSettings,
          enabled: response.data.settings.background_enabled === 'true',
          // Keep existing blur value if not provided in response
          blur: response.data.settings.background_blur !== undefined && 
                response.data.settings.background_blur !== null ? 
            parseInt(response.data.settings.background_blur) :
            (currentSettings.blur || 5),
          // Keep existing opacity value if not provided in response  
          opacity: response.data.settings.background_opacity !== undefined && 
                   response.data.settings.background_opacity !== null ? 
            parseFloat(response.data.settings.background_opacity) :
            (currentSettings.opacity || 0.3),
          // Keep existing position value if not provided in response
          position: response.data.settings.background_position || 
            currentSettings.position || 
            'center center',
        };
        
        localStorage.setItem('backgroundSettings', JSON.stringify(updatedSettings));
      }
      
      return true;
    } catch (error) {
      console.error('Error activating background:', error);
      return false;
    }
  }

  static async deleteBackgroundImage(backgroundId) {
    try {
      await axios.delete(`/api/background/${backgroundId}`);
      return true;
    } catch (error) {
      console.error('Error deleting background:', error);
      return false;
    }
  }

  static async disableBackground() {
    try {
      await axios.post('/api/background/disable');
      return true;
    } catch (error) {
      console.error('Error disabling background:', error);
      return false;
    }
  }

  static async loadBackgroundSettings() {
    try {
      const response = await axios.get('/api/settings');
      const { data } = response;
      
      // Parse the enabled value correctly - handle various formats
      let enabled = false;
      if (data.background_enabled !== undefined) {
        const value = data.background_enabled;
        enabled = value === 'true' || value === true || value === '1' || value === 1;
      }
      
      // Parse transparent panels
      let transparentPanels = false;
      if (data.transparent_panels !== undefined) {
        const value = data.transparent_panels;
        transparentPanels = value === 'true' || value === true || value === '1' || value === 1;
      }
      
      // Parse opacity - convert from old format (0.3) to new format (30) if needed
      let opacity = 30; // Default 30%
      if (data.background_opacity !== undefined && data.background_opacity !== null) {
        const value = parseFloat(data.background_opacity);
        // If value is between 0 and 1, convert to percentage
        opacity = value <= 1 ? value * 100 : value;
      }
      
      const settings = {
        enabled: enabled,
        opacity: opacity,
        blur: data.background_blur !== undefined && data.background_blur !== null
          ? parseInt(data.background_blur)
          : 0,
        position: data.background_position || 'center',
        transparency: {
          panels: transparentPanels
        }
      };

      return settings;
    } catch (error) {
      console.error('Error loading background settings:', error);
      return {
        enabled: false,
        opacity: 30,
        blur: 0,
        position: 'center',
        transparency: {
          panels: false
        }
      };
    }
  }

  static async uploadBackgroundImage(file) {
    try {
      // Überprüfe Dateigröße (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error(
          `Datei ist zu groß. Maximale Größe: 50MB\n\nAktuelle Größe: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        );
      }

      // Überprüfe Dateityp
      if (!file.type.startsWith('image/')) {
        throw new Error(
          'Nur Bilddateien sind erlaubt\n\nUnterstützte Formate: JPG, PNG, WebP, GIF'
        );
      }

      const formData = new FormData();
      formData.append('background', file);

      const response = await axios.post('/api/background/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return true;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }
}
