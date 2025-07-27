/**
 * SessionCache - Connection Pooling und Session Management
 * 
 * Features:
 * - SSH Connection Pooling
 * - VNC/RDP Session Caching
 * - Automatic Cleanup
 * - Performance Monitoring
 */

const { NodeSSH } = require('node-ssh');
const logger = require('./logger');

class SessionCache {
    constructor() {
        this.sshConnections = new Map();
        this.vncSessions = new Map();
        this.sftpSessions = new Map();
        this.connectionStats = new Map();
        
        // Cleanup-Interval (5 Minuten)
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    
    /**
     * SSH Connection Pool Management
     */
    async getSSHConnection(serviceId, config) {
        const key = `ssh-${serviceId}`;
        
        // Existierende Connection prüfen
        if (this.sshConnections.has(key)) {
            const conn = this.sshConnections.get(key);
            if (conn.isConnected()) {
                this.updateStats(key, 'hit');
                return conn;
            } else {
                // Tote Connection entfernen
                this.sshConnections.delete(key);
            }
        }
        
        // Neue Connection erstellen
        this.updateStats(key, 'miss');
        const ssh = new NodeSSH();
        
        try {
            await ssh.connect({
                host: config.hostname,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
                passphrase: config.passphrase,
                tryKeyboard: true,
                readyTimeout: 10000,
                keepaliveInterval: 5000,
                keepaliveCountMax: 3
            });
            
            this.sshConnections.set(key, ssh);
            logger.info(`SSH connection established for service ${serviceId}`);
            
            return ssh;
        } catch (error) {
            logger.error(`SSH connection failed for service ${serviceId}:`, error);
            throw error;
        }
    }
    
    /**
     * SFTP Session Management
     */
    async getSFTPSession(serviceId, sshConnection) {
        const key = `sftp-${serviceId}`;
        
        if (this.sftpSessions.has(key)) {
            const session = this.sftpSessions.get(key);
            if (session.isActive) {
                this.updateStats(key, 'hit');
                return session.sftp;
            }
        }
        
        this.updateStats(key, 'miss');
        
        try {
            const sftp = await sshConnection.requestSFTP();
            
            this.sftpSessions.set(key, {
                sftp,
                isActive: true,
                created: new Date(),
                lastAccess: new Date()
            });
            
            return sftp;
        } catch (error) {
            logger.error(`SFTP session creation failed:`, error);
            throw error;
        }
    }
    
    /**
     * VNC/RDP Session Cache
     */
    getVNCSession(serviceId, config) {
        const key = `vnc-${serviceId}`;
        
        if (this.vncSessions.has(key)) {
            const session = this.vncSessions.get(key);
            if (this.isSessionValid(session)) {
                this.updateStats(key, 'hit');
                session.lastAccess = new Date();
                return session;
            }
        }
        
        this.updateStats(key, 'miss');
        
        const newSession = {
            id: `${serviceId}-${Date.now()}`,
            config,
            created: new Date(),
            lastAccess: new Date(),
            active: true
        };
        
        this.vncSessions.set(key, newSession);
        return newSession;
    }
    
    /**
     * Session-Validierung
     */
    isSessionValid(session) {
        const maxAge = 30 * 60 * 1000; // 30 Minuten
        const age = Date.now() - session.created.getTime();
        
        return session.active && age < maxAge;
    }
    
    /**
     * Connection-Statistiken
     */
    updateStats(key, type) {
        if (!this.connectionStats.has(key)) {
            this.connectionStats.set(key, {
                hits: 0,
                misses: 0,
                errors: 0,
                lastAccess: new Date()
            });
        }
        
        const stats = this.connectionStats.get(key);
        stats[type === 'hit' ? 'hits' : 'misses']++;
        stats.lastAccess = new Date();
    }
    
    /**
     * Cleanup alter Connections
     */
    async cleanup() {
        const maxAge = 15 * 60 * 1000; // 15 Minuten Inaktivität
        const now = Date.now();
        
        // SSH Connections
        for (const [key, conn] of this.sshConnections.entries()) {
            const stats = this.connectionStats.get(key);
            if (stats && (now - stats.lastAccess.getTime() > maxAge)) {
                try {
                    conn.dispose();
                } catch (error) {
                    logger.error(`Error disposing SSH connection:`, error);
                }
                this.sshConnections.delete(key);
                logger.debug(`Cleaned up SSH connection ${key}`);
            }
        }
        
        // SFTP Sessions
        for (const [key, session] of this.sftpSessions.entries()) {
            if (now - session.lastAccess.getTime() > maxAge) {
                this.sftpSessions.delete(key);
                logger.debug(`Cleaned up SFTP session ${key}`);
            }
        }
        
        // VNC Sessions
        for (const [key, session] of this.vncSessions.entries()) {
            if (!this.isSessionValid(session)) {
                this.vncSessions.delete(key);
                logger.debug(`Cleaned up VNC session ${key}`);
            }
        }
    }
    
    /**
     * Performance-Metriken abrufen
     */
    getMetrics() {
        const metrics = {
            connections: {
                ssh: this.sshConnections.size,
                sftp: this.sftpSessions.size,
                vnc: this.vncSessions.size
            },
            stats: {}
        };
        
        for (const [key, stats] of this.connectionStats.entries()) {
            const hitRate = stats.hits / (stats.hits + stats.misses) || 0;
            metrics.stats[key] = {
                ...stats,
                hitRate: Math.round(hitRate * 100) + '%'
            };
        }
        
        return metrics;
    }
    
    /**
     * Alle Connections schließen (für Shutdown)
     */
    async closeAll() {
        logger.info('Closing all cached connections...');
        
        // SSH Connections schließen
        for (const [key, conn] of this.sshConnections.entries()) {
            try {
                conn.dispose();
            } catch (error) {
                logger.error(`Error closing SSH connection ${key}:`, error);
            }
        }
        
        this.sshConnections.clear();
        this.sftpSessions.clear();
        this.vncSessions.clear();
        this.connectionStats.clear();
        
        logger.info('All connections closed');
    }
}

module.exports = new SessionCache();