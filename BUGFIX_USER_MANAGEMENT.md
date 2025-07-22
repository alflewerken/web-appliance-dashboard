# UserManagement API URL Bugfix

## Problem
Die Benutzerverwaltung zeigte den Fehler "Fehler beim Laden der Benutzer: JSON.parse: unexpected character at line 1 column 1 of the JSON data".

## Ursache
Der `API_BASE_URL` Import fehlte in der UserManagement.js Komponente, wodurch die API-URLs falsch konstruiert wurden. Webpack optimierte den Code und ersetzte den leeren String durch eine hart codierte IP-Adresse (192.168.178.70).

## Lösung
1. Import von `API_BASE_URL` in UserManagement.js hinzugefügt
2. Frontend neu gebaut mit korrekten API-URLs
3. Container neu gestartet

## Betroffene Dateien
- `frontend/src/components/UserManagement.js` - API_BASE_URL Import hinzugefügt

## Verifizierung
Nach dem Fix sollte die Benutzerverwaltung korrekt funktionieren und relative API-URLs verwenden statt hart codierte IP-Adressen.
