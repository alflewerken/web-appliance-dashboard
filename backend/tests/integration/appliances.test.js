const request = require('supertest');
const express = require('express');
const appliancesRouter = require('../../routes/appliances');
const pool = require('../../utils/database');
const { verifyToken } = require('../../utils/auth');
const { broadcast } = require('../../routes/sse');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/appliances', appliancesRouter);

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/auth');
jest.mock('../../routes/sse');
jest.mock('../../utils/crypto', () => ({
  encrypt: jest.fn(val => `encrypted_${val}`),
  decrypt: jest.fn(val => val.replace('encrypted_', ''))
}));

describe('Appliances API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock verifyToken to always pass
    verifyToken.mockImplementation((req, res, next) => {
      req.user = { id: 1, username: 'testuser', role: 'admin' };
      next();
    });
  });

  describe('GET /api/appliances', () => {
    it('should return all appliances', async () => {
      const mockAppliances = [
        {
          id: 1,
          name: 'Test Appliance 1',
          url: 'http://192.168.1.100',
          category_name: 'Server',
          status: 'online'
        },
        {
          id: 2,
          name: 'Test Appliance 2',
          url: 'http://192.168.1.101',
          category_name: 'Network',
          status: 'offline'
        }
      ];

      pool.execute.mockResolvedValueOnce([mockAppliances]);

      const response = await request(app)
        .get('/api/appliances')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Test Appliance 1');
      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
    });

    it('should handle database errors', async () => {
      pool.execute.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/appliances')
        .set('Authorization', 'Bearer test-token')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/appliances', () => {
    it('should create a new appliance', async () => {
      const newAppliance = {
        name: 'New Appliance',
        url: 'http://192.168.1.200',
        categoryId: 1,
        description: 'Test appliance',
        username: 'admin',
        password: 'password123'
      };

      pool.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'Server' }]]) // Check category exists
        .mockResolvedValueOnce([[]]) // Check duplicate URL
        .mockResolvedValueOnce([{ insertId: 3 }]) // Insert
        .mockResolvedValueOnce([[{ 
          id: 3,
          name: 'New Appliance',
          url: 'http://192.168.1.200',
          category_name: 'Server'
        }]]); // Select new

      const response = await request(app)
        .post('/api/appliances')
        .set('Authorization', 'Bearer test-token')
        .send(newAppliance)
        .expect(201);

      expect(response.body).toHaveProperty('id', 3);
      expect(response.body).toHaveProperty('name', 'New Appliance');
    });

    it('should validate required fields', async () => {
      const invalidAppliance = {
        // Missing required fields
        description: 'Test'
      };

      const response = await request(app)
        .post('/api/appliances')
        .set('Authorization', 'Bearer test-token')
        .send(invalidAppliance)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should prevent duplicate URLs', async () => {
      const duplicateAppliance = {
        name: 'Duplicate',
        url: 'http://192.168.1.100',
        categoryId: 1
      };

      pool.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'Server' }]]) // Category exists
        .mockResolvedValueOnce([[{ id: 1 }]]); // URL already exists

      const response = await request(app)
        .post('/api/appliances')
        .set('Authorization', 'Bearer test-token')
        .send(duplicateAppliance)
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('PUT /api/appliances/:id', () => {
    it('should update an appliance', async () => {
      const updatedData = {
        name: 'Updated Appliance',
        url: 'http://192.168.1.100',
        categoryId: 2
      };

      pool.execute
        .mockResolvedValueOnce([[{ id: 1 }]]) // Get existing
        .mockResolvedValueOnce([[{ id: 2, name: 'Network' }]]) // Check category
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // Update
        .mockResolvedValueOnce([[{ 
          id: 1,
          name: 'Updated Appliance',
          category_name: 'Network'
        }]]); // Get updated

      const response = await request(app)
        .put('/api/appliances/1')
        .set('Authorization', 'Bearer test-token')
        .send(updatedData)
        .expect(200);

      expect(response.body.name).toBe('Updated Appliance');
    });

    it('should return 404 for non-existent appliance', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .put('/api/appliances/999')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/appliances/:id', () => {
    it('should delete an appliance', async () => {
      pool.execute
        .mockResolvedValueOnce([[{ id: 1, name: 'To Delete' }]]) // Get existing
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // Delete

      const response = await request(app)
        .delete('/api/appliances/1')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.message).toContain('deleted successfully');
    });

    it('should return 404 for non-existent appliance', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const response = await request(app)
        .delete('/api/appliances/999')
        .set('Authorization', 'Bearer test-token')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });
});
