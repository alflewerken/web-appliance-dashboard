import { useState, useCallback, useEffect } from 'react';
import axios from '../../utils/axiosConfig';

/**
 * Custom hook for managing SSH connections
 * Provides common SSH-related functionality for both hosts and services
 */
export const useSSHConnection = (entityType = 'host') => {
  const [sshHosts, setSSHHosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available SSH hosts
  const fetchSSHHosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/hosts');
      const hosts = response.data?.hosts || response.data || [];
      
      // Filter based on entity type if needed
      const filteredHosts = entityType === 'service' 
        ? hosts.filter(host => host.isActive !== false)
        : hosts;
        
      setSSHHosts(filteredHosts);
      return filteredHosts;
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Fehler beim Laden der SSH-Hosts';
      setError(errorMsg);
      console.error('Error fetching SSH hosts:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  // Get SSH connection details from connection string
  const getSSHConnectionDetails = useCallback((connectionString) => {
    if (!connectionString) return null;
    
    // Parse connection string format: username@hostname:port
    const match = connectionString.match(/^(.+?)@(.+?):(\d+)$/);
    if (!match) return null;
    
    const [, username, hostname, port] = match;
    
    // Find matching host
    return sshHosts.find(host => 
      host.username === username && 
      host.hostname === hostname && 
      String(host.port) === port
    ) || null;
  }, [sshHosts]);

  // Create connection string from host
  const createConnectionString = useCallback((host) => {
    if (!host) return '';
    return `${host.username || 'root'}@${host.hostname}:${host.port || 22}`;
  }, []);

  // Validate SSH connection
  const validateConnection = useCallback(async (hostId) => {
    try {
      const response = await axios.post(`/api/hosts/${hostId}/test`);
      return response.data.success || false;
    } catch (err) {
      console.error('SSH connection validation failed:', err);
      return false;
    }
  }, []);

  // Get host by ID
  const getHostById = useCallback((hostId) => {
    return sshHosts.find(host => host.id === hostId) || null;
  }, [sshHosts]);

  // Auto-fetch hosts on mount
  useEffect(() => {
    fetchSSHHosts();
  }, [fetchSSHHosts]);

  return {
    sshHosts,
    loading,
    error,
    fetchSSHHosts,
    getSSHConnectionDetails,
    createConnectionString,
    validateConnection,
    getHostById
  };
};

export default useSSHConnection;