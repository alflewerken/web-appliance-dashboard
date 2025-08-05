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
    private final String hostId;
    private final String connectionId;
    private final String type;
    private final AuthenticationProvider authProvider;
    private final Credentials credentials;
    
    public DashboardAuthenticatedUser(Credentials credentials, String username, 
                                     String userId, String applianceId, String hostId,
                                     String connectionId, String type,
                                     AuthenticationProvider authProvider) {
        this.credentials = credentials;
        this.username = username;
        this.userId = userId;
        this.applianceId = applianceId;
        this.hostId = hostId;
        this.connectionId = connectionId;
        this.type = type;
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
    
    public String getHostId() {
        return hostId;
    }
    
    public String getConnectionId() {
        return connectionId;
    }
    
    public String getType() {
        return type;
    }
    
    public boolean isHostToken() {
        return "host-remote-desktop".equals(type);
    }
}