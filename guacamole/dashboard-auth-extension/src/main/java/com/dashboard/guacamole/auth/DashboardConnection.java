package com.dashboard.guacamole.auth;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.AbstractConnection;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

import java.util.Collections;
import java.util.Date;
import java.util.Map;

/**
 * Connection-Implementierung für Dashboard-Verbindungen
 */
public class DashboardConnection extends AbstractConnection {
    
    private final String identifier;
    private final GuacamoleConfiguration configuration;
    
    public DashboardConnection(String identifier, GuacamoleConfiguration configuration) {
        this.identifier = identifier;
        this.configuration = configuration;
        
        // Setze Connection-Name
        setName(identifier);
        setParentIdentifier("ROOT");
    }
    
    @Override
    public String getIdentifier() {
        return identifier;
    }
    
    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("Connection identifier is immutable");
    }
    
    @Override
    public GuacamoleConfiguration getConfiguration() {
        // Kopie zurückgeben um Änderungen zu verhindern
        GuacamoleConfiguration copy = new GuacamoleConfiguration();
        copy.setProtocol(configuration.getProtocol());
        
        for (Map.Entry<String, String> param : configuration.getParameters().entrySet()) {
            copy.setParameter(param.getKey(), param.getValue());
        }
        
        return copy;
    }
    
    @Override
    public void setConfiguration(GuacamoleConfiguration configuration) {
        throw new UnsupportedOperationException("Connection configuration is immutable");
    }
    
    @Override
    public Map<String, String> getAttributes() {
        return Collections.emptyMap();
    }
    
    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Ignoriere Attribut-Änderungen
    }
    
    @Override
    public Date getLastActive() {
        return null;
    }
    
    @Override
    public int getActiveConnections() {
        return 0;
    }
    
    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info, Map<String, String> tokens) 
            throws GuacamoleException {
        // Die eigentliche Tunnel-Erstellung wird von Guacamole übernommen
        return null;
    }
}