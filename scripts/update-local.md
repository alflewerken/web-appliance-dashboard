# Update Local Development Repository

## Übersicht

Das `update-local.sh` Script automatisiert die Synchronisation deines lokalen Entwicklungs-Repositories mit den neuesten Änderungen aus GitHub, inklusive Dependabot-Updates, gemergten Pull Requests und Dependency-Aktualisierungen.

## Warum dieses Script?

In modernen Projekten kommen Updates aus verschiedenen Quellen:
- **Dependabot** erstellt automatisch PRs für Sicherheits- und Version-Updates
- **Team-Mitglieder** mergen Features und Fixes
- **Dependencies** ändern sich ständig in `package-lock.json`
- **Docker Images** werden regelmäßig aktualisiert

Ohne automatisierte Synchronisation können schnell Konflikte und veraltete Dependencies entstehen.

## Features

### 🔐 Sicheres Change-Management
- Erkennt uncommitted changes automatisch
- Bietet Stashing mit Zeitstempel
- Restored changes nach dem Update

### 🤖 Dependabot-Integration
- Zeigt Anzahl offener Dependabot-PRs
- Kategorisiert nach Typ (Docker, NPM, GitHub Actions)
- Direkter Link zur GitHub Pull Request Seite

### 📦 Dependency-Management
- Automatisches `npm install` in allen Projekt-Verzeichnissen:
  - `/backend`
  - `/frontend`
  - `/terminal-app`
- Synchronisiert `package-lock.json` Dateien

### 🐳 Docker-Integration
- Optional: Pull der neuesten Docker Images
- Hinweis auf Container-Rebuild bei Änderungen

### 🌿 Branch-Management
- Merkt sich deine aktuelle Branch
- Aktualisiert main branch
- Optional: Rebase deiner Feature-Branch auf main

## Installation

```bash
# Script ausführbar machen (einmalig)
chmod +x scripts/update-local.sh
```

## Verwendung

### Standard-Update
```bash
./scripts/update-local.sh
```

### Ablauf

1. **Pre-Check Phase**
   - Prüft ob im Projekt-Root
   - Erkennt aktuelle Branch
   - Prüft auf uncommitted changes

2. **Fetch & Pull Phase**
   - Holt alle Remote-Änderungen
   - Aktualisiert main branch
   - Zeigt Dependabot PR-Statistiken

3. **Dependencies Phase**
   - Backend npm install
   - Frontend npm install
   - Terminal-app npm install

4. **Docker Phase** (optional)
   - Fragt ob Docker Images gepullt werden sollen
   - Führt `docker-compose pull` aus

5. **Cleanup Phase**
   - Wechselt zur ursprünglichen Branch zurück
   - Optional: Rebase auf main
   - Restored gestashte Änderungen

## Interaktive Prompts

Das Script fragt bei wichtigen Entscheidungen nach:

### Stash Changes?
```
⚠️  Warning: You have uncommitted changes
Do you want to stash these changes? (y/n)
```
- **y**: Änderungen werden gestasht und später wiederhergestellt
- **n**: Script wird abgebrochen (keine Änderungen verloren)

### Docker Images Update?
```
Do you want to pull latest Docker images? (y/n)
```
- **y**: Lädt alle Docker Images neu (`docker-compose pull`)
- **n**: Überspringt Docker Update

### Rebase Feature Branch?
```
Do you want to rebase feature-branch on main? (y/n)
```
- **y**: Rebased deine Branch auf den aktuellen main
- **n**: Lässt Branch unverändert

## Ausgabe-Interpretation

### Farbcodes
- 🔵 **Blau**: Informationen und Aktionen
- 🟢 **Grün**: Erfolgreiche Operationen
- 🟡 **Gelb**: Warnungen und Tipps
- 🔴 **Rot**: Fehler

### Dependabot-Statistiken
```
🤖 Dependabot Pull Requests:
================================
📦 Docker updates: 2
📦 NPM updates: 5
📦 GitHub Actions updates: 1
```

Diese Zahlen zeigen offene PRs, die auf GitHub gereviewed werden sollten.

## Workflow-Integration

### Tägliche Routine

1. **Morgens: Repository Update**
   ```bash
   ./scripts/update-local.sh
   ```

2. **GitHub: PR Review**
   - Öffne https://github.com/alflewerken/web-appliance-dashboard/pulls
   - Review Dependabot PRs
   - Merge wenn Tests grün

3. **Nach Merge: Erneut updaten**
   ```bash
   ./scripts/update-local.sh
   ```

4. **Container rebuild (wenn nötig)**
   ```bash
   ./scripts/build.sh --refresh
   ```

### Bei Feature-Entwicklung

1. **Vor Arbeitsbeginn**
   ```bash
   ./scripts/update-local.sh
   # Wähle "y" bei Rebase-Frage
   ```

2. **Nach Feature-Completion**
   ```bash
   git add .
   git commit -m "feat: your feature"
   ./scripts/update-local.sh
   git push
   ```

## Troubleshooting

### "Not in project root directory"
**Problem**: Script wurde nicht im Hauptverzeichnis ausgeführt
**Lösung**: 
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard
./scripts/update-local.sh
```

### Merge-Konflikte nach Rebase
**Problem**: Konflikte beim Rebase auf main
**Lösung**:
```bash
# Konflikte manuell lösen, dann:
git add .
git rebase --continue
# Oder abbrechen:
git rebase --abort
```

### NPM Install Fehler
**Problem**: npm install schlägt fehl
**Mögliche Ursachen**:
- Node Version stimmt nicht (check `.nvmrc`)
- Cache-Probleme: `npm cache clean --force`
- Lösche `node_modules` und `package-lock.json`, dann erneut versuchen

### Docker Pull Fehler
**Problem**: Docker Images können nicht gepullt werden
**Lösungen**:
- Docker läuft nicht: `docker ps` prüfen
- Speicherplatz: `docker system prune`
- Netzwerk: VPN/Proxy prüfen

## Best Practices

### ✅ DO's
- Script täglich ausführen für aktuelle Dependencies
- Immer committen vor dem Update
- Dependabot PRs zeitnah reviewen
- Container nach Updates neu bauen

### ❌ DON'Ts
- Script nicht mit uncommitted changes abbrechen (nutze Stash)
- Nicht zu lange mit Updates warten (vermeidet große Konflikte)
- Dependabot PRs nicht blind mergen (immer reviewen)

## Erweiterte Nutzung

### Automatisierung mit Cron
```bash
# Tägliches Update um 9 Uhr (crontab -e)
0 9 * * * cd /Users/alflewerken/Desktop/web-appliance-dashboard && ./scripts/update-local.sh
```

### Integration in Git Hooks
```bash
# .git/hooks/post-checkout
#!/bin/bash
echo "💡 Reminder: Run ./scripts/update-local.sh to sync dependencies"
```

### Alias für schnelleren Zugriff
```bash
# In ~/.zshrc oder ~/.bashrc
alias update-repo='cd /Users/alflewerken/Desktop/web-appliance-dashboard && ./scripts/update-local.sh'
```

## Verbindung zu anderen Scripts

- **`build.sh`**: Nach Updates oft nötig für Container-Rebuild
- **`sync-compose.sh`**: Synchronisiert docker-compose Dateien
- **`backup.sh`**: Vor größeren Updates empfohlen
- **`install.sh`**: Nutzt die aktualisierten Production-Images

## Technische Details

### Verwendete Git-Befehle
- `git fetch origin --prune`: Holt alle Änderungen und löscht veraltete Remote-Branches
- `git stash push -m "message"`: Speichert Änderungen mit Beschreibung
- `git rebase main`: Wendet Commits auf aktuellem main an

### NPM Update-Strategie
- Führt `npm install` aus (nicht `npm update`)
- Respektiert `package-lock.json` für reproduzierbare Builds
- Installiert exact versions aus lock-Datei

### Performance
- Parallel fetch für alle Git-Operationen
- NPM install nur wenn package.json vorhanden
- Docker pull optional (kann länger dauern)

## Support

Bei Problemen:
1. Check die `changes/changes.md` für aktuelle Änderungen
2. Führe `git status` aus für Repository-Status
3. Prüfe GitHub Actions für Build-Status
4. Erstelle Issue auf GitHub bei Bugs

---

*Letzte Aktualisierung: 2025-08-12*
