const request = require('supertest');
const express = require('express');
const appliancesRouter = require('../../routes/appliances');
const pool = require('../../utils/database');
const { broadcast } = require('../../routes/sse');

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('../../routes/sse');
jest.mock('../../utils/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 1, username: 'testuser', role: 'admin' };
    next();
  },
  createAuditLog: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/appliances', appliancesRouter);

describe('Appliances Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/appliances', () => {
    it('should return all appliances', async () => {
      const mockAppliances = [
        {
          id: 1,
          name: 'Test App 1',
          url: 'http://test1.com',
          icon: 'Server',
          category: 'infrastructure',
        },
        {
          id: 2,
          name: 'Test App 2',
          url: 'http://test2.com',
          icon: 'Database',
          category: 'database',
        },
      ];

      pool.execute = jest.fn().mockResolvedValue([mockAppliances]);

      const response = await request(app)
        .get('/api/appliances')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Test App 1');
    });

    it('should handle database errors', async () => {
      pool.execute = jest.fn().mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .get('/api/appliances')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty(
        'error',
        'Failed to fetch appliances'
      );
    });
  });

  describe('POST /api/appliances', () => {
    it('should create a new appliance', async () => {
      const newAppliance = {
        name: 'New App',
        url: 'http://newapp.com',
        icon: 'Globe',
        category: 'web',
      };

      pool.execute = jest
        .fn()
        .mockResolvedValueOnce([{ insertId: 3 }]) // Insert
        .mockResolvedValueOnce([[{ ...newAppliance, id: 3 }]]); // Select

      const response = await request(app)
        .post('/api/appliances')
        .set('Authorization', 'Bearer mock-token')
        .send(newAppliance);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 3);
      expect(response.body).toHaveProperty('name', 'New App');
      expect(broadcast).toHaveBeenCalledWith(
        'appliance-created',
        expect.any(Object)
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/appliances')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'Incomplete App' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'Name and URL are required'
      );
    });
  });

  describe('PUT /api/appliances/:id', () => {
    it('should update an existing appliance', async () => {
      const updatedData = {
        name: 'Updated App',
        url: 'http://updated.com',
        icon: 'Server',
        category: 'infrastructure',
      };

      pool.execute = jest
        .fn()
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Update
        .mockResolvedValueOnce([[{ id: 1, ...updatedData }]]); // Select

      const response = await request(app)
        .put('/api/appliances/1')
        .set('Authorization', 'Bearer mock-token')
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Updated App');
      expect(broadcast).toHaveBeenCalledWith(
        'appliance-updated',
        expect.any(Object)
      );
    });

    it('should return 404 for non-existent appliance', async () => {
      pool.execute = jest.fn().mockResolvedValue([{ affectedRows: 0 }]);

      const response = await request(app)
        .put('/api/appliances/999')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Appliance not found');
    });
  });

  describe('DELETE /api/appliances/:id', () => {
    it('should delete an appliance', async () => {
      pool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);

      const response = await request(app)
        .delete('/api/appliances/1')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Appliance deleted successfully'
      );
      expect(broadcast).toHaveBeenCalledWith('appliance-deleted', { id: '1' });
    });

    it('should return 404 for non-existent appliance', async () => {
      pool.execute = jest.fn().mockResolvedValue([{ affectedRows: 0 }]);

      const response = await request(app)
        .delete('/api/appliances/999')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Appliance not found');
    });
  });
});
