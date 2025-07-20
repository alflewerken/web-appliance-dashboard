# Guacamole Verbindung manuell einrichten

## In Guacamole (du bist bereits eingeloggt):

1. **Gehe zu Einstellungen** (Zahnrad-Symbol oben rechts neben "guacadmin")

2. **Klicke auf "Verbindungen"** im linken Menü

3. **Erstelle eine neue Verbindung** oder bearbeite die bestehende "Mac":
   - Klicke auf "Neue Verbindung" oder auf "Mac" zum Bearbeiten

4. **Konfiguriere die Verbindung**:
   - **Name**: Nextcloud-Mac (oder belasse es bei "Mac")
   - **Protokoll**: VNC
   - **Parameter**:
     - **Hostname**: 192.168.178.70
     - **Port**: 5900
     - **Benutzername**: alflewerken
     - **Passwort**: [dein VNC Passwort]
   
5. **Speichern**

6. **Zurück zur Startseite** - die Verbindung sollte jetzt funktionieren

## Alternative: Die bestehende "Mac" Verbindung nutzen

Es sieht so aus, als ob bereits eine "Mac" Verbindung existiert. Du kannst:
1. Einfach auf "Mac" klicken um die Verbindung zu starten
2. Oder die Verbindung bearbeiten und umbenennen in "Nextcloud-Mac"

## Hinweis
Die automatische Erstellung von Verbindungen aus dem Dashboard heraus ist noch nicht vollständig implementiert. Aktuell musst du die Verbindungen einmalig manuell in Guacamole anlegen.
