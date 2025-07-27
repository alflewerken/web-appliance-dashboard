/**
 * ProxyService - Zentrale Service für alle Proxy-URLs
 * 
 * Wandelt alle direkten Appliance-URLs in Proxy-URLs um,
 * damit alle Zugriffe über den Backend-Proxy laufen
 */

class ProxyService {
    /**
     * Generiert die Proxy-URL für eine Appliance
     * @param {string|number} applianceId - ID der Appliance
     * @param {string} path - Pfad innerhalb der Appliance (optional)
     * @returns {string} Proxy-URL
     */
    getProxyUrl(applianceId, path = '') {
        // Sicherstellen, dass der Pfad mit / beginnt
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const baseUrl = `/api/appliances/${applianceId}/proxy${cleanPath}`;
        
        // Token hinzufügen für Authentifizierung
        const token = localStorage.getItem('token');

        if (token) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const finalUrl = `${baseUrl}${separator}token=${encodeURIComponent(token)}`;

            return finalUrl;
        }

        return baseUrl;
    }
    
    /**
     * Generiert die WebSocket-URL für Terminal-Verbindungen
     * @param {string|number} applianceId - ID der Appliance
     * @returns {string} WebSocket-URL
     */
    getTerminalWebSocketUrl(applianceId) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const token = localStorage.getItem('token');
        return `${protocol}//${host}/api/appliances/${applianceId}/terminal?token=${token}`;
    }
    
    /**
     * Generiert die WebSocket-URL für VNC/RDP-Verbindungen
     * @param {string|number} applianceId - ID der Appliance
     * @returns {string} WebSocket-URL
     */
    getVncWebSocketUrl(applianceId) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const token = localStorage.getItem('token');
        return `${protocol}//${host}/api/appliances/${applianceId}/vnc?token=${token}`;
    }
    
    /**
     * Health-Check URL für eine Appliance
     * @param {string|number} applianceId - ID der Appliance
     * @returns {string} Health-Check URL
     */
    getHealthCheckUrl(applianceId) {
        return `/api/appliances/${applianceId}/health`;
    }
    
    /**
     * Prüft, ob eine IP-Adresse im privaten Netzwerk liegt
     * @param {string} ip - IP-Adresse
     * @returns {boolean} True wenn private IP
     */
    isPrivateIP(ip) {
        if (!ip) return false;
        
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
    
    /**
     * Prüft, ob eine Appliance/Service extern erreichbar ist
     * @param {object} appliance - Appliance/Service-Objekt
     * @returns {boolean} True wenn extern
     */
    isExternalService(appliance) {
        // Prüfe ob URL bereits extern ist
        if (appliance.url && (appliance.url.startsWith('http://') || appliance.url.startsWith('https://'))) {
            // Prüfe ob die URL auf eine private IP zeigt
            try {
                const urlObj = new URL(appliance.url);
                return !this.isPrivateIP(urlObj.hostname);
            } catch (e) {
                // Fallback für ungültige URLs
                return true;
            }
        }
        
        // Prüfe IP-Adresse direkt
        if (appliance.ip_address) {
            return !this.isPrivateIP(appliance.ip_address);
        }
        
        return false;
    }
    
    /**
     * Konvertiert eine direkte Appliance-URL in eine Proxy-URL
     * @param {object} appliance - Appliance-Objekt
     * @param {string} path - Optionaler Pfad
     * @returns {string} Proxy-URL
     */
    convertToProxyUrl(appliance, path = '') {
        if (!appliance || !appliance.id) {
            console.error('Invalid appliance object:', appliance);
            return '#';
        }
        
        // Wenn es ein externer Service ist, gib die direkte URL zurück
        if (this.isExternalService(appliance)) {
            if (appliance.url) {
                return appliance.url + path;
            } else if (appliance.ip_address && appliance.port) {
                const protocol = appliance.use_https ? 'https' : 'http';
                return `${protocol}://${appliance.ip_address}:${appliance.port}${path}`;
            }
        }
        
        // Wenn die Appliance bereits eine Proxy-URL hat, diese verwenden
        if (appliance.proxy_url) {
            const baseUrl = appliance.proxy_url + path;
            // Token hinzufügen
            const token = localStorage.getItem('token');
            if (token) {
                const separator = baseUrl.includes('?') ? '&' : '?';
                return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
            }
            return baseUrl;
        }
        
        // Ansonsten Standard-Proxy-URL generieren (getProxyUrl fügt bereits den Token hinzu)
        return this.getProxyUrl(appliance.id, path);
    }
    
    /**
     * Prüft, ob eine URL bereits eine Proxy-URL ist
     * @param {string} url - Zu prüfende URL
     * @returns {boolean} True wenn es eine Proxy-URL ist
     */
    isProxyUrl(url) {
        return url && url.includes('/api/appliances/') && url.includes('/proxy');
    }
    
    /**
     * Extrahiert die Appliance-ID aus einer Proxy-URL
     * @param {string} url - Proxy-URL
     * @returns {string|null} Appliance-ID oder null
     */
    extractApplianceId(url) {
        const match = url.match(/\/api\/appliances\/(\d+)\/proxy/);
        return match ? match[1] : null;
    }
    
    /**
     * Bereitet Headers für Proxy-Requests vor
     * @returns {object} Headers-Objekt
     */
    getProxyHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Proxy-Client': 'web-appliance-dashboard'
        };
    }
    
    /**
     * Öffnet eine Appliance in einem neuen Tab über Proxy oder direkt
     * @param {object} appliance - Appliance-Objekt
     * @param {string} path - Optionaler Pfad
     */
    openInNewTab(appliance, path = '') {
        let targetUrl;
        
        // Debug-Ausgaben
        const token = localStorage.getItem('token');

        // Wenn es ein externer Service ist, direkt öffnen
        if (this.isExternalService(appliance)) {
            if (appliance.url) {
                targetUrl = appliance.url + path;
            } else if (appliance.ip_address && appliance.port) {
                const protocol = appliance.use_https ? 'https' : 'http';
                targetUrl = `${protocol}://${appliance.ip_address}:${appliance.port}${path}`;
            }
        } else {
            // Interne URL oder Service - verwende Proxy
            // getProxyUrl fügt bereits den Token hinzu
            targetUrl = this.getProxyUrl(appliance.id, path);
        }

        window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
    
    /**
     * Generiert eine iframe-taugliche Proxy-URL
     * @param {object} appliance - Appliance-Objekt
     * @returns {string} iframe-URL
     */
    getIframeUrl(appliance) {
        // Für externe Services die direkte URL verwenden
        if (this.isExternalService(appliance)) {
            if (appliance.url) {
                return appliance.url;
            } else if (appliance.ip_address && appliance.port) {
                const protocol = appliance.use_https ? 'https' : 'http';
                return `${protocol}://${appliance.ip_address}:${appliance.port}`;
            }
        }
        
        // Für interne Services: getProxyUrl fügt bereits den Token hinzu
        // Füge zusätzlich iframe=true Parameter hinzu
        const baseUrl = this.getProxyUrl(appliance.id);
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}iframe=true`;
    }
}

// Singleton-Export
export default new ProxyService();
