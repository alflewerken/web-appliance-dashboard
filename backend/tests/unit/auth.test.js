const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { 
  verifyToken, 
  hashToken, 
  generateToken,
  hashPassword,
  comparePassword 
} = require('../../utils/auth');
const pool = require('../../utils/database');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../../utils/database');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('verifyToken middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should reject request without token', async () => {
      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid token with active session', async () => {
      const token = 'valid-token';
      const decodedToken = { id: 1, username: 'testuser' };
      const mockSession = [{
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      }];

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decodedToken);
      pool.execute
        .mockResolvedValueOnce([mockSession]) // SELECT session
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE last_activity

      await verifyToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(req.user).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should reject expired session', async () => {
      const token = 'valid-token';
      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue({ id: 1 });
      pool.execute.mockResolvedValueOnce([[]]); // Empty result = no valid session

      await verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired session' });
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin'
      };
      const mockToken = 'generated-token';
      
      jwt.sign.mockReturnValue(mockToken);
      
      const token = generateToken(userId);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          userId: userId
        },
        'test-secret',
        { expiresIn: '24h' }
      );
      expect(token).toBe(mockToken);
    });
  });

  describe('Password functions', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      bcrypt.hash.mockResolvedValue(hashedPassword);
      
      const result = await hashPassword(password);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should compare passwords correctly', async () => {
      const password = 'testPassword123';
      const hash = 'hashedPassword123';
      
      bcrypt.compare.mockResolvedValue(true);
      
      const result = await comparePassword(password, hash);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });
  });
});
