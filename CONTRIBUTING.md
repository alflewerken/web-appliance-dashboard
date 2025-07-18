# Contributing to Web Appliance Dashboard

Vielen Dank für Ihr Interesse, zu diesem Projekt beizutragen! 🎉

## Code of Conduct

Dieses Projekt und alle Beteiligten verpflichten sich zu einem respektvollen und professionellen Umgang miteinander.

## Wie kann ich beitragen?

### 🐛 Bugs melden

1. Überprüfen Sie die [Issues](https://github.com/alflewerken/web-appliance-dashboard/issues), ob der Bug bereits gemeldet wurde
2. Erstellen Sie ein neues Issue mit dem Label `bug`
3. Verwenden Sie das Bug-Report-Template
4. Fügen Sie folgende Informationen hinzu:
   - Detaillierte Beschreibung des Problems
   - Schritte zur Reproduktion
   - Erwartetes vs. tatsächliches Verhalten
   - Screenshots (wenn relevant)
   - System-Informationen (OS, Browser, Docker-Version)

### 💡 Features vorschlagen

1. Erstellen Sie ein Issue mit dem Label `enhancement`
2. Beschreiben Sie das Feature detailliert
3. Erklären Sie den Use Case
4. Fügen Sie Mockups/Wireframes hinzu (optional)

### 🔧 Code beitragen

#### Setup

1. Fork das Repository
2. Clone Ihren Fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/web-appliance-dashboard.git
   cd web-appliance-dashboard
   ```

3. Fügen Sie das Original als Upstream hinzu:
   ```bash
   git remote add upstream https://github.com/alflewerken/web-appliance-dashboard.git
   ```

4. Erstellen Sie einen Feature-Branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
#### Development Guidelines

##### Code Style

**JavaScript/React:**
- Verwenden Sie ES6+ Features
- Funktionale Komponenten mit Hooks bevorzugen
- Props destructuring verwenden
- Aussagekräftige Variablen- und Funktionsnamen

```javascript
// ✅ Gut
const ApplianceCard = ({ appliance, onEdit, onDelete }) => {
  const { name, url, icon } = appliance;
  // ...
};

// ❌ Schlecht
const Card = (props) => {
  const n = props.appliance.name;
  // ...
};
```

**CSS:**
- BEM-Namenskonvention für Klassen
- CSS-Variablen für Themes
- Mobile-first Approach

**Commits:**
- Verwenden Sie Conventional Commits
- Format: `type(scope): description`
- Typen: feat, fix, docs, style, refactor, test, chore

```bash
# Beispiele
git commit -m "feat(auth): add multi-factor authentication"
git commit -m "fix(terminal): resolve websocket connection issue"
git commit -m "docs(readme): update installation instructions"
```

#### Testing

1. Schreiben Sie Tests für neue Features
2. Stellen Sie sicher, dass alle Tests bestehen:
   ```bash
   # Backend Tests
   cd backend && npm test
   
   # Frontend Tests
   cd frontend && npm test
   ```

3. Streben Sie eine Code-Coverage von >80% an
#### Pull Request Process

1. **Aktualisieren Sie Ihren Fork:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Rebase Ihren Feature-Branch:**
   ```bash
   git checkout feature/your-feature-name
   git rebase main
   ```

3. **Push zu Ihrem Fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Erstellen Sie einen Pull Request:**
   - Verwenden Sie das PR-Template
   - Verlinken Sie relevante Issues
   - Beschreiben Sie die Änderungen
   - Fügen Sie Screenshots hinzu (bei UI-Änderungen)

5. **Review-Prozess:**
   - Warten Sie auf Code-Review
   - Reagieren Sie auf Feedback
   - Führen Sie angeforderte Änderungen durch

### 📚 Dokumentation

- Aktualisieren Sie die README.md bei Bedarf
- Dokumentieren Sie neue Features
- Fügen Sie JSDoc-Kommentare hinzu
- Aktualisieren Sie die API-Dokumentation

### 🌐 Übersetzungen

Hilfe bei Übersetzungen ist willkommen! (i18n coming soon)

## Entwicklungsumgebung

### Empfohlene Tools

- **IDE**: VS Code mit Extensions:
  - ESLint
  - Prettier
  - Docker
  - GitLens
- **Node.js**: Version 18+
- **Docker Desktop**: Neueste Version
- **Git**: Version 2.30+
### Hilfreiche Befehle

```bash
# Projekt-Setup
./scripts/setup-dev.sh

# Container starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Tests ausführen
npm run test:all

# Linting
npm run lint

# Code formatieren
npm run format
```

## Release-Prozess

1. Update CHANGELOG.md
2. Bump Version in package.json files
3. Create Git tag
4. Push tag to trigger release

## Fragen?

- Erstellen Sie ein Issue mit dem Label `question`
- Diskutieren Sie in [GitHub Discussions](https://github.com/alflewerken/web-appliance-dashboard/discussions)
- Kontaktieren Sie die Maintainer

## Anerkennung

Alle Contributor werden in der README.md aufgeführt!

---

**Happy Coding!** 🚀