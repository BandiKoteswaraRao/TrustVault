import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser } from '../services/authService.js';
import { recordAuditEvent } from '../services/auditService.js';
import { query } from '../db/index.js';

export async function handleRegister(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, fullName } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const result = await registerUser({
      email,
      password,
      fullName,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      message: 'User registered successfully.',
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function handleLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const result = await loginUser({
      email,
      password,
      ipAddress,
      userAgent
    });

    res.status(200).json({
      message: 'Login successful.',
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
      return;
    }

    const userRes = await query<{
      id: string;
      email: string;
      full_name: string;
      role: string;
      created_at: string;
    }>(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ error: 'Not Found', message: 'User not found.' });
      return;
    }

    const u = userRes.rows[0];
    res.status(200).json({
      user: {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        createdAt: u.created_at
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function handleLogout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.user) {
      await recordAuditEvent({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'AUTH_LOGOUT',
        targetType: 'USER',
        targetId: req.user.id,
        outcome: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    }

    res.status(200).json({
      message: 'Logout successful.'
    });
  } catch (error) {
    next(error);
  }
}
