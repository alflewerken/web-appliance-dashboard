import axios from '../utils/axiosConfig';

// API Service für Einstellungen
export class SettingsService {
  static async fetchSettings() {
    try {
      const response = await axios.get('/api/settings');
      return response.data;
    } catch (error) {
      console.error('Fetch settings error:', error);
      return {};
    }
  }

  static async updateSettings(settings) {
    try {
      const response = await axios.put('/api/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Update settings error:', error);
      throw new Error(
        error.response?.data?.error || 'Fehler beim Speichern der Einstellungen'
      );
    }
  }

  static async updateSetting(key, value) {
    try {
      const response = await axios.post('/api/settings', {
        key,
        value,
      });
      return response.data;
    } catch (error) {
      console.error('Update setting error:', error);
      throw new Error(
        error.response?.data?.error ||
          'Fehler beim Aktualisieren der Einstellung'
      );
    }
  }

  static async resetSettings() {
    try {
      const response = await axios.post('/api/settings/reset');
      return response.data;
    } catch (error) {
      console.error('Reset settings error:', error);
      throw new Error(
        error.response?.data?.error ||
          'Fehler beim Zurücksetzen der Einstellungen'
      );
    }
  }
}
