package com.dashboard.guacamole.auth;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.*;
import org.apache.guacamole.net.auth.simple.SimpleConnectionDirectory;
import org.apache.guacamole.net.auth.simple.SimpleDirectory;
import org.apache.guacamole.net.auth.simple.SimpleUser;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * User Context für Dashboard-authentifizierte Benutzer
 */
public class DashboardUserContext implements UserContext {
    
    private static final Logger logger = LoggerFactory.getLogger(DashboardUserContext.class);
    
    private final AuthenticationProvider authProvider;
    private final DashboardAuthenticatedUser authenticatedUser;
    private final String username;
    private final Directory<Connection> connectionDirectory;
    private final Directory<User> userDirectory;
    private final Directory<UserGroup> userGroupDirectory;
    private final Directory<ConnectionGroup> connectionGroupDirectory;
    private final ConnectionGroup rootGroup;
    
    public DashboardUserContext(AuthenticationProvider authProvider,
                               DashboardAuthenticatedUser authenticatedUser,
                               ConnectionProvider connectionProvider) throws GuacamoleException {
        
        this.authProvider = authProvider;
        this.authenticatedUser = authenticatedUser;
        this.username = authenticatedUser.getIdentifier();
        
        // Lade Verbindungen basierend auf Token-Typ
        Map<String, GuacamoleConfiguration> configs;
        
        if (authenticatedUser.isHostToken()) {
            // Host-basierte Verbindungen
            configs = connectionProvider.getConnectionsForHost(authenticatedUser.getHostId());
        } else {
            // Appliance-basierte Verbindungen
            configs = connectionProvider.getConnectionsForAppliance(authenticatedUser.getApplianceId());
        }
        
        // Erstelle Connection-Objekte
        Map<String, Connection> connections = new HashMap<>();
        for (Map.Entry<String, GuacamoleConfiguration> entry : configs.entrySet()) {
            String id = entry.getKey();
            GuacamoleConfiguration config = entry.getValue();
            
            DashboardConnection connection = new DashboardConnection(id, config);
            connections.put(id, connection);
        }
        
        // Initialisiere Directories
        this.connectionDirectory = new SimpleConnectionDirectory(connections.values());
        
        // User Directory mit aktuellem User
        Map<String, User> users = new HashMap<>();
        SimpleUser user = new SimpleUser(username);
        user.setPassword(""); // Kein Passwort nötig, da JWT-Auth
        users.put(username, user);
        this.userDirectory = new SimpleDirectory<>(users);
        
        // Leere UserGroup und ConnectionGroup Directories
        this.userGroupDirectory = new SimpleDirectory<>(Collections.emptyMap());
        this.connectionGroupDirectory = new SimpleDirectory<>(Collections.emptyMap());
        
        // Root Connection Group
        this.rootGroup = new SimpleConnectionGroup(
            "ROOT",
            "ROOT",
            new HashSet<>(connections.keySet()),
            Collections.emptySet()
        );
        
        logger.info("Created user context for {} with {} connections (type: {})", 
                    username, connections.size(), 
                    authenticatedUser.isHostToken() ? "host" : "appliance");
    }
    
    @Override
    public User self() {
        try {
            return userDirectory.get(username);
        } catch (GuacamoleException e) {
            logger.error("Failed to get user", e);
            return null;
        }
    }
    
    @Override
    public Object getResource() throws GuacamoleException {
        return null;
    }
    
    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }
    
    @Override
    public Directory<User> getUserDirectory() throws GuacamoleException {
        return userDirectory;
    }
    
    @Override
    public Directory<UserGroup> getUserGroupDirectory() throws GuacamoleException {
        return userGroupDirectory;
    }
    
    @Override
    public Directory<Connection> getConnectionDirectory() throws GuacamoleException {
        return connectionDirectory;
    }
    
    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory() throws GuacamoleException {
        return connectionGroupDirectory;
    }
    
    @Override
    public ConnectionGroup getRootConnectionGroup() throws GuacamoleException {
        return rootGroup;
    }
    
    @Override
    public Directory<ActiveConnection> getActiveConnectionDirectory() throws GuacamoleException {
        return new SimpleDirectory<>(Collections.emptyMap());
    }
    
    @Override
    public Directory<SharingProfile> getSharingProfileDirectory() throws GuacamoleException {
        return new SimpleDirectory<>(Collections.emptyMap());
    }
    
    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory() throws GuacamoleException {
        return new SimpleActivityRecordSet<>();
    }
    
    @Override
    public ActivityRecordSet<ActivityRecord> getUserHistory() throws GuacamoleException {
        return new SimpleActivityRecordSet<>();
    }
    
    @Override
    public Collection<Form> getUserAttributes() {
        return Collections.emptyList();
    }
    
    @Override
    public Collection<Form> getUserGroupAttributes() {
        return Collections.emptyList();
    }
    
    @Override
    public Collection<Form> getConnectionAttributes() {
        return Collections.emptyList();
    }
    
    @Override
    public Collection<Form> getConnectionGroupAttributes() {
        return Collections.emptyList();
    }
    
    @Override
    public Collection<Form> getSharingProfileAttributes() {
        return Collections.emptyList();
    }
    
    @Override
    public void invalidate() {
        // Nichts zu tun
    }
    
    /**
     * Einfache ActivityRecordSet-Implementierung
     */
    private static class SimpleActivityRecordSet<T extends ActivityRecord> 
            implements ActivityRecordSet<T> {
        
        @Override
        public Collection<T> asCollection() throws GuacamoleException {
            return Collections.emptyList();
        }
        
        @Override
        public ActivityRecordSet<T> contains(String value) throws GuacamoleException {
            return this;
        }
        
        @Override
        public ActivityRecordSet<T> limit(int limit) throws GuacamoleException {
            return this;
        }
        
        @Override
        public ActivityRecordSet<T> sort(SortableProperty property, boolean desc) 
                throws GuacamoleException {
            return this;
        }
    }
    
    /**
     * Einfache ConnectionGroup-Implementierung
     */
    private static class SimpleConnectionGroup extends AbstractConnectionGroup {
        
        private final String identifier;
        private final String name;
        private final Set<String> connectionIdentifiers;
        private final Set<String> childGroupIdentifiers;
        
        public SimpleConnectionGroup(String identifier, String name,
                                   Set<String> connectionIdentifiers,
                                   Set<String> childGroupIdentifiers) {
            this.identifier = identifier;
            this.name = name;
            this.connectionIdentifiers = connectionIdentifiers;
            this.childGroupIdentifiers = childGroupIdentifiers;
            setType(Type.ORGANIZATIONAL);
        }
        
        @Override
        public int getActiveConnections() {
            return 0;
        }
        
        @Override
        public GuacamoleTunnel connect(GuacamoleClientInformation info, 
                                      Map<String, String> tokens) throws GuacamoleException {
            throw new GuacamoleException("Connection through group not supported");
        }
        
        @Override
        public String getIdentifier() {
            return identifier;
        }
        
        @Override
        public void setIdentifier(String identifier) {
            throw new UnsupportedOperationException();
        }
        
        @Override
        public String getName() {
            return name;
        }
        
        @Override
        public void setName(String name) {
            throw new UnsupportedOperationException();
        }
        
        @Override
        public Set<String> getConnectionIdentifiers() throws GuacamoleException {
            return new HashSet<>(connectionIdentifiers);
        }
        
        @Override
        public Set<String> getConnectionGroupIdentifiers() throws GuacamoleException {
            return new HashSet<>(childGroupIdentifiers);
        }
        
        @Override
        public Map<String, String> getAttributes() {
            return Collections.emptyMap();
        }
        
        @Override
        public void setAttributes(Map<String, String> attributes) {
            // Ignoriere Attribut-Änderungen
        }
    }
}