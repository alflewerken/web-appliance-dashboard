package com.dashboard.guacamole.auth;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Minimal test authentication provider
 */
public class TestAuthenticationProvider extends AbstractAuthenticationProvider {
    
    private static final Logger logger = LoggerFactory.getLogger(TestAuthenticationProvider.class);
    
    @Override
    public String getIdentifier() {
        logger.info("TestAuthenticationProvider getIdentifier() called");
        return "test-auth";
    }
    
    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials) throws GuacamoleException {
        logger.info("TestAuthenticationProvider authenticateUser() called");
        return null;
    }
}