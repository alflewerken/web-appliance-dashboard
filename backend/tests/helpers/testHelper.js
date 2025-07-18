// Test configuration and helpers
const request = require('supertest');
const express = require('express');

// Mock the database pool
const mockPool = {
  execute: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
};

// Mock all required modules before requiring the routes
jest.mock('../../utils/database', () => mockPool);
jest.mock('../../utils/middleware', () => ({
  createRequiredDirectories: jest.fn(),
}));
jest.mock('../../utils/sshAutoInitializer', () => jest.fn());
jest.mock('../../utils/statusChecker', () => ({
  checkApplianceStatus: jest.fn(),
}));
jest.mock('../../utils/serviceInitializer', () => ({
  initializeServices: jest.fn(),
}));

// Mock SSH command execution
jest.mock('../../utils/ssh', () => ({
  executeSSHCommand: jest.fn().mockResolvedValue({
    stdout: 'Command executed successfully',
    stderr: '',
  }),
}));

// Helper to create test app with routes
function createTestApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

// Helper to reset all mocks
function resetMocks() {
  jest.clearAllMocks();
  mockPool.execute.mockReset();
  mockPool.query.mockReset();
}

module.exports = {
  request,
  createTestApp,
  mockPool,
  resetMocks,
};
