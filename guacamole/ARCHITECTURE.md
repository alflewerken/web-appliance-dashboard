# Guacamole Integration - Architektur

## Übersicht

Die Integration ermöglicht 1-Klick Remote Desktop Zugriff ohne zusätzlichen Login in Guacamole.

## Komponenten

### 1. Frontend (React)
- **RemoteDesktopButton.jsx**: Zeigt VNC/RDP Buttons in der Appliance-Übersicht
- Ruft Backend-API für JWT Token auf
- Öffnet Guacamole mit Token in neuem Fenster

### 2. Backend (Node.js)
- **routes/guacamole.js**: API Endpoint für Token-Generierung
  - POST `/api/remote/guacamole/token/:applianceId`
  - Generiert JWT Token mit User- und Appliance-Daten
  - Token enthält: username, userId, applianceId, connectionId
  - Gültigkeit: 5 Minuten

- **utils/guacamole/GuacamoleDBManager.js**: 
  - Erstellt Verbindungen in Guacamole DB
  - Aktualisiert bestehende Verbindungen

### 3. Guacamole Extension (Java)
- **DashboardAuthenticationProvider**: Hauptklasse der Extension
  - Empfängt JWT Token über Query Parameter
  - Validiert Token mit gemeinsamem Secret
  - Authentifiziert User automatisch

- **JWTValidator**: Token-Validierung
  - Prüft Signatur und Ablaufzeit
  - Extrahiert Claims

- **ConnectionProvider**: Lädt Verbindungen aus Dashboard-DB
  - Liest Remote Desktop Konfiguration
  - Erstellt Guacamole-Verbindungen dynamisch

- **DashboardUserContext**: User-Kontext mit Verbindungen
  - Stellt verfügbare Verbindungen bereit
  - Keine manuelle Konfiguration nötig

## Datenfluss

```
1. User klickt VNC/RDP Button
   ↓
2. Frontend ruft Backend API auf
   ↓
3. Backend generiert JWT Token:
   {
     "sub": "username",
     "userId": "123",
     "applianceId": "456",
     "connectionId": "appliance-456",
     "exp": 1234567890
   }
   ↓
4. Frontend öffnet: http://guacamole:9070/guacamole/#/?token=JWT_TOKEN
   ↓
5. Guacamole Extension validiert Token
   ↓
6. Extension lädt Verbindungsdaten aus Dashboard-DB
   ↓
7. User wird automatisch eingeloggt
   ↓
8. Remote Desktop Verbindung wird hergestellt
```

## Sicherheit

- JWT Tokens sind kurzlebig (5 Minuten)
- Gemeinsames Secret zwischen Backend und Extension
- Verbindungsdaten werden verschlüsselt gespeichert
- Keine Credentials in Guacamole DB

## Deployment

1. Extension bauen: `mvn clean package`
2. JAR in `/guacamole/extensions/` kopieren
3. Guacamole Container neu starten
4. Umgebungsvariablen müssen übereinstimmen:
   - JWT_SECRET
   - DB_HOST, DB_USER, DB_PASSWORD

## Vorteile

- **Nahtlose Integration**: Kein separater Guacamole-Login
- **Zentrale Verwaltung**: Alle Konfiguration im Dashboard
- **Dynamisch**: Verbindungen werden zur Laufzeit erstellt
- **Sicher**: Token-basierte Authentifizierung
- **Benutzerfreundlich**: 1-Klick Zugriff
