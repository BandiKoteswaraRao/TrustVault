import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { getDb } from '../../src/db/index.js';

describe('Input Validation, SQL Injection & XSS Defense Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();

    const res = await request(app).post('/api/auth/register').send({
      email: 'security.analyst@trustvault.local',
      password: 'AnalystPassword123!',
      fullName: 'Security Analyst'
    });
    authToken = res.body.token;
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  it('1. Safely parameterizes SQL injection payloads in search query parameter', async () => {
    const sqlInjectionPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE documents; --",
      "' UNION SELECT * FROM users --",
      "1' OR '1'='1"
    ];

    for (const payload of sqlInjectionPayloads) {
      const res = await request(app)
        .get(`/api/documents?search=${encodeURIComponent(payload)}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Query must succeed safely returning an empty list or matching text without syntax error or table drop
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.documents)).toBe(true);
    }
  });

  it('2. Safely parameterizes SQL injection payloads in login authentication', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "' OR 1=1 --",
        password: 'password'
      });

    // Parameterized lookup safely evaluates the string literal, failing with 401
    expect([400, 401]).toContain(res.status);
    expect(res.body).not.toHaveProperty('token');
  });

  it('3. Neutralizes and safely stores XSS payloads in document title and metadata', async () => {
    const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';

    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .field('title', xssPayload)
      .field('description', 'Safe testing for XSS')
      .attach('file', Buffer.from('%PDF-1.4 test document'), 'xss_test.pdf');

    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe(xssPayload); // stored as raw text, never executed as HTML

    // Retrieve details to verify safe JSON serialization
    const getRes = await request(app)
      .get(`/api/documents/${res.body.document.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.document.title).toBe(xssPayload);
  });

  it('4. Rejects path traversal file names (../../etc/passwd)', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .field('title', 'Path Traversal Attempt')
      .attach('file', Buffer.from('%PDF-1.4 sample file'), '../../../../etc/passwd.pdf');

    // Filename is sanitized to basename ('passwd.pdf') and stored under a UUID
    expect(res.status).toBe(201);
    expect(res.body.document.file_name).toBe('passwd.pdf');
    expect(res.body.document.storage_path).not.toContain('..');
  });
});
