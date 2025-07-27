# Remote Desktop Password Restore - Wichtige Informationen

## Problem
Nach einem Restore müssen Remote Desktop Passwörter neu eingegeben werden, wenn der Verschlüsselungsschlüssel nicht übereinstimmt.

## Ursache
Die Remote Desktop Passwörter werden mit AES-256-GCM verschlüsselt. Der Verschlüsselungsschlüssel wird aus der Umgebungsvariable `SSH_KEY_ENCRYPTION_SECRET` oder `ENCRYPTION_SECRET` generiert.

## Lösung

### 1. Backup des Verschlüsselungsschlüssels
Sichern Sie immer Ihre `.env` Datei zusammen mit dem Datenbank-Backup:

```bash
# Backup erstellen
cp .env .env.backup

# Oder den Schlüssel notieren
echo $SSH_KEY_ENCRYPTION_SECRET
```

### 2. Restore mit gleichem Schlüssel
Stellen Sie sicher, dass beim Restore derselbe Verschlüsselungsschlüssel verwendet wird:

```bash
# In der .env Datei
SSH_KEY_ENCRYPTION_SECRET=ihr-geheimer-schluessel-hier
```

### 3. Docker-Compose Konfiguration
Wenn Sie Docker verwenden, setzen Sie den Schlüssel in der `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - SSH_KEY_ENCRYPTION_SECRET=${SSH_KEY_ENCRYPTION_SECRET}
```

## Sicherheitshinweise

1. **Niemals** den Standard-Schlüssel in Produktion verwenden
2. Verwenden Sie einen starken, zufälligen Schlüssel (mindestens 32 Zeichen)
3. Speichern Sie den Schlüssel sicher (z.B. in einem Passwort-Manager)
4. Rotieren Sie den Schlüssel regelmäßig (erfordert Neueingabe aller Passwörter)

## Schlüssel generieren

```bash
# Sicheren Schlüssel generieren
openssl rand -base64 32

# Oder mit Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Nach einem Restore

Wenn die Passwörter nicht funktionieren:

1. Prüfen Sie, ob der richtige Verschlüsselungsschlüssel gesetzt ist
2. Starten Sie den Backend-Container neu
3. Falls der Schlüssel verloren ist, müssen alle Remote Desktop Passwörter neu eingegeben werden

## Automatisierung (Optional)

Sie können ein Skript erstellen, das Backup und Schlüssel zusammen sichert:

```bash
#!/bin/bash
# backup-with-key.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Datenbank-Backup herunterladen
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/admin/backup \
  -o "$BACKUP_DIR/backup.json"

# Schlüssel sichern
echo "SSH_KEY_ENCRYPTION_SECRET=$SSH_KEY_ENCRYPTION_SECRET" > "$BACKUP_DIR/.env.key"

echo "Backup erstellt in: $BACKUP_DIR"
```
