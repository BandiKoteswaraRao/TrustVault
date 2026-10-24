import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { getDb } from '../../src/db/index.js';

describe('Authentication & Identity Security Suite', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  const testUser = {
    email: 'auth.test@trustvault.local',
    password: 'StrongPassword123!',
    fullName: 'Test Auditor'
  };

  it('successfully registers a user with normalized email and secure password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: '  AUTH.TEST@trustvault.local  ', // with whitespace and uppercase
        password: testUser.password,
        fullName: testUser.fullName
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe('auth.test@trustvault.local');
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects duplicate registration with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'auth.test@trustvault.local',
        password: testUser.password,
        fullName: 'Another Duplicate'
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('rejects weak passwords failing security complexity criteria', async () => {
    const weakPasswords = [
      'short1!',         // too short
      'NoDigitsOrSpecial', // missing digit & special char
      'alllowercase123!', // missing uppercase
      'ALLUPPERCASE123!'  // missing lowercase
    ];

    for (const pwd of weakPasswords) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `weak.${Math.random()}@example.com`,
          password: pwd,
          fullName: 'Weak Password User'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    }
  });

  it('successfully authenticates with valid credentials and issues JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'auth.test@trustvault.local',
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('auth.test@trustvault.local');
  });

  it('rejects invalid password with generic error (prevents username enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'auth.test@trustvault.local',
        password: 'WrongPassword123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('rejects non-existent email with identical generic error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent.user.999@trustvault.local',
        password: 'AnyPassword123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('denies access to protected endpoint /api/auth/me without authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('denies access to protected endpoint /api/auth/me with forged or invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer forged_invalid_jwt_token_payload');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('allows access to protected endpoint /api/auth/me with valid Bearer token', async () => {
    // 1. Log in to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'auth.test@trustvault.local',
        password: testUser.password
      });

    const token = loginRes.body.token;

    // 2. Query /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('auth.test@trustvault.local');
    expect(meRes.body.user.fullName).toBe('Test Auditor');
  });

  it('records audit events for registration, login success, and login failure', async () => {
    const db = await getDb();
    const res = await db.query(
      `SELECT action, outcome, actor_email, target_type
       FROM audit_events
       WHERE actor_email = 'auth.test@trustvault.local' OR metadata->>'attemptedEmail' = 'auth.test@trustvault.local'
       ORDER BY sequence_number ASC`
    );

    const actions = res.rows.map(r => r.action);
    expect(actions).toContain('AUTH_REGISTER_SUCCESS');
    expect(actions).toContain('AUTH_LOGIN_SUCCESS');
    expect(actions).toContain('AUTH_LOGIN_FAILURE');
  });
});
