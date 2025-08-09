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
      await axios.post(`/api/background/activate/${backgroundId}`);
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
      const settings = {
        enabled: data.background_enabled === 'true' || data.background_enabled === true,
        opacity: parseFloat(data.background_opacity || '0.3'),
        blur: parseInt(data.background_blur || '5'),
        position: data.background_position || 'center',
      };
      return settings;
    } catch (error) {
      return {
        enabled: false,
        opacity: 0.3,
        blur: 5,
        position: 'center',
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
