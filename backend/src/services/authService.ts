import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { config } from '../config/index.js';
import { recordAuditEvent } from './auditService.js';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface AuthResult {
  user: UserProfile;
  token: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(user: { id: string; email: string; role: string }): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as any
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export async function registerUser(params: {
  email: string;
  password: string;
  fullName: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  const normalizedEmail = params.email.trim().toLowerCase();

  // Check if user exists
  const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
  if (existing.rowCount && existing.rowCount > 0) {
    await recordAuditEvent({
      action: 'AUTH_REGISTER_FAILED',
      targetType: 'AUTH',
      outcome: 'DENIED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { reason: 'Email already registered', email: normalizedEmail }
    });
    const error: any = new Error('An account with this email already exists.');
    error.statusCode = 409;
    throw error;
  }

  // Hash password with bcrypt work factor 12
  const passwordHash = await bcrypt.hash(params.password, 12);

  const insertRes = await query<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: string;
  }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'user')
     RETURNING id, email, full_name, role, created_at`,
    [normalizedEmail, passwordHash, params.fullName.trim()]
  );

  const user = insertRes.rows[0];

  // Audit event for registration
  await recordAuditEvent({
    actorId: user.id,
    actorEmail: user.email,
    action: 'AUTH_REGISTER_SUCCESS',
    targetType: 'USER',
    targetId: user.id,
    outcome: 'SUCCESS',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { email: user.email, fullName: user.full_name }
  });

  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at
    },
    token
  };
}

export async function loginUser(params: {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<AuthResult> {
  const normalizedEmail = params.email.trim().toLowerCase();

  const userRes = await query<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
    created_at: string;
  }>(
    'SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE LOWER(email) = $1',
    [normalizedEmail]
  );

  // Generic failure message to prevent username enumeration
  const invalidCredentialsError: any = new Error('Invalid email or password.');
  invalidCredentialsError.statusCode = 401;

  if (userRes.rowCount === 0) {
    await recordAuditEvent({
      action: 'AUTH_LOGIN_FAILURE',
      targetType: 'AUTH',
      outcome: 'DENIED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { reason: 'User not found', attemptedEmail: normalizedEmail }
    });
    throw invalidCredentialsError;
  }

  const user = userRes.rows[0];
  const isMatch = await bcrypt.compare(params.password, user.password_hash);

  if (!isMatch) {
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      action: 'AUTH_LOGIN_FAILURE',
      targetType: 'AUTH',
      targetId: user.id,
      outcome: 'DENIED',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: { reason: 'Invalid password', email: user.email }
    });
    throw invalidCredentialsError;
  }

  // Audit successful login
  await recordAuditEvent({
    actorId: user.id,
    actorEmail: user.email,
    action: 'AUTH_LOGIN_SUCCESS',
    targetType: 'USER',
    targetId: user.id,
    outcome: 'SUCCESS',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent
  });

  const token = generateToken({ id: user.id, email: user.email, role: user.role });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at
    },
    token
  };
}
