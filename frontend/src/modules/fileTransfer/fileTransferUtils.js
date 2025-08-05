// Shared utilities for File Transfer functionality
import axios from '../../utils/axiosConfig';

/**
 * Gets SSH host details from connection string or host object
 */
export const getSSHHostFromConnection = async (sshConnection, applianceId) => {
  if (!sshConnection) return null;
  
  try {
    // Parse SSH connection string if available
    const match = sshConnection.match(/^(.+)@(.+):(\d+)$/);
    if (!match) return null;
    
    const [, username, hostname, port] = match;
    
    // Try to find a configured SSH host
    const hostsResponse = await axios.get('/api/hosts');
    
    if (hostsResponse.data) {
      const hosts = hostsResponse.data || [];
      
      // Find matching host
      const configuredHost = hosts.find(h => 
        h.hostname === hostname && 
        h.username === username && 
        String(h.port) === port
      );
      
      if (configuredHost) {
        return configuredHost;
      }
    }
    
    // Return basic host info if no configured host found
    return {
      hostname,
      username,
      port: parseInt(port),
      requiresPassword: true
    };
  } catch (error) {
    console.error('Error getting SSH host:', error);
    return null;
  }
};

/**
 * Gets the default target path for file transfers
 */
export const getDefaultTargetPath = (entityType) => {
  return entityType === 'service' ? '/opt/services' : '/tmp';
};