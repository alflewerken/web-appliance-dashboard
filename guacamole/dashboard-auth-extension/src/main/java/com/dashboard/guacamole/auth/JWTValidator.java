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
            String username = claims.getSubject();
            String userId = claims.get("userId", String.class);
            String applianceId = claims.get("applianceId", String.class);
            String connectionId = claims.get("connectionId", String.class);
            
            // Validiere erforderliche Felder
            if (username == null || applianceId == null) {
                logger.warn("Missing required claims in token");
                return null;
            }
            
            return new JWTClaims(username, userId, applianceId, connectionId);
            
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
        private final String connectionId;
        
        public JWTClaims(String username, String userId, String applianceId, String connectionId) {
            this.username = username;
            this.userId = userId;
            this.applianceId = applianceId;
            this.connectionId = connectionId;
        }
        
        public String getUsername() { return username; }
        public String getUserId() { return userId; }
        public String getApplianceId() { return applianceId; }
        public String getConnectionId() { return connectionId; }
    }
}