# Guacamole Dashboard Authentication Extension

Diese Extension ermöglicht eine nahtlose Integration zwischen dem Web Appliance Dashboard und Apache Guacamole für 1-Klick Remote Desktop Zugriff.

## Features

- **JWT-basierte Authentifizierung**: Sichere Token-basierte Authentifizierung ohne zusätzlichen Login
- **Automatische Verbindungserstellung**: Verbindungen werden dynamisch aus der Dashboard-DB geladen
- **1-Klick Zugriff**: Direkter Zugriff auf Remote Desktop ohne Guacamole-Login
- **Multi-Protokoll Support**: Unterstützt VNC und RDP

## Installation

### 1. Extension bauen

```bash
cd guacamole/dashboard-auth-extension
./build.sh
```

### 2. Extension installieren

Die gebaute JAR-Datei muss in das Guacamole extensions Verzeichnis kopiert werden:

```bash
# Kopiere die Extension in das gemountete Verzeichnis
cp guacamole/dashboard-auth-extension/target/guacamole-auth-dashboard-1.0.0.jar guacamole/extensions/

# Guacamole neu starten
docker-compose restart guacamole
```

### 3. Überprüfung

Prüfe die Guacamole Logs ob die Extension geladen wurde:

```bash
docker logs appliance_guacamole | grep -i dashboard
```

## Funktionsweise

1. **Token Generierung**: 
   - Das Dashboard Backend generiert einen JWT Token mit User- und Appliance-Informationen
   - Der Token enthält: username, userId, applianceId, connectionId
   - Token ist 5 Minuten gültig

2. **Authentifizierung**:
   - Die Extension empfängt den Token über Query Parameter
   - Token wird validiert und Claims extrahiert
   - Bei gültigem Token wird der User automatisch authentifiziert

3. **Verbindungen**:
   - Die Extension lädt die Remote Desktop Konfiguration aus der Dashboard-DB
   - Verbindungen werden dynamisch für den authentifizierten User erstellt
   - Keine manuelle Konfiguration in Guacamole nötig

## Konfiguration

Die Extension nutzt folgende Umgebungsvariablen:

- `JWT_SECRET`: Secret für JWT Token Validierung (muss mit Dashboard übereinstimmen)
- `DB_HOST`: Dashboard Datenbank Host
- `DB_PORT`: Dashboard Datenbank Port
- `DB_NAME`: Dashboard Datenbank Name
- `DB_USER`: Dashboard Datenbank User
- `DB_PASSWORD`: Dashboard Datenbank Passwort

Diese werden automatisch über docker-compose.yml gesetzt.

## Troubleshooting

### Extension wird nicht geladen

1. Prüfe ob die JAR im richtigen Verzeichnis liegt:
   ```bash
   docker exec appliance_guacamole ls -la /etc/guacamole/extensions/
   ```

2. Prüfe die Logs:
   ```bash
   docker logs appliance_guacamole
   ```

### JWT Token Fehler

1. Stelle sicher dass JWT_SECRET in beiden Containern identisch ist
2. Prüfe die Token-Gültigkeit (5 Minuten)
3. Aktiviere Debug-Logging in der Extension

### Verbindungen werden nicht angezeigt

1. Prüfe die Datenbank-Verbindung
2. Stelle sicher dass Remote Desktop in der Appliance aktiviert ist
3. Prüfe ob die Service-Konfiguration korrekt ist

## Entwicklung

### Voraussetzungen

- Java 8+
- Maven 3.6+
- Docker & Docker Compose

### Build Prozess

```bash
cd guacamole/dashboard-auth-extension
mvn clean package
```

### Debug Modus

Für Debugging kann der Log-Level erhöht werden:

```xml
<logger name="com.dashboard.guacamole" level="DEBUG"/>
```

## Sicherheit

- JWT Tokens sind nur 5 Minuten gültig
- Tokens können nur einmal verwendet werden
- Verbindungsdaten werden verschlüsselt in der DB gespeichert
- Keine Credentials werden in Guacamole gespeichert

## Lizenz

Diese Extension steht unter der gleichen Lizenz wie das Web Appliance Dashboard.
