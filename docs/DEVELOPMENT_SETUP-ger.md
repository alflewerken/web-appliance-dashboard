# Entwicklungsumgebung einrichten

## ESLint & Prettier Installation

Nach dem Aufräumen des Projekts wurden ESLint und Prettier Konfigurationen hinzugefügt. Um diese zu nutzen:

### Backend Setup

```bash
cd backend

# Dependencies installieren
npm install

# Linting ausführen
npm run lint

# Linting mit automatischen Fixes
npm run lint:fix

# Code formatieren
npm run format

# Formatierung überprüfen
npm run format:check
```

### Frontend Setup

```bash
cd frontend

# Dependencies installieren
npm install

# Linting ausführen
npm run lint

# Linting mit automatischen Fixes
npm run lint:fix

# Code formatieren
npm run format

# Formatierung überprüfen
npm run format:check
```

## Tests ausführen
### Backend Tests

```bash
cd backend

# Alle Tests ausführen
npm test

# Tests mit Coverage
npm test -- --coverage

# Tests im Watch-Modus
npm run test:watch
```

### Frontend Tests

```bash
cd frontend

# Tests ausführen
npm test

# Tests im Watch-Modus
npm run test:watch
```

## VS Code Integration

Für die beste Entwicklungserfahrung installieren Sie folgende VS Code Extensions:

1. **ESLint** (dbaeumer.vscode-eslint)
2. **Prettier** (esbenp.prettier-vscode)

### VS Code Einstellungen (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact"
  ],
  "prettier.requireConfig": true
}
```
## Pre-Commit Hooks (Optional)

Um sicherzustellen, dass nur gelinteter und formatierter Code committed wird:

```bash
npm install --save-dev husky lint-staged

# Husky initialisieren
npx husky install

# Pre-commit Hook hinzufügen
npx husky add .husky/pre-commit "npx lint-staged"
```

Fügen Sie zu `package.json` hinzu:

```json
{
  "lint-staged": {
    "*.{js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

## CI/CD Integration

Für GitHub Actions erstellen Sie `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Backend Dependencies installieren
      run: |
        cd backend
        npm ci
    
    - name: Backend Lint ausführen
      run: |
        cd backend
        npm run lint
    
    - name: Backend Tests ausführen
      run: |
        cd backend
        npm test
    
    - name: Frontend Dependencies installieren
      run: |
        cd frontend
        npm ci
    
    - name: Frontend Lint ausführen
      run: |
        cd frontend
        npm run lint
    
    - name: Frontend Tests ausführen
      run: |
        cd frontend
        npm test
```

## Fehlerbehebung

### ESLint Fehler

Wenn Sie viele ESLint-Fehler sehen, können Sie diese schrittweise beheben:

1. Automatisch behebbare Fehler:
   ```bash
   npm run lint:fix
   ```
2. Formatierungs-Fehler:
   ```bash
   npm run format
   ```

3. Für spezifische Regeln, die Sie temporär deaktivieren möchten:
   ```javascript
   // eslint-disable-next-line no-console
   console.log('Debug info');
   ```

### Test Fehler

Wenn Tests fehlschlagen:

1. Stellen Sie sicher, dass alle Mocks korrekt sind
2. Überprüfen Sie die Test-Umgebungsvariablen
3. Führen Sie Tests einzeln aus:
   ```bash
   npm test -- --testNamePattern="should login successfully"
   ```

## Nächste Schritte

1. **Code Review**: Gehen Sie durch die Linting-Fehler und beheben Sie diese
2. **Test Coverage**: Erhöhen Sie die Test-Abdeckung auf mindestens 80%
3. **Dokumentation**: Fügen Sie JSDoc-Kommentare zu wichtigen Funktionen hinzu
4. **TypeScript**: Bereiten Sie die Migration zu TypeScript vor (geplant für v1.1)