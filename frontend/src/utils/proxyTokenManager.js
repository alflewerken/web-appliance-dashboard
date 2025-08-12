// Utility für sichere Token-Übertragung bei Proxy-Requests
class ProxyTokenManager {
    /**
     * Setzt ein temporäres Cookie mit dem Auth-Token
     * Das Cookie wird nur für die aktuelle Session gesetzt
     */
    static setAuthCookie() {
        const token = localStorage.getItem('token');
        if (token) {
            // Setze Cookie mit SameSite=Lax für Cross-Origin-Requests
            document.cookie = `token=${token}; path=/; SameSite=Lax`;

            return true;
        }
        console.warn('[ProxyTokenManager] Kein Token im localStorage gefunden');
        return false;
    }
    
    /**
     * Entfernt das Auth-Cookie
     */
    static removeAuthCookie() {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

    }
    
    /**
     * Überprüft ob ein Token vorhanden ist
     */
    static hasToken() {
        return !!localStorage.getItem('token');
    }
    
    /**
     * Gibt das aktuelle Token zurück
     */
    static getToken() {
        return localStorage.getItem('token');
    }
}

export default ProxyTokenManager;
