const {
  request,
  createTestApp,
  mockPool,
  resetMocks,
} = require('../helpers/testHelper');
const { executeSSHCommand } = require('../../utils/ssh');

// Mock SSE broadcast
jest.mock('../../routes/sse', () => ({
  broadcast: jest.fn(),
}));

const servicesRouter = require('../../routes/services');

describe('Services API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp(servicesRouter);
  });

  beforeEach(() => {
    resetMocks();
    // Reset the SSH mock
    executeSSHCommand.mockClear();
    executeSSHCommand.mockResolvedValue({
      stdout: 'Command executed successfully',
      stderr: '',
    });
  });

  describe('POST /api/services/:id/start', () => {
    test('should start a service successfully', async () => {
      const mockAppliance = [
        {
          id: 1,
          name: 'Test Service',
          start_command: 'systemctl start test-service',
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([mockAppliance]) // Get appliance
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // Update status

      const response = await request(app).post('/api/1/start').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('started successfully');
      expect(executeSSHCommand).toHaveBeenCalledWith(
        'systemctl start test-service',
        30000
      );
    });
    test('should handle missing start command', async () => {
      const mockAppliance = [
        {
          id: 1,
          name: 'Test Service',
          start_command: null,
        },
      ];

      mockPool.execute.mockResolvedValue([mockAppliance]);

      const response = await request(app).post('/api/1/start').expect(400);

      expect(response.body).toHaveProperty(
        'error',
        'No start command configured for this service'
      );
    });

    test('should handle SSH command failure', async () => {
      const mockAppliance = [
        {
          id: 1,
          name: 'Test Service',
          start_command: 'systemctl start test-service',
        },
      ];

      mockPool.execute.mockResolvedValue([mockAppliance]);
      executeSSHCommand.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app).post('/api/1/start').expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to start service');
    });
  });

  describe('POST /api/services/:id/stop', () => {
    test('should stop a service successfully', async () => {
      const mockAppliance = [
        {
          id: 1,
          name: 'Test Service',
          stop_command: 'systemctl stop test-service',
        },
      ];

      mockPool.execute
        .mockResolvedValueOnce([mockAppliance])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);

      const response = await request(app).post('/api/1/stop').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('stopped successfully');
    });
  });

  describe('GET /api/services/:id/status', () => {
    test('should get service status', async () => {
      const mockAppliance = [
        {
          id: 1,
          name: 'Test Service',
          status_command: 'systemctl status test-service',
        },
      ];

      mockPool.execute.mockResolvedValue([mockAppliance]);
      executeSSHCommand.mockResolvedValue({
        stdout: 'Active: active (running)',
        stderr: '',
      });

      const response = await request(app).get('/api/1/status').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
    });
  });
});
