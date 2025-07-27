import axios from '../utils/axiosConfig';

// SSH-Service API-Wrapper für Frontend
class SSHService {
  static async setupSSHKey(hostData) {
    try {
      const response = await axios.post('/api/ssh/setup', hostData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  static async getHosts() {
    try {
      const response = await axios.get('/api/ssh/hosts');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  static async testConnection(hostData) {
    try {
      const response = await axios.post('/api/ssh/test', hostData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  static async getSetupStatus() {
    try {
      const response = await axios.get('/api/ssh/setup-status');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  static async getDiagnosis() {
    try {
      const response = await axios.get('/api/ssh/diagnosis');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default SSHService;
