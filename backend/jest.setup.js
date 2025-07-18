// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test_db';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock database pool globally
jest.mock('./utils/database', () => ({
  execute: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
}));

// Mock SSH utils
jest.mock('./utils/ssh', () => ({
  executeSSHCommand: jest.fn(),
  testSSHConnection: jest.fn(),
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
}));

// Set test timeout
jest.setTimeout(10000);
