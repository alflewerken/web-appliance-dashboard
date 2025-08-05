package com.dashboard.guacamole.auth;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;

import javax.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * JWT-basierte Authentifizierungs-Extension für nahtlose Dashboard-Integration.
 * Ermöglicht Single Sign-On über JWT-Token.
 */
public class DashboardAuthenticationProvider extends AbstractAuthenticationProvider {
    
    private static final Logger logger = LoggerFactory.getLogger(DashboardAuthenticationProvider.class);
    
    private final JWTValidator jwtValidator;
    private final ConnectionProvider connectionProvider;
    
    public DashboardAuthenticationProvider() {
        this.jwtValidator = new JWTValidator();
        this.connectionProvider = new ConnectionProvider();
    }
    
    @Override
    public String getIdentifier() {
        return "dashboard-auth";
    }
    
    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials) throws GuacamoleException {
        HttpServletRequest request = credentials.getRequest();
        
        // JWT Token aus verschiedenen Quellen holen
        String token = extractToken(request);
        
        if (token == null || token.isEmpty()) {
            logger.debug("No JWT token provided");
            return null;
        }
        
        try {
            // Token validieren und User-Daten extrahieren
            JWTValidator.JWTClaims claims = jwtValidator.validateToken(token);
            
            if (claims == null) {
                logger.warn("Invalid JWT token");
                return null;
            }
            
            logger.info("Successfully authenticated user: {}", claims.getUsername());
            
            // AuthenticatedUser erstellen
            return new DashboardAuthenticatedUser(
                credentials,
                claims.getUsername(),
                claims.getUserId(),
                claims.getApplianceId(),
                claims.getHostId(),
                claims.getConnectionId(),
                claims.getType(),
                this
            );
            
        } catch (Exception e) {
            logger.error("Authentication error", e);
            throw new GuacamoleInvalidCredentialsException(
                "Authentication failed", CredentialsInfo.USERNAME_PASSWORD
            );
        }
    }
    
    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser) throws GuacamoleException {
        if (!(authenticatedUser instanceof DashboardAuthenticatedUser)) {
            return null;
        }
        
        DashboardAuthenticatedUser dashboardUser = (DashboardAuthenticatedUser) authenticatedUser;
        
        logger.debug("Creating user context for user: {}", dashboardUser.getIdentifier());
        
        // UserContext mit Verbindungen für diesen User erstellen
        return new DashboardUserContext(
            this,
            dashboardUser,
            connectionProvider
        );
    }
    
    /**
     * Extrahiert JWT Token aus verschiedenen Quellen
     */
    private String extractToken(HttpServletRequest request) {
        // 1. Query Parameter
        String token = request.getParameter("token");
        if (token != null && !token.isEmpty()) {
            return token;
        }
        
        // 2. Authorization Header
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        
        // 3. Custom Header
        token = request.getHeader("X-Dashboard-Token");
        if (token != null && !token.isEmpty()) {
            return token;
        }
        
        return null;
    }
}