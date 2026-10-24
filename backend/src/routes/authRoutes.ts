import { Router } from 'express';
import {
  handleRegister,
  handleLogin,
  handleGetCurrentUser,
  handleLogout
} from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateBody, registerSchema, loginSchema } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), handleRegister);
router.post('/login', authLimiter, validateBody(loginSchema), handleLogin);
router.get('/me', authenticateToken, handleGetCurrentUser);
router.post('/logout', authenticateToken, handleLogout);

export default router;
