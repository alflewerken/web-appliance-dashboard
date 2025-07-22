/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: |
 *       Authentifizierungs- und Autorisierungsendpunkte für die Benutzerverwaltung.
 *       
 *       Das System verwendet JWT (JSON Web Tokens) für die sichere Authentifizierung.
 *       Nach erfolgreicher Anmeldung erhalten Sie einen Token, der bei allen weiteren
 *       API-Aufrufen im Authorization-Header mitgesendet werden muss.
 *       
 *       **Token-Lebensdauer**: 24 Stunden (konfigurierbar)
 *       
 *       **Rate Limiting**: 20 Anmeldeversuche pro 15 Minuten pro IP-Adresse
 *   
 *   - name: Appliances
 *     description: |
 *       Verwaltung von Web-Appliances und Services.
 *       
 *       Appliances sind die Kernelemente des Dashboards. Jede Appliance repräsentiert
 *       einen Service, eine Webanwendung oder einen Server, der über das Dashboard
 *       verwaltet werden kann.
 *       
 *       **Features**:
 *       - Statusüberwachung (Online/Offline)
 *       - Service-Kontrolle (Start/Stop/Restart)
 *       - SSH-Integration für Remote-Verwaltung
 *       - Remote Desktop Zugriff (VNC/RDP)
 *       - Kategorisierung und Favoriten
 *       - Anpassbare UI-Einstellungen pro Appliance
 *   
 *   - name: Categories
 *     description: |
 *       Organisation von Appliances in Kategorien.
 *       
 *       Kategorien ermöglichen die logische Gruppierung von Appliances für eine
 *       bessere Übersichtlichkeit. Das System enthält vordefinierte Systemkategorien
 *       sowie die Möglichkeit, eigene Kategorien zu erstellen.
 *       
 *       **Systemkategorien**:
 *       - productivity: Produktivitäts-Tools
 *       - development: Entwicklungsumgebungen
 *       - monitoring: Überwachungs-Tools
 *       - media: Medien-Services
 *       - network: Netzwerk-Tools
 *       - security: Sicherheits-Tools
 *   
 *   - name: SSH Management
 *     description: |
 *       Verwaltung von SSH-Verbindungen und Schlüsseln.
 *       
 *       Das integrierte SSH-Management ermöglicht die sichere Verwaltung von
 *       SSH-Schlüsseln und die direkte Verbindung zu Remote-Systemen über das
 *       Web-Terminal.
 *       
 *       **Sicherheitsfeatures**:
 *       - Verschlüsselte Speicherung privater Schlüssel
 *       - Automatische Schlüsselgenerierung
 *       - SSH-Key Deployment auf Remote-Hosts
 *       - Integriertes Web-Terminal mit SSH-Support
 *   
 *   - name: Services
 *     description: |
 *       Systemdienste-Verwaltung über SSH.
 *       
 *       Ermöglicht die Remote-Verwaltung von Systemdiensten auf verbundenen
 *       Hosts. Unterstützt systemd, init.d und andere Service-Manager.
 *       
 *       **Unterstützte Operationen**:
 *       - Service-Status abfragen
 *       - Services starten/stoppen/neustarten
 *       - Autostart aktivieren/deaktivieren
 *       - Service-Logs einsehen
 *   
 *   - name: Settings
 *     description: |
 *       Systemeinstellungen und Konfiguration.
 *       
 *       Zentrale Verwaltung aller Systemeinstellungen, Feature-Flags und
 *       Konfigurationsoptionen.
 *       
 *       **Konfigurierbare Bereiche**:
 *       - SSH-Features ein/ausschalten
 *       - Backup-Einstellungen
 *       - UI-Anpassungen
 *       - Sicherheitseinstellungen
 *       - Feature-Toggles
 *   
 *   - name: Backup & Restore
 *     description: |
 *       Datensicherung und Wiederherstellung.
 *       
 *       Umfassende Backup-Funktionalität für die komplette Systemkonfiguration
 *       inklusive selektiver Wiederherstellung.
 *       
 *       **Backup umfasst**:
 *       - Alle Appliance-Konfigurationen
 *       - Kategorien und Einstellungen
 *       - Benutzer und Rollen (ohne Passwörter)
 *       - SSH-Hosts und öffentliche Schlüssel
 *       - Audit-Logs
 *       - Hintergrundbilder
 *       
 *       **Restore-Optionen**:
 *       - Vollständige Wiederherstellung
 *       - Selektive Wiederherstellung einzelner Bereiche
 *       - Merge-Modus (bestehende Daten beibehalten)
 *       - Replace-Modus (bestehende Daten überschreiben)
 *   
 *   - name: Audit Logs
 *     description: |
 *       Protokollierung aller systemrelevanten Aktionen.
 *       
 *       Das Audit-System protokolliert alle wichtigen Aktionen im System für
 *       Compliance, Sicherheit und Nachvollziehbarkeit.
 *       
 *       **Protokollierte Aktionen**:
 *       - Benutzer-Logins und Logouts
 *       - CRUD-Operationen auf allen Ressourcen
 *       - Konfigurationsänderungen
 *       - SSH-Verbindungen und Kommandos
 *       - Backup- und Restore-Vorgänge
 *       
 *       **Features**:
 *       - Zeitbasierte Filterung
 *       - Export als CSV
 *       - Detaillierte Änderungshistorie
 *       - Wiederherstellung gelöschter Elemente
 *   
 *   - name: Remote Desktop
 *     description: |
 *       Remote Desktop Zugriff über Apache Guacamole.
 *       
 *       Integration von Apache Guacamole für browserbasierten Remote Desktop
 *       Zugriff auf VNC und RDP Systeme.
 *       
 *       **Unterstützte Protokolle**:
 *       - VNC (Virtual Network Computing)
 *       - RDP (Remote Desktop Protocol)
 *       - SSH (als Terminal)
 *       
 *       **Sicherheit**:
 *       - Token-basierte Authentifizierung
 *       - Zeitlich begrenzte Zugriffs-Token
 *       - Automatische Session-Bereinigung
 *   
 *   - name: Terminal
 *     description: |
 *       Web-basiertes Terminal für SSH-Verbindungen.
 *       
 *       Vollwertiges Terminal im Browser mit Unterstützung für alle gängigen
 *       Terminal-Features.
 *       
 *       **Features**:
 *       - Vollständige ANSI-Farb-Unterstützung
 *       - Copy & Paste Support
 *       - Resize-fähig
 *       - Session-Persistenz
 *       - Multi-Tab Support
 *   
 *   - name: Status Monitoring
 *     description: |
 *       Echtzeit-Statusüberwachung von Appliances.
 *       
 *       Kontinuierliche Überwachung der Verfügbarkeit aller konfigurierten
 *       Appliances mit Benachrichtigungen bei Statusänderungen.
 *       
 *       **Monitoring-Features**:
 *       - HTTP/HTTPS Health Checks
 *       - Response-Zeit Messung
 *       - Verfügbarkeits-Historie
 *       - Server-Sent Events für Echtzeit-Updates
 *       - Bulk-Status-Checks
 *   
 *   - name: User Management
 *     description: |
 *       Benutzerverwaltung und Rechtesystem.
 *       
 *       Rollenbasierte Zugriffskontrolle (RBAC) für die Verwaltung von
 *       Benutzern und deren Berechtigungen.
 *       
 *       **Rollen**:
 *       - Admin: Vollzugriff auf alle Funktionen
 *       - User: Eingeschränkter Zugriff
 *       - Viewer: Nur-Lese-Zugriff
 *       
 *       **Features**:
 *       - Passwort-Policies
 *       - Account-Sperrung
 *       - Session-Management
 *       - Aktivitäts-Tracking
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Benutzeranmeldung
 *     tags: [Authentication]
 *     description: |
 *       Authentifiziert einen Benutzer und gibt einen JWT-Token zurück.
 *       
 *       Der Token muss bei allen weiteren API-Aufrufen im Authorization-Header
 *       mitgesendet werden: `Authorization: Bearer <token>`
 *       
 *       **Sicherheit**:
 *       - Passwörter werden mit bcrypt gehasht
 *       - Rate Limiting: 20 Versuche pro 15 Minuten
 *       - Token-Gültigkeit: 24 Stunden
 *       
 *       **Fehlerbehandlung**:
 *       - 401: Ungültige Anmeldedaten
 *       - 429: Zu viele Anmeldeversuche
 *       - 423: Account gesperrt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             admin:
 *               summary: Admin-Login
 *               value:
 *                 username: admin
 *                 password: admin123
 *             user:
 *               summary: Normaler Benutzer
 *               value:
 *                 username: user
 *                 password: user123
 *     responses:
 *       200:
 *         description: Erfolgreiche Anmeldung
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 id: 1
 *                 username: "admin"
 *                 role: "admin"
 *                 lastLogin: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Ungültige Anmeldedaten
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid username or password"
 *       429:
 *         description: Zu viele Anmeldeversuche
 *         content:
 *           application/json:
 *             example:
 *               error: "Too many login attempts. Please try again later."
 *               retryAfter: 900
 */

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Token-Validierung
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Überprüft die Gültigkeit des aktuellen JWT-Tokens und gibt
 *       Benutzerinformationen zurück.
 *       
 *       Dieser Endpoint wird typischerweise beim Laden der Anwendung
 *       aufgerufen, um zu prüfen, ob der gespeicherte Token noch gültig ist.
 *     responses:
 *       200:
 *         description: Token ist gültig
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: "admin"
 *                     role:
 *                       type: string
 *                       example: "admin"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-16T10:30:00Z"
 *       401:
 *         description: Token ungültig oder abgelaufen
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid or expired token"
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Benutzerabmeldung
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Meldet den aktuellen Benutzer ab und invalidiert den Token.
 *       
 *       **Hinweis**: Da JWTs zustandslos sind, wird der Token serverseitig
 *       auf eine Blacklist gesetzt, bis er abläuft.
 *     responses:
 *       200:
 *         description: Erfolgreich abgemeldet
 *         content:
 *           application/json:
 *             example:
 *               message: "Logout successful"
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Token erneuern
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Erneuert einen gültigen Token vor Ablauf.
 *       
 *       Sollte aufgerufen werden, bevor der aktuelle Token abläuft,
 *       um eine unterbrechungsfreie Nutzung zu gewährleisten.
 *     responses:
 *       200:
 *         description: Neuer Token generiert
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token ungültig oder bereits abgelaufen
 */
/**
 * @swagger
 * /api/appliances:
 *   get:
 *     summary: Alle Appliances abrufen
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft eine Liste aller konfigurierten Appliances ab.
 *       
 *       Die Antwort enthält alle Appliances mit ihren vollständigen
 *       Konfigurationen, inklusive SSH-Verbindungsdaten und UI-Einstellungen.
 *       
 *       **Sortierung**: Appliances werden nach Kategorie und Name sortiert
 *       **Filterung**: Aktuell keine serverseitige Filterung (Client-seitig)
 *     responses:
 *       200:
 *         description: Liste aller Appliances
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appliance'
 *             example:
 *               - id: 1
 *                 name: "Produktions-Server"
 *                 url: "https://prod.example.com"
 *                 description: "Haupt-Produktionsserver"
 *                 category: "productivity"
 *                 icon: "Server"
 *                 color: "#007AFF"
 *                 isFavorite: true
 *                 statusCommand: "systemctl status nginx"
 *                 sshConnection: "deploy@prod.example.com"
 *                 remoteDesktopEnabled: true
 *                 remoteProtocol: "vnc"
 *                 lastStatusCheck: "2024-01-15T10:30:00Z"
 *                 status: "online"
 *       401:
 *         description: Nicht authentifiziert
 *       500:
 *         description: Serverfehler
 *         content:
 *           application/json:
 *             example:
 *               error: "Failed to fetch appliances"
 *               details: "Database connection error"
 */

/**
 * @swagger
 * /api/appliances/{id}:
 *   get:
 *     summary: Einzelne Appliance abrufen
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft die Details einer spezifischen Appliance ab.
 *       
 *       Enthält alle Konfigurationsdaten inklusive sensitiver Informationen
 *       wie SSH-Verbindungsdaten (für berechtigte Benutzer).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der Appliance
 *         example: 1
 *     responses:
 *       200:
 *         description: Appliance-Details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       404:
 *         description: Appliance nicht gefunden
 *         content:
 *           application/json:
 *             example:
 *               error: "Appliance not found"
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/appliances:
 *   post:
 *     summary: Neue Appliance erstellen
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Erstellt eine neue Appliance mit den angegebenen Konfigurationsdaten.
 *       
 *       **Erforderliche Felder**:
 *       - `name`: Eindeutiger Name der Appliance
 *       - `url`: Basis-URL der Appliance
 *       
 *       **Optionale Konfiguration**:
 *       - SSH-Verbindungsdaten für Remote-Verwaltung
 *       - Service-Kontroll-Kommandos
 *       - Remote Desktop Einstellungen
 *       - UI-Anpassungen (Farben, Icons, Transparenz)
 *       
 *       **Validierung**:
 *       - Name muss eindeutig sein
 *       - URL muss gültiges Format haben
 *       - SSH-Connection wird validiert (optional)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplianceCreateRequest'
 *           examples:
 *             minimal:
 *               summary: Minimale Konfiguration
 *               value:
 *                 name: "Test Server"
 *                 url: "http://test.local"
 *             complete:
 *               summary: Vollständige Konfiguration
 *               value:
 *                 name: "Production Server"
 *                 url: "https://prod.example.com"
 *                 description: "Main production server"
 *                 category: "productivity"
 *                 icon: "Server"
 *                 color: "#007AFF"
 *                 sshConnection: "admin@prod.example.com"
 *                 statusCommand: "systemctl status nginx"
 *                 startCommand: "systemctl start nginx"
 *                 stopCommand: "systemctl stop nginx"
 *                 remoteDesktopEnabled: true
 *                 remoteProtocol: "vnc"
 *                 remoteHost: "prod.example.com"
 *                 remotePort: 5900
 *     responses:
 *       201:
 *         description: Appliance erfolgreich erstellt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       400:
 *         description: Ungültige Eingabedaten
 *         content:
 *           application/json:
 *             examples:
 *               duplicate:
 *                 value:
 *                   error: "An appliance with this name already exists"
 *               invalid_url:
 *                 value:
 *                   error: "Invalid URL format"
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/appliances/{id}:
 *   put:
 *     summary: Appliance aktualisieren
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Aktualisiert eine bestehende Appliance.
 *       
 *       Alle Felder sind optional - es werden nur die übergebenen Felder
 *       aktualisiert (Partial Update).
 *       
 *       **Besonderheiten**:
 *       - Bei Änderung der SSH-Verbindung wird die Verbindung getestet
 *       - Bei Änderung von Remote Desktop Einstellungen wird Guacamole aktualisiert
 *       - Änderungen werden im Audit-Log protokolliert
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der zu aktualisierenden Appliance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplianceCreateRequest'
 *           example:
 *             description: "Updated description"
 *             color: "#FF5733"
 *             isFavorite: true
 *     responses:
 *       200:
 *         description: Appliance erfolgreich aktualisiert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       404:
 *         description: Appliance nicht gefunden
 *       400:
 *         description: Ungültige Eingabedaten
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/appliances/{id}:
 *   delete:
 *     summary: Appliance löschen
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Löscht eine Appliance permanent.
 *       
 *       **Wichtig**:
 *       - Löschen kann über Audit-Logs rückgängig gemacht werden
 *       - Alle zugehörigen Konfigurationen werden entfernt
 *       - Remote Desktop Verbindungen werden aus Guacamole entfernt
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der zu löschenden Appliance
 *     responses:
 *       200:
 *         description: Appliance erfolgreich gelöscht
 *         content:
 *           application/json:
 *             example:
 *               message: "Appliance deleted successfully"
 *               deletedId: 1
 *       404:
 *         description: Appliance nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung zum Löschen
 */

/**
 * @swagger
 * /api/appliances/{id}/favorite:
 *   patch:
 *     summary: Favoriten-Status ändern
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Markiert eine Appliance als Favorit oder entfernt die Markierung.
 *       
 *       Favoriten werden in der UI bevorzugt angezeigt.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der Appliance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isFavorite:
 *                 type: boolean
 *                 description: True für Favorit, false zum Entfernen
 *           example:
 *             isFavorite: true
 *     responses:
 *       200:
 *         description: Favoriten-Status aktualisiert
 *         content:
 *           application/json:
 *             example:
 *               message: "Favorite status updated"
 *               isFavorite: true
 *       404:
 *         description: Appliance nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/appliances/{id}/test-connection:
 *   post:
 *     summary: Verbindung testen
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Testet die Erreichbarkeit einer Appliance.
 *       
 *       **Tests umfassen**:
 *       - HTTP/HTTPS Verbindungstest
 *       - Response-Zeit Messung
 *       - SSL-Zertifikat-Validierung (bei HTTPS)
 *       - Optional: SSH-Verbindungstest
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der zu testenden Appliance
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testSSH:
 *                 type: boolean
 *                 description: SSH-Verbindung ebenfalls testen
 *                 default: false
 *     responses:
 *       200:
 *         description: Verbindungstest-Ergebnis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [online, offline, error]
 *                 responseTime:
 *                   type: integer
 *                   description: Response-Zeit in ms
 *                 httpStatus:
 *                   type: integer
 *                   description: HTTP Status Code
 *                 sslValid:
 *                   type: boolean
 *                   description: SSL-Zertifikat gültig (nur bei HTTPS)
 *                 sshConnected:
 *                   type: boolean
 *                   description: SSH-Verbindung erfolgreich (wenn getestet)
 *                 error:
 *                   type: string
 *                   description: Fehlermeldung bei Verbindungsproblemen
 *             example:
 *               status: "online"
 *               responseTime: 145
 *               httpStatus: 200
 *               sslValid: true
 *               sshConnected: true
 *       404:
 *         description: Appliance nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 */
/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Alle Kategorien abrufen
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft alle verfügbaren Kategorien ab, inklusive Systemkategorien
 *       und benutzerdefinierten Kategorien.
 *       
 *       **Systemkategorien** können nicht gelöscht, aber angepasst werden:
 *       - productivity: Produktivitäts-Tools
 *       - development: Entwicklungsumgebungen  
 *       - monitoring: Überwachungs-Tools
 *       - media: Medien-Services
 *       - network: Netzwerk-Tools
 *       - security: Sicherheits-Tools
 *       - other: Sonstige
 *       
 *       Die Antwort enthält auch die Anzahl der Appliances pro Kategorie.
 *     responses:
 *       200:
 *         description: Liste aller Kategorien
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *             example:
 *               - id: 1
 *                 name: "productivity"
 *                 display_name: "Produktivität"
 *                 icon: "Briefcase"
 *                 color: "#007AFF"
 *                 order_index: 0
 *                 is_system: true
 *                 applianceCount: 5
 *               - id: 8
 *                 name: "custom-tools"
 *                 display_name: "Eigene Tools"
 *                 icon: "Tool"
 *                 color: "#FF5733"
 *                 order_index: 7
 *                 is_system: false
 *                 applianceCount: 3
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Neue Kategorie erstellen
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Erstellt eine neue benutzerdefinierte Kategorie.
 *       
 *       **Validierung**:
 *       - Name muss eindeutig sein (keine Duplikate)
 *       - Name darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten
 *       - Display-Name ist erforderlich
 *       - Icon muss aus der verfügbaren Icon-Liste stammen
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, display_name]
 *             properties:
 *               name:
 *                 type: string
 *                 pattern: '^[a-z0-9-]+$'
 *                 description: Eindeutiger Identifier (nur Kleinbuchstaben, Zahlen, Bindestriche)
 *                 example: "custom-tools"
 *               display_name:
 *                 type: string
 *                 description: Anzeigename in der UI
 *                 example: "Eigene Tools"
 *               icon:
 *                 type: string
 *                 description: Icon-Name aus der Lucide-Icon-Bibliothek
 *                 example: "Tool"
 *               color:
 *                 type: string
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *                 description: Hex-Farbcode
 *                 example: "#FF5733"
 *               order_index:
 *                 type: integer
 *                 description: Sortierreihenfolge (niedrigere Werte zuerst)
 *                 example: 10
 *     responses:
 *       201:
 *         description: Kategorie erfolgreich erstellt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Ungültige Eingabedaten
 *         content:
 *           application/json:
 *             examples:
 *               duplicate:
 *                 value:
 *                   error: "A category with this name already exists"
 *               invalid_name:
 *                 value:
 *                   error: "Category name must contain only lowercase letters, numbers and hyphens"
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung (nur Admins)
 */

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Kategorie aktualisieren
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Aktualisiert eine bestehende Kategorie.
 *       
 *       **Einschränkungen**:
 *       - Systemkategorien: Nur display_name, icon und color können geändert werden
 *       - Benutzerdefinierte Kategorien: Alle Felder können geändert werden
 *       - Der Name (identifier) kann nach Erstellung nicht mehr geändert werden
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der zu aktualisierenden Kategorie
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *               icon:
 *                 type: string
 *               color:
 *                 type: string
 *               order_index:
 *                 type: integer
 *           example:
 *             display_name: "Entwicklung & Test"
 *             icon: "Code"
 *             color: "#00FF00"
 *     responses:
 *       200:
 *         description: Kategorie erfolgreich aktualisiert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Kategorie nicht gefunden
 *       400:
 *         description: Ungültige Eingabedaten
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung
 */

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Kategorie löschen
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Löscht eine benutzerdefinierte Kategorie.
 *       
 *       **Wichtig**:
 *       - Systemkategorien können nicht gelöscht werden
 *       - Appliances in der gelöschten Kategorie werden zu "other" verschoben
 *       - Löschung kann über Audit-Logs rückgängig gemacht werden
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der zu löschenden Kategorie
 *     responses:
 *       200:
 *         description: Kategorie erfolgreich gelöscht
 *         content:
 *           application/json:
 *             example:
 *               message: "Category deleted successfully"
 *               movedAppliances: 3
 *       404:
 *         description: Kategorie nicht gefunden
 *       400:
 *         description: Systemkategorie kann nicht gelöscht werden
 *         content:
 *           application/json:
 *             example:
 *               error: "System categories cannot be deleted"
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung (nur Admins)
 */

/**
 * @swagger
 * /api/categories/reorder:
 *   post:
 *     summary: Kategorien neu sortieren
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ändert die Reihenfolge der Kategorien durch Aktualisierung
 *       der order_index Werte.
 *       
 *       Die neue Reihenfolge wird als Array von Kategorie-IDs übergeben.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryOrder:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array von Kategorie-IDs in gewünschter Reihenfolge
 *           example:
 *             categoryOrder: [1, 3, 2, 5, 4, 6, 7, 8]
 *     responses:
 *       200:
 *         description: Reihenfolge erfolgreich aktualisiert
 *         content:
 *           application/json:
 *             example:
 *               message: "Category order updated successfully"
 *               updatedCount: 8
 *       400:
 *         description: Ungültige Kategorie-IDs
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung
 */

/**
 * @swagger
 * /api/categories/{id}/appliances:
 *   get:
 *     summary: Appliances einer Kategorie abrufen
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft alle Appliances ab, die einer bestimmten Kategorie zugeordnet sind.
 *       
 *       Die Appliances werden nach Name sortiert zurückgegeben.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID der Kategorie
 *     responses:
 *       200:
 *         description: Liste der Appliances in dieser Kategorie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   $ref: '#/components/schemas/Category'
 *                 appliances:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Appliance'
 *                 count:
 *                   type: integer
 *                   description: Anzahl der Appliances
 *       404:
 *         description: Kategorie nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 */
/**
 * @swagger
 * /api/ssh/keys:
 *   get:
 *     summary: Alle SSH-Schlüssel abrufen
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft alle gespeicherten SSH-Schlüssel ab.
 *       
 *       **Sicherheit**:
 *       - Nur öffentliche Schlüssel werden zurückgegeben
 *       - Private Schlüssel sind verschlüsselt gespeichert
 *       - Nur autorisierte Benutzer haben Zugriff
 *     responses:
 *       200:
 *         description: Liste aller SSH-Schlüssel
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SSHKey'
 *             example:
 *               - id: 1
 *                 name: "Production Server Key"
 *                 publicKey: "ssh-rsa AAAAB3NzaC1yc2..."
 *                 fingerprint: "SHA256:xxxxxxxxxxx"
 *                 createdAt: "2024-01-15T10:30:00Z"
 *                 lastUsed: "2024-01-20T15:45:00Z"
 *                 inUse: true
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/ssh/keys/generate:
 *   post:
 *     summary: Neuen SSH-Schlüssel generieren
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Generiert ein neues SSH-Schlüsselpaar.
 *       
 *       **Schlüssel-Eigenschaften**:
 *       - Typ: RSA 4096-bit (Standard) oder ED25519
 *       - Optional mit Passphrase geschützt
 *       - Private Schlüssel wird verschlüsselt gespeichert
 *       
 *       **Wichtig**: Der private Schlüssel wird nur einmal bei der
 *       Generierung zurückgegeben und sollte sicher gespeichert werden.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SSHKeyGenerateRequest'
 *           examples:
 *             rsa:
 *               summary: RSA-Schlüssel
 *               value:
 *                 name: "New Server Key"
 *                 type: "rsa"
 *                 passphrase: ""
 *             ed25519:
 *               summary: ED25519-Schlüssel mit Passphrase
 *               value:
 *                 name: "Secure Key"
 *                 type: "ed25519"
 *                 passphrase: "mySecurePassphrase123"
 *     responses:
 *       201:
 *         description: SSH-Schlüssel erfolgreich generiert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SSHKeyGenerateResponse'
 *       400:
 *         description: Ungültige Eingabedaten
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/ssh/keys/{id}:
 *   delete:
 *     summary: SSH-Schlüssel löschen
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Löscht einen SSH-Schlüssel permanent.
 *       
 *       **Warnung**: 
 *       - Schlüssel wird aus allen konfigurierten Hosts entfernt
 *       - Aktive SSH-Verbindungen werden beendet
 *       - Aktion kann nicht rückgängig gemacht werden
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Die ID des zu löschenden Schlüssels
 *     responses:
 *       200:
 *         description: Schlüssel erfolgreich gelöscht
 *         content:
 *           application/json:
 *             example:
 *               message: "SSH key deleted successfully"
 *               removedFromHosts: 3
 *       404:
 *         description: Schlüssel nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 *       409:
 *         description: Schlüssel wird noch verwendet
 */

/**
 * @swagger
 * /api/ssh/hosts:
 *   get:
 *     summary: Alle SSH-Hosts abrufen
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft alle konfigurierten SSH-Hosts ab.
 *       
 *       Die Liste enthält Verbindungsinformationen und Status
 *       für jeden konfigurierten Host.
 *     responses:
 *       200:
 *         description: Liste aller SSH-Hosts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   hostname:
 *                     type: string
 *                   port:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   sshKeyId:
 *                     type: integer
 *                   lastConnection:
 *                     type: string
 *                     format: date-time
 *                   status:
 *                     type: string
 *                     enum: [connected, disconnected, error]
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/ssh/hosts:
 *   post:
 *     summary: Neuen SSH-Host hinzufügen
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fügt einen neuen SSH-Host zur Verwaltung hinzu.
 *       
 *       **Verbindungstest**:
 *       - Die Verbindung wird automatisch getestet
 *       - Host-Key wird zur known_hosts hinzugefügt
 *       - SSH-Schlüssel wird auf den Host kopiert (optional)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, hostname, username]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Anzeigename für den Host
 *               hostname:
 *                 type: string
 *                 description: Hostname oder IP-Adresse
 *               port:
 *                 type: integer
 *                 default: 22
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 description: Passwort für initiale Verbindung
 *               sshKeyId:
 *                 type: integer
 *                 description: ID des zu verwendenden SSH-Schlüssels
 *               deployKey:
 *                 type: boolean
 *                 description: SSH-Schlüssel auf Host kopieren
 *           example:
 *             name: "Production Server"
 *             hostname: "192.168.1.100"
 *             port: 22
 *             username: "admin"
 *             password: "initialPassword"
 *             sshKeyId: 1
 *             deployKey: true
 *     responses:
 *       201:
 *         description: Host erfolgreich hinzugefügt
 *       400:
 *         description: Verbindung fehlgeschlagen
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/ssh/hosts/{id}/test:
 *   post:
 *     summary: SSH-Verbindung testen
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Testet die SSH-Verbindung zu einem Host.
 *       
 *       **Test umfasst**:
 *       - Netzwerk-Erreichbarkeit
 *       - SSH-Authentifizierung
 *       - Befehlsausführung (echo test)
 *       - Latenz-Messung
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Verbindungstest-Ergebnis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 latency:
 *                   type: integer
 *                   description: Round-trip time in ms
 *                 details:
 *                   type: object
 *                   properties:
 *                     authenticated:
 *                       type: boolean
 *                     commandExecuted:
 *                       type: boolean
 *                     osInfo:
 *                       type: string
 *                 error:
 *                   type: string
 *       404:
 *         description: Host nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/ssh/hosts/{id}/execute:
 *   post:
 *     summary: Befehl auf SSH-Host ausführen
 *     tags: [SSH Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Führt einen Befehl auf einem SSH-Host aus.
 *       
 *       **Sicherheit**:
 *       - Befehle werden im Audit-Log protokolliert
 *       - Gefährliche Befehle können blockiert werden
 *       - Timeout nach 30 Sekunden (konfigurierbar)
 *       
 *       **Unterstützte Features**:
 *       - Interaktive Befehle über Terminal-Endpoint
 *       - Sudo-Support mit Passwort-Prompt
 *       - Umgebungsvariablen
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [command]
 *             properties:
 *               command:
 *                 type: string
 *                 description: Auszuführender Befehl
 *               sudo:
 *                 type: boolean
 *                 description: Mit sudo ausführen
 *               timeout:
 *                 type: integer
 *                 description: Timeout in Sekunden
 *                 default: 30
 *               env:
 *                 type: object
 *                 description: Umgebungsvariablen
 *           example:
 *             command: "systemctl status nginx"
 *             sudo: true
 *             timeout: 10
 *     responses:
 *       200:
 *         description: Befehl ausgeführt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 output:
 *                   type: string
 *                 error:
 *                   type: string
 *                 exitCode:
 *                   type: integer
 *                 duration:
 *                   type: integer
 *                   description: Ausführungsdauer in ms
 *       400:
 *         description: Ungültiger Befehl
 *       404:
 *         description: Host nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 *       408:
 *         description: Befehl Timeout
 */
ungsdauer in Tagen"
 *               - key: "session_timeout"
 *                 value: "1440"
 *                 category: "security"
 *                 description: "Session-Timeout in Minuten"
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/settings/{key}:
 *   put:
 *     summary: Einstellung aktualisieren
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Aktualisiert eine spezifische Systemeinstellung.
 *       
 *       **Validierung**:
 *       - Werte werden je nach Einstellungstyp validiert
 *       - Änderungen werden im Audit-Log protokolliert
 *       - Einige Einstellungen erfordern Neustart
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Der Einstellungsschlüssel
 *         example: ssh_enabled
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingUpdateRequest'
 *           example:
 *             value: "false"
 *     responses:
 *       200:
 *         description: Einstellung erfolgreich aktualisiert
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 oldValue:
 *                   type: string
 *                 newValue:
 *                   type: string
 *                 requiresRestart:
 *                   type: boolean
 *       400:
 *         description: Ungültiger Wert
 *       404:
 *         description: Einstellung nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung (Admin erforderlich)
 */

/**
 * @swagger
 * /api/status-check:
 *   post:
 *     summary: Bulk-Statusprüfung
 *     tags: [Status Monitoring]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Führt eine Statusprüfung für mehrere Appliances gleichzeitig durch.
 *       
 *       **Optimierungen**:
 *       - Parallele Prüfung aller Appliances
 *       - Timeout von 5 Sekunden pro Appliance
 *       - Caching für 60 Sekunden
 *       
 *       Dieser Endpoint wird typischerweise beim Laden des Dashboards
 *       aufgerufen, um den initialen Status aller Appliances zu ermitteln.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusCheckRequest'
 *           example:
 *             applianceIds: [1, 2, 3, 4, 5]
 *     responses:
 *       200:
 *         description: Status aller angefragten Appliances
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusCheckResponse'
 *             example:
 *               "1":
 *                 status: "online"
 *                 responseTime: 145
 *                 lastChecked: "2024-01-15T10:30:00Z"
 *               "2":
 *                 status: "offline"
 *                 error: "Connection refused"
 *                 lastChecked: "2024-01-15T10:30:00Z"
 *               "3":
 *                 status: "online"
 *                 responseTime: 89
 *                 lastChecked: "2024-01-15T10:30:00Z"
 *       400:
 *         description: Ungültige Appliance-IDs
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/sse/events:
 *   get:
 *     summary: Server-Sent Events Stream
 *     tags: [Status Monitoring]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Öffnet einen Server-Sent Events Stream für Echtzeit-Updates.
 *       
 *       **Event-Typen**:
 *       - `status-update`: Appliance-Status hat sich geändert
 *       - `service-update`: Service-Status hat sich geändert
 *       - `ssh-activity`: SSH-Verbindung hergestellt/getrennt
 *       - `backup-progress`: Backup/Restore Fortschritt
 *       - `system-alert`: Systembenachrichtigungen
 *       
 *       **Verwendung**:
 *       ```javascript
 *       const eventSource = new EventSource('/api/sse/events', {
 *         headers: {
 *           'Authorization': 'Bearer ' + token
 *         }
 *       });
 *       
 *       eventSource.addEventListener('status-update', (event) => {
 *         const data = JSON.parse(event.data);
 *         console.log('Status update:', data);
 *       });
 *       ```
 *     responses:
 *       200:
 *         description: SSE-Stream geöffnet
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *             example: |
 *               event: status-update
 *               data: {"applianceId": 1, "status": "online", "responseTime": 145}
 *               
 *               event: service-update
 *               data: {"hostId": 1, "service": "nginx", "status": "running"}
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/terminal/session:
 *   post:
 *     summary: Terminal-Session erstellen
 *     tags: [Terminal]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Erstellt eine neue Terminal-Session für SSH-Verbindungen.
 *       
 *       Die Session wird über WebSocket weitergeführt. Dieser Endpoint
 *       gibt die Session-ID und WebSocket-URL zurück.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hostId]
 *             properties:
 *               hostId:
 *                 type: integer
 *                 description: ID des SSH-Hosts
 *               cols:
 *                 type: integer
 *                 default: 80
 *                 description: Terminal-Breite in Zeichen
 *               rows:
 *                 type: integer
 *                 default: 24
 *                 description: Terminal-Höhe in Zeilen
 *           example:
 *             hostId: 1
 *             cols: 120
 *             rows: 40
 *     responses:
 *       201:
 *         description: Terminal-Session erstellt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 websocketUrl:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *             example:
 *               sessionId: "term_1234567890"
 *               websocketUrl: "wss://example.com/api/terminal/ws/term_1234567890"
 *               expiresAt: "2024-01-15T11:30:00Z"
 *       404:
 *         description: Host nicht gefunden
 *       401:
 *         description: Nicht authentifiziert
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Alle Benutzer abrufen
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ruft eine Liste aller Benutzer ab (nur für Admins).
 *       
 *       Die Liste enthält keine Passwort-Hashes, aber alle anderen
 *       Benutzerinformationen inklusive Rollen und Status.
 *     responses:
 *       200:
 *         description: Liste aller Benutzer
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [admin, user, viewer]
 *                   isActive:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   lastLogin:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung (nur Admins)
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Neuen Benutzer erstellen
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Erstellt einen neuen Benutzer (nur für Admins).
 *       
 *       **Passwort-Anforderungen**:
 *       - Mindestens 8 Zeichen
 *       - Mindestens ein Großbuchstabe
 *       - Mindestens ein Kleinbuchstabe
 *       - Mindestens eine Zahl
 *       
 *       **Standardeinstellungen**:
 *       - Rolle: user (wenn nicht angegeben)
 *       - Status: aktiv
 *       - Muss Passwort bei erster Anmeldung ändern
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               password:
 *                 type: string
 *                 minLength: 8
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [admin, user, viewer]
 *                 default: user
 *           example:
 *             username: "newuser"
 *             password: "SecurePass123!"
 *             email: "newuser@example.com"
 *             role: "user"
 *     responses:
 *       201:
 *         description: Benutzer erfolgreich erstellt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 username:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Validierungsfehler
 *         content:
 *           application/json:
 *             examples:
 *               duplicate:
 *                 value:
 *                   error: "Username already exists"
 *               weak_password:
 *                 value:
 *                   error: "Password does not meet requirements"
 *       401:
 *         description: Nicht authentifiziert
 *       403:
 *         description: Keine Berechtigung (nur Admins)
 */

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     summary: Passwort ändern
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ändert das Passwort eines Benutzers.
 *       
 *       **Berechtigungen**:
 *       - Benutzer können ihr eigenes Passwort ändern
 *       - Admins können alle Passwörter ändern
 *       - Bei eigenem Passwort muss das alte Passwort angegeben werden
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 description: Erforderlich bei eigenem Passwort
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *           example:
 *             oldPassword: "CurrentPass123!"
 *             newPassword: "NewSecurePass456!"
 *     responses:
 *       200:
 *         description: Passwort erfolgreich geändert
 *       400:
 *         description: Validierungsfehler
 *       401:
 *         description: Altes Passwort falsch
 *       403:
 *         description: Keine Berechtigung
 *       404:
 *         description: Benutzer nicht gefunden
 */
