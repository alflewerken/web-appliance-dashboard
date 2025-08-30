const axios = require('axios');

class GuacamoleAPI {
  constructor(baseUrl, adminUser = 'guacadmin', adminPass = 'guacadmin') {
    // Verwende Docker-Alias ohne Unterstrich
    this.baseUrl = baseUrl || 'http://guacamole-app:8080/guacamole';
    this.adminUser = adminUser;
    this.adminPass = adminPass;
    this.token = null;
    this.dataSource = 'postgresql'; // oder 'mysql' je nach Setup
  }

  async authenticate() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/tokens`,
        `username=${encodeURIComponent(this.adminUser)}&password=${encodeURIComponent(this.adminPass)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.token = response.data.authToken;
      return this.token;
    } catch (error) {
      console.error('Guacamole authentication failed:', error.message);
      throw error;
    }
  }

  async createConnection(name, protocol, parameters) {
    if (!this.token) await this.authenticate();

    const connection = {
      name: name,
      protocol: protocol,
      parameters: parameters,
      attributes: {
        'max-connections': '2',
        'max-connections-per-user': '1'
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/session/data/${this.dataSource}/connections`,
        connection,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to create connection:', error.message);
      throw error;
    }
  }

  async getOrCreateConnection(applianceId, config) {
    if (!this.token) await this.authenticate();

    // Prüfe ob Verbindung bereits existiert
    try {
      const connections = await this.listConnections();
      const existingConnection = connections.find(c => c.name === `appliance-${applianceId}`);
      
      if (existingConnection) {
        return existingConnection.identifier;
      }
    } catch (error) {

    }

    // Erstelle neue Verbindung
    const connectionName = `appliance-${applianceId}`;
    const connection = await this.createConnection(
      connectionName,
      config.protocol,
      {
        hostname: config.hostname,
        port: config.port,
        password: config.password,
        username: config.username || ''
      }
    );

    return connection.identifier;
  }

  async listConnections() {
    if (!this.token) await this.authenticate();

    try {
      const response = await axios.get(
        `${this.baseUrl}/api/session/data/${this.dataSource}/connections`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      return Object.values(response.data);
    } catch (error) {
      console.error('Failed to list connections:', error.message);
      throw error;
    }
  }

  generateDirectUrl(connectionId) {
    return `${this.baseUrl}/#/client/${connectionId}?token=${this.token}`;
  }
}

module.exports = GuacamoleAPI;
