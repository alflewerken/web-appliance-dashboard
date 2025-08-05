package com.dashboard.guacamole.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT Token Validator für Dashboard-Authentifizierung
 */
public class JWTValidator {
    
    private static final Logger logger = LoggerFactory.getLogger(JWTValidator.class);
    
    private final SecretKey secretKey;
    
    public JWTValidator() {
        // JWT Secret aus Umgebungsvariable oder Konfiguration
        String jwtSecret = System.getenv("JWT_SECRET");
        if (jwtSecret == null || jwtSecret.isEmpty()) {
            // Fallback auf Standard-Secret (nur für Entwicklung!)
            jwtSecret = "BkwjTqg+LYnBXlibieVm8k4jEeYSPLroceS3MQYQjJEcVGZrTLGbAFoLHqG+Pj0G4xx5lbfQNCZg8XL2kZoNdQ==";
            logger.warn("Using default JWT secret - CHANGE IN PRODUCTION!");
        }
        
        this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
    
    /**
     * Validiert JWT Token und extrahiert Claims
     */
    public JWTClaims validateToken(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                .setSigningKey(secretKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
            
            // Prüfe Ablaufzeit
            Date expiration = claims.getExpiration();
            if (expiration != null && expiration.before(new Date())) {
                logger.warn("Token expired");
                return null;
            }
            
            // Extrahiere relevante Claims
            String username = claims.get("username", String.class);
            if (username == null) {
                username = claims.getSubject();
            }
            
            String userId = String.valueOf(claims.get("userId"));
            String applianceId = claims.get("applianceId", String.class);
            String hostId = claims.get("hostId", String.class);
            String connectionId = String.valueOf(claims.get("connectionId"));
            String type = claims.get("type", String.class);
            
            // Validiere erforderliche Felder basierend auf Typ
            if (username == null) {
                logger.warn("Missing username in token");
                return null;
            }
            
            // Host-Token oder Appliance-Token
            if ("host-remote-desktop".equals(type) && hostId != null) {
                // Host-basierter Token
                return new JWTClaims(username, userId, null, hostId, connectionId, type);
            } else if (applianceId != null) {
                // Appliance-basierter Token
                return new JWTClaims(username, userId, applianceId, null, connectionId, "appliance");
            }
            
            logger.warn("Neither hostId nor applianceId found in token");
            return null;
            
        } catch (Exception e) {
            logger.error("Token validation failed", e);
            return null;
        }
    }
    
    /**
     * Container für JWT Claims
     */
    public static class JWTClaims {
        private final String username;
        private final String userId;
        private final String applianceId;
        private final String hostId;
        private final String connectionId;
        private final String type;
        
        public JWTClaims(String username, String userId, String applianceId, 
                        String hostId, String connectionId, String type) {
            this.username = username;
            this.userId = userId;
            this.applianceId = applianceId;
            this.hostId = hostId;
            this.connectionId = connectionId;
            this.type = type;
        }
        
        public String getUsername() { return username; }
        public String getUserId() { return userId; }
        public String getApplianceId() { return applianceId; }
        public String getHostId() { return hostId; }
        public String getConnectionId() { return connectionId; }
        public String getType() { return type; }
        public boolean isHostToken() { return "host-remote-desktop".equals(type); }
    }
}