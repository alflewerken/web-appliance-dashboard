package com.dashboard.guacamole.auth;

import org.apache.guacamole.net.auth.AbstractAuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Authenticated User für Dashboard-Integration
 */
public class DashboardAuthenticatedUser extends AbstractAuthenticatedUser {
    
    private final String username;
    private final String userId;
    private final String applianceId;
    private final AuthenticationProvider authProvider;
    private final Credentials credentials;
    
    public DashboardAuthenticatedUser(Credentials credentials, String username, 
                                     String userId, String applianceId,
                                     AuthenticationProvider authProvider) {
        this.credentials = credentials;
        this.username = username;
        this.userId = userId;
        this.applianceId = applianceId;
        this.authProvider = authProvider;
    }
    
    @Override
    public String getIdentifier() {
        return username;
    }
    
    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }
    
    @Override
    public Credentials getCredentials() {
        return credentials;
    }
    
    public String getUserId() {
        return userId;
    }
    
    public String getApplianceId() {
        return applianceId;
    }
}