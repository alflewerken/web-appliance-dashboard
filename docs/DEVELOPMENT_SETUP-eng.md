# Development Setup Guide

## ESLint & Prettier Installation

After cleaning up the project, ESLint and Prettier configurations were added. To use these:

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Run linting
npm run lint

# Linting with automatic fixes
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run linting
npm run lint

# Linting with automatic fixes
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Tests with coverage
npm test -- --coverage

# Tests in watch mode
npm run test:watch
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Tests in watch mode
npm run test:watch
```

## VS Code Integration

For the best development experience, install the following VS Code extensions:

1. **ESLint** (dbaeumer.vscode-eslint)
2. **Prettier** (esbenp.prettier-vscode)

### VS Code Settings (`.vscode/settings.json`)

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

To ensure only linted and formatted code is committed:

```bash
npm install --save-dev husky lint-staged

# Initialize Husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

Add to `package.json`:

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

For GitHub Actions, create `.github/workflows/ci.yml`:

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
    
    - name: Install Backend Dependencies
      run: |
        cd backend
        npm ci
    
    - name: Run Backend Lint
      run: |
        cd backend
        npm run lint
    
    - name: Run Backend Tests
      run: |
        cd backend
        npm test
    
    - name: Install Frontend Dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run Frontend Lint
      run: |
        cd frontend
        npm run lint
    
    - name: Run Frontend Tests
      run: |
        cd frontend
        npm test
```

## Troubleshooting

### ESLint Errors

If you see many ESLint errors, you can fix them step by step:

1. Auto-fixable errors:
   ```bash
   npm run lint:fix
   ```

2. Formatting errors:
   ```bash
   npm run format
   ```

3. For specific rules you want to temporarily disable:
   ```javascript
   // eslint-disable-next-line no-console
   console.log('Debug info');
   ```

### Test Errors

If tests fail:

1. Ensure all mocks are correct
2. Check test environment variables
3. Run tests individually:
   ```bash
   npm test -- --testNamePattern="should login successfully"
   ```

## Next Steps

1. **Code Review**: Go through linting errors and fix them
2. **Test Coverage**: Increase test coverage to at least 80%
3. **Documentation**: Add JSDoc comments to important functions
4. **TypeScript**: Prepare for TypeScript migration (planned for v1.1)