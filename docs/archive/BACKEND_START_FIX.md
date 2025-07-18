# Backend Start Problem - Fix

## Problem
Das Backend startete nach einem Rebuild nicht mehr und befand sich in einem Restart-Loop.

## Fehleranalyse
```
Error: Cannot find module 'pg'
Require stack:
- /app/utils/sshStatusMonitor.js
- /app/server.js
```

## Ursache
In der Datei `backend/utils/sshStatusMonitor.js` wurde fälschlicherweise das PostgreSQL-Modul (`pg`) importiert:
```javascript
const { Pool } = require('pg');  // FALSCH - pg ist nicht installiert
```

Das Projekt verwendet aber MariaDB/MySQL, nicht PostgreSQL.

## Lösung
Entfernung des unnötigen Imports:
```javascript
// Vorher:
const { Pool } = require('pg');
const { exec } = require('child_process');
const sseManager = require('./sseManager');

// Nachher:
const { exec } = require('child_process');
const sseManager = require('./sseManager');
```

## Schritte zur Behebung
1. Fehlerhafte Import-Zeile entfernt
2. Backend neu gestartet: `docker-compose restart backend`
3. Status überprüft: Backend läuft wieder normal

## Lessons Learned
- Bei Copy-Paste von Code immer auf korrekte Imports achten
- Das Projekt verwendet MySQL/MariaDB, nicht PostgreSQL
- Der `pool` Parameter wird von außen übergeben (MySQL-Pool)
