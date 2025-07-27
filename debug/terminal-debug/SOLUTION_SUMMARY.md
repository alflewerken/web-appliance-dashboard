# Terminal Connection Fix - Summary

## Problem
Wenn ein externes Terminal-Fenster geöffnet wird, wird keine SSH-Verbindung zum Host aufgebaut, weil die Session-Daten nicht korrekt zwischen Frontend und ttyd übertragen werden.

## Ursache
1. Die Session-Dateien werden im Backend erstellt, aber ttyd kann sie nicht rechtzeitig lesen
2. Die URL-Parameter werden nicht korrekt an ttyd weitergegeben
3. Das ursprüngliche ttyd-wrapper Script unterstützt keine Query-Parameter

## Lösung
1. **Verbessertes Wrapper-Script**: Das neue Script (`ttyd-ssh-wrapper.sh`) kann jetzt:
   - Query-Parameter direkt aus den Argumenten lesen (wenn ttyd mit `--arg` gestartet wird)
   - Fallback auf Session-Dateien
   - Bessere Debug-Ausgaben für Fehlersuche

2. **Docker-Compose Override**: Fügt `--arg` zum ttyd-Befehl hinzu, damit Query-Parameter weitergegeben werden

3. **Session-File Handling**: Verlängerte Gültigkeit der Session-Dateien (60 Sekunden statt 30)

## Anwendung
Das Terminal sollte jetzt funktionieren mit URLs wie:
- `/terminal/?host=192.168.1.100&user=admin&port=22`
- `/terminal/?hostId=123`

## Test
1. Öffne das Dashboard: http://localhost:9080
2. Wähle eine Appliance aus
3. Klicke auf "Terminal" → "In neuem Fenster öffnen"
4. Das Terminal sollte sich direkt mit dem SSH-Host verbinden

## Debug-Möglichkeiten
Bei Problemen:
1. Prüfe ttyd logs: `docker-compose logs -f ttyd`
2. Prüfe Session-Dateien: `docker exec appliance_ttyd ls -la /tmp/terminal-sessions/`
3. Prüfe URL-Parameter in der Browser-Konsole

## Weitere Verbesserungen (optional)
1. JWT-basierte Authentifizierung statt Session-Dateien
2. WebSocket-basierte Parameter-Übertragung
3. Direkte Integration mit dem Backend-API
