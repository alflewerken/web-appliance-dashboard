package com.dashboard.guacamole.auth;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.*;
import java.util.HashMap;
import java.util.Map;

/**
 * Lädt Remote Desktop Verbindungsdaten aus der Dashboard-Datenbank
 */
public class ConnectionProvider {
    
    private static final Logger logger = LoggerFactory.getLogger(ConnectionProvider.class);
    
    private final String dbUrl;
    private final String dbUser;
    private final String dbPassword;
    
    public ConnectionProvider() {
        // Datenbank-Konfiguration aus Umgebungsvariablen
        String dbHost = System.getenv("DB_HOST");
        String dbPort = System.getenv("DB_PORT");
        String dbName = System.getenv("DB_NAME");
        
        if (dbHost == null) dbHost = "database";
        if (dbPort == null) dbPort = "3306";
        if (dbName == null) dbName = "appliance_dashboard";
        
        this.dbUrl = String.format("jdbc:mysql://%s:%s/%s", dbHost, dbPort, dbName);
        
        String tempUser = System.getenv("DB_USER");
        String tempPassword = System.getenv("DB_PASSWORD");
        
        this.dbUser = (tempUser != null) ? tempUser : "dashboard_user";
        this.dbPassword = (tempPassword != null) ? tempPassword : "xF40lexuP7qe1fb8MkkW40bXdXd+jrCe";
    }
    
    /**
     * Lädt Verbindungskonfiguration für eine Appliance
     */
    public Map<String, GuacamoleConfiguration> getConnectionsForAppliance(String applianceId) 
            throws GuacamoleException {
        
        Map<String, GuacamoleConfiguration> connections = new HashMap<>();
        
        String query = "SELECT s.name, s.config " +
                      "FROM services s " +
                      "JOIN appliances a ON s.appliance_id = a.id " +
                      "WHERE a.id = ? " +
                      "AND s.type IN ('vnc', 'rdp') " +
                      "AND s.enabled = 1";
        
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword);
             PreparedStatement stmt = conn.prepareStatement(query)) {
            
            stmt.setString(1, applianceId);
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String serviceName = rs.getString("name");
                    String configJson = rs.getString("config");
                    
                    GuacamoleConfiguration config = parseServiceConfig(configJson);
                    if (config != null) {
                        String connectionName = "appliance-" + applianceId + "-" + serviceName;
                        connections.put(connectionName, config);
                        logger.debug("Loaded connection: {}", connectionName);
                    }
                }
            }
            
        } catch (SQLException e) {
            logger.error("Failed to load connections from database", e);
            throw new GuacamoleException("Database error", e);
        }
        
        return connections;
    }
    
    /**
     * Parst Service-Konfiguration aus JSON
     */
    private GuacamoleConfiguration parseServiceConfig(String configJson) {
        try {
            // Einfaches JSON-Parsing (alternativ Jackson verwenden)
            GuacamoleConfiguration config = new GuacamoleConfiguration();
            
            // Extrahiere Werte aus JSON
            String protocol = extractJsonValue(configJson, "protocol");
            String hostname = extractJsonValue(configJson, "hostname");
            String port = extractJsonValue(configJson, "port");
            String username = extractJsonValue(configJson, "username");
            String password = extractJsonValue(configJson, "password");
            
            if (protocol == null || hostname == null) {
                logger.warn("Invalid service config: missing protocol or hostname");
                return null;
            }
            
            config.setProtocol(protocol);
            config.setParameter("hostname", hostname);
            if (port != null) config.setParameter("port", port);
            if (username != null) config.setParameter("username", username);
            if (password != null) config.setParameter("password", password);
            
            // Zusätzliche Parameter je nach Protokoll
            if ("vnc".equals(protocol)) {
                config.setParameter("color-depth", "24");
                config.setParameter("cursor", "remote");
            } else if ("rdp".equals(protocol)) {
                config.setParameter("security", "any");
                config.setParameter("ignore-cert", "true");
                config.setParameter("enable-font-smoothing", "true");
                config.setParameter("enable-desktop-composition", "true");
            }
            
            return config;
            
        } catch (Exception e) {
            logger.error("Failed to parse service config", e);
            return null;
        }
    }
    
    /**
     * Einfacher JSON-Wert-Extraktor
     */
    private String extractJsonValue(String json, String key) {
        String searchKey = "\"" + key + "\":";
        int keyIndex = json.indexOf(searchKey);
        if (keyIndex == -1) return null;
        
        int valueStart = keyIndex + searchKey.length();
        // Skip whitespace
        while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
            valueStart++;
        }
        
        if (valueStart >= json.length()) return null;
        
        // Handle string values
        if (json.charAt(valueStart) == '"') {
            valueStart++;
            int valueEnd = json.indexOf('"', valueStart);
            if (valueEnd == -1) return null;
            return json.substring(valueStart, valueEnd);
        }
        
        // Handle numeric/boolean values
        int valueEnd = valueStart;
        while (valueEnd < json.length() && 
               !",}]".contains(String.valueOf(json.charAt(valueEnd)))) {
            valueEnd++;
        }
        
        return json.substring(valueStart, valueEnd).trim();
    }
}