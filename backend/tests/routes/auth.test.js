const request = require('supertest');
const express = require('express');
const authRouter = require('../../routes/auth');
const pool = require('../../utils/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: 'hashedpassword',
        role: 'user',
      };

      pool.execute = jest.fn().mockResolvedValue([[mockUser]]);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'mock-jwt-token');
      expect(response.body.user).toHaveProperty('username', 'testuser');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should fail with invalid username', async () => {
      pool.execute = jest.fn().mockResolvedValue([[]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'invaliduser', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should fail with invalid password', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: 'hashedpassword',
        role: 'user',
      };

      pool.execute = jest.fn().mockResolvedValue([[mockUser]]);
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should handle database errors', async () => {
      pool.execute = jest.fn().mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Login failed');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      pool.execute = jest
        .fn()
        .mockResolvedValueOnce([[]]) // No existing user
        .mockResolvedValueOnce([{ insertId: 1 }]); // Insert successful

      bcrypt.hash = jest.fn().mockResolvedValue('hashedpassword');
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      const response = await request(app).post('/api/auth/register').send({
        username: 'newuser',
        password: 'password123',
        role: 'user',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token', 'mock-jwt-token');
      expect(response.body.user).toHaveProperty('username', 'newuser');
    });

    it('should fail if username already exists', async () => {
      const existingUser = { id: 1, username: 'existinguser' };
      pool.execute = jest.fn().mockResolvedValue([[existingUser]]);

      const response = await request(app).post('/api/auth/register').send({
        username: 'existinguser',
        password: 'password123',
        role: 'user',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Username already exists');
    });
  });
});
