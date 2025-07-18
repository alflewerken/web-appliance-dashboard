const request = require('supertest');
const express = require('express');
const categoriesRouter = require('../../routes/categories');
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
app.use('/api/categories', categoriesRouter);

describe('Categories Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/categories', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        { id: 1, name: 'Infrastructure', icon: 'Server', order: 0 },
        { id: 2, name: 'Database', icon: 'Database', order: 1 },
      ];

      pool.execute = jest.fn().mockResolvedValue([mockCategories]);

      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Infrastructure');
    });
  });

  describe('POST /api/categories', () => {
    it('should create a new category', async () => {
      const newCategory = {
        name: 'Security',
        icon: 'Shield',
      };

      pool.execute = jest
        .fn()
        .mockResolvedValueOnce([[{ maxOrder: 2 }]]) // Get max order
        .mockResolvedValueOnce([{ insertId: 3 }]); // Insert

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', 'Bearer mock-token')
        .send(newCategory);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 3);
      expect(response.body).toHaveProperty('name', 'Security');
      expect(response.body).toHaveProperty('order', 3);
      expect(broadcast).toHaveBeenCalledWith('categories-updated');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', 'Bearer mock-token')
        .send({ icon: 'Shield' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'Name and icon are required'
      );
    });
  });

  describe('PUT /api/categories/reorder', () => {
    it('should reorder categories', async () => {
      const reorderData = [
        { id: 2, order: 0 },
        { id: 1, order: 1 },
      ];

      pool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);

      const response = await request(app)
        .put('/api/categories/reorder')
        .set('Authorization', 'Bearer mock-token')
        .send({ categories: reorderData });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Categories reordered successfully'
      );
      expect(broadcast).toHaveBeenCalledWith('categories-updated');
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete a category without appliances', async () => {
      pool.execute = jest
        .fn()
        .mockResolvedValueOnce([[{ count: 0 }]]) // No appliances
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // Delete

      const response = await request(app)
        .delete('/api/categories/1')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        'message',
        'Category deleted successfully'
      );
      expect(broadcast).toHaveBeenCalledWith('categories-updated');
    });

    it('should not delete category with appliances', async () => {
      pool.execute = jest.fn().mockResolvedValueOnce([[{ count: 5 }]]); // Has appliances

      const response = await request(app)
        .delete('/api/categories/1')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'error',
        'Cannot delete category with associated appliances'
      );
    });
  });
});
