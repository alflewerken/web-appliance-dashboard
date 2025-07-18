# Default Admin User

Nach einem vollständigen Build (`./scripts/clean.sh && ./scripts/build.sh`) wird automatisch ein Admin-User erstellt:

## Login-Daten

- **Username:** admin
- **Password:** admin123
- **Role:** Administrator

## Automatische Erstellung

Der Admin-User wird automatisch erstellt durch:
- Das Script `scripts/create-admin-user.sh`
- Wird am Ende von `build.sh` aufgerufen
- Prüft zuerst, ob bereits ein Admin existiert
- Erstellt nur einen neuen Admin, wenn keiner vorhanden ist

## Sicherheit

⚠️ **WICHTIG**: Ändern Sie das Standard-Passwort nach dem ersten Login!

1. Loggen Sie sich ein mit admin/admin123
2. Gehen Sie zu Einstellungen → Benutzerverwaltung
3. Ändern Sie das Passwort des Admin-Users

## Manuelle Erstellung

Falls Sie den Admin-User manuell erstellen müssen:

```bash
./scripts/create-admin-user.sh
```

## Troubleshooting

Falls der Login nicht funktioniert:

1. Prüfen Sie ob die Datenbank läuft:
   ```bash
   docker compose ps database
   ```

2. Prüfen Sie die Logs:
   ```bash
   docker compose logs backend
   ```

3. Erstellen Sie den User manuell:
   ```bash
   docker exec appliance_backend node -e "
   const mysql = require('mysql2/promise');
   const bcrypt = require('bcryptjs');
   // ... (siehe create-admin-user.sh)
   "
   ```
