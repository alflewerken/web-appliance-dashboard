// API Service - Proxy-aware configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.isExternalAccess = null;
  }

  async checkAccessMode() {
    try {
      const response = await fetch(`${API_BASE_URL}/config/accessMode`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      const data = await response.json();
      this.isExternalAccess = data.isExternal;
      return data;
    } catch (error) {
      console.error('Failed to check access mode:', error);
      // Fallback: check hostname
      const hostname = window.location.hostname;
      this.isExternalAccess = !hostname.includes('192.168.') && 
                             !hostname.includes('10.') && 
                             !hostname.includes('localhost');
      return { isExternal: this.isExternalAccess };
    }
  }

  // Helper function to check if IP is in private network range
  isPrivateIP(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    
    // Check for private IP ranges
    // 10.0.0.0 - 10.255.255.255
    if (first === 10) return true;
    
    // 172.16.0.0 - 172.31.255.255
    if (first === 172 && second >= 16 && second <= 31) return true;
    
    // 192.168.0.0 - 192.168.255.255
    if (first === 192 && second === 168) return true;
    
    // 127.0.0.0 - 127.255.255.255 (localhost)
    if (first === 127) return true;
    
    return false;
  }

  getServiceUrl(service) {
    if (this.isExternalAccess === null) {
      // Not yet determined, use fallback
      this.checkAccessMode();
    }

    // Check if service has an external (public) IP address
    const isServiceExternal = !this.isPrivateIP(service.ip_address);

    // If the service is on the public internet, always use direct URL
    if (isServiceExternal) {
      const protocol = service.use_https ? 'https' : 'http';
      return `${protocol}://${service.ip_address}:${service.port}`;
    }

    // For internal services, use proxy when accessing from external
    if (this.isExternalAccess) {
      // External access to internal service - use proxy
      return `/api/proxy/${service.ip_address}:${service.port}/`;
    } else {
      // Internal access to internal service - direct connection
      const protocol = service.use_https ? 'https' : 'http';
      return `${protocol}://${service.ip_address}:${service.port}`;
    }
  }

  async getServices() {
    const response = await fetch(`${API_BASE_URL}/services`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    const services = await response.json();
    
    // Add proxy URLs to each service
    return services.map(service => ({
      ...service,
      directUrl: `${service.use_https ? 'https' : 'http'}://${service.ip_address}:${service.port}`,
      proxyUrl: `/api/proxy/${service.ip_address}:${service.port}/`,
      url: this.getServiceUrl(service) // Smart URL based on access mode
    }));
  }
}

export default new ApiService();