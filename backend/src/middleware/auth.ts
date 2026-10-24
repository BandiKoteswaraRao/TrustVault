import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/authService.js';
import { query } from '../db/index.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required.'
    });
    return;
  }

  try {
    const payload: JwtPayload = verifyToken(token);

    // Verify user still exists in database
    const userRes = await query<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User session is invalid or user no longer exists.'
      });
      return;
    }

    req.user = {
      id: userRes.rows[0].id,
      email: userRes.rows[0].email,
      role: userRes.rows[0].role
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token.'
    });
    return;
  }
}
