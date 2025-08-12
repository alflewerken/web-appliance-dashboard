# Contributing to Web Appliance Dashboard

Thank you for your interest in contributing to this project! 🎉

[🇩🇪 Deutsche Version](CONTRIBUTING.de.md)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to maintaining a respectful and professional environment.

## How Can I Contribute?

### 🐛 Reporting Bugs

1. Check the [Issues](https://github.com/alflewerken/web-appliance-dashboard/issues) to see if the bug has already been reported
2. Create a new issue with the `bug` label
3. Use the bug report template
4. Include the following information:
   - Detailed description of the problem
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots (if relevant)
   - System information (OS, Browser, Docker version)

### 💡 Suggesting Features

1. Create an issue with the `enhancement` label
2. Describe the feature in detail
3. Explain the use case
4. Add mockups/wireframes (optional)

### 🔧 Contributing Code

#### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/web-appliance-dashboard.git
   cd web-appliance-dashboard
   ```

3. Add the original as upstream:
   ```bash
   git remote add upstream https://github.com/alflewerken/web-appliance-dashboard.git
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Guidelines

##### Code Style

**JavaScript/React:**
- Use ES6+ features
- Prefer functional components with hooks
- Use props destructuring
- Meaningful variable and function names

```javascript
// ✅ Good
const ApplianceCard = ({ appliance, onEdit, onDelete }) => {
  const { name, url, icon } = appliance;
  // ...
};

// ❌ Bad
const Card = (props) => {
  const n = props.appliance.name;
  // ...
};
```

**CSS:**
- BEM naming convention for classes
- CSS variables for themes
- Mobile-first approach

**Commits:**
- Use Conventional Commits
- Format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore

```bash
# Examples
git commit -m "feat(auth): add multi-factor authentication"
git commit -m "fix(terminal): resolve websocket connection issue"
git commit -m "docs(readme): update installation instructions"
```

#### Testing

1. Write tests for new features
2. Ensure all tests pass:
   ```bash
   # Backend tests
   cd backend && npm test
   
   # Frontend tests
   cd frontend && npm test
   ```

3. Aim for >80% code coverage

#### Pull Request Process

1. **Update your fork:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Rebase your feature branch:**
   ```bash
   git checkout feature/your-feature-name
   git rebase main
   ```

3. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request:**
   - Use the PR template
   - Link relevant issues
   - Describe the changes
   - Add screenshots (for UI changes)

5. **Review Process:**
   - Wait for code review
   - Respond to feedback
   - Make requested changes

### 📚 Documentation

- Update README.md if needed
- Document new features
- Add JSDoc comments
- Update API documentation

### 🌐 Translations

Help with translations is welcome! Currently we support:
- English (primary)
- German

## Development Environment

### Recommended Tools

- **IDE**: VS Code with extensions:
  - ESLint
  - Prettier
  - Docker
  - GitLens
- **Node.js**: Version 18+
- **Docker Desktop**: Latest version
- **Git**: Version 2.30+

### Helpful Commands

```bash
# Project setup
./scripts/setup-env.sh

# Start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Run all tests
npm run test:all

# Linting
npm run lint

# Format code
npm run format
```

## Release Process

1. Update CHANGELOG.md
2. Bump version in package.json files
3. Create Git tag
4. Push tag to trigger release

## Questions?

- Create an issue with the `question` label
- Discuss in [GitHub Discussions](https://github.com/alflewerken/web-appliance-dashboard/discussions)
- Contact the maintainers

## Recognition

All contributors will be listed in the README.md!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Happy Coding!** 🚀
