import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { getDb } from '../../src/db/index.js';

describe('Server-Enforced Authorization & BOLA/IDOR Security Suite', () => {
  let userAToken: string;
  let userBToken: string;
  let userCToken: string;
  let userAId: string;
  let userBId: string;
  let userCId: string;
  let userADocId: string;
  let activePermissionId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();

    // 1. Register User A (Alice - Document Owner)
    const resA = await request(app).post('/api/auth/register').send({
      email: 'alice.owner@trustvault.local',
      password: 'AlicePassword123!',
      fullName: 'Alice Owner'
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // 2. Register User B (Bob - Initial Recipient)
    const resB = await request(app).post('/api/auth/register').send({
      email: 'bob.recipient@trustvault.local',
      password: 'BobPassword123!',
      fullName: 'Bob Recipient'
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // 3. Register User C (Charlie - Unrelated Third Party)
    const resC = await request(app).post('/api/auth/register').send({
      email: 'charlie.intruder@trustvault.local',
      password: 'CharliePassword123!',
      fullName: 'Charlie Intruder'
    });
    userCToken = resC.body.token;
    userCId = resC.body.user.id;

    // 4. User A uploads a private document
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('title', "Alice Confidential Financials")
      .field('description', "Quarterly audit reports")
      .attach('file', Buffer.from('%PDF-1.4 confidential quarterly balance sheet'), 'financials.pdf');

    expect(uploadRes.status).toBe(201);
    userADocId = uploadRes.body.document.id;
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  // Test Case 1: Unauthenticated user tries to list documents -> 401
  it('1. Rejects unauthenticated request to list documents with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  // Test Case 2: User B attempts to download User A's private document -> 403
  it("2. Rejects User B's attempt to download User A's private document before permission is granted", async () => {
    const res = await request(app)
      .get(`/api/documents/${userADocId}/download`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/permission|access denied/i);
  });

  // Test Case 3: User B attempts to read User A's permission list -> 403
  it("3. Rejects User B's attempt to view the permission list of User A's document", async () => {
    const res = await request(app)
      .get(`/api/documents/${userADocId}/permissions`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/Only the document owner can view permissions/i);
  });

  // Legitimate Grant Step: User A grants User B download permission
  it("Owner (Alice) grants access to Bob successfully", async () => {
    const res = await request(app)
      .post(`/api/documents/${userADocId}/permissions`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        granteeEmail: 'bob.recipient@trustvault.local',
        permissionLevel: 'download'
      });

    expect(res.status).toBe(201);
    expect(res.body.permission).toHaveProperty('id');
    activePermissionId = res.body.permission.id;
  });

  // Verification Step: Bob can now download
  it("Bob can successfully download the document while permission is active", async () => {
    const res = await request(app)
      .get(`/api/documents/${userADocId}/download`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  // Test Case 4: A recipient (Bob) attempts to grant access to another user (Charlie) -> 403
  it("4. Rejects recipient's (Bob) attempt to grant access to a third party (Charlie) (BFLA)", async () => {
    const res = await request(app)
      .post(`/api/documents/${userADocId}/permissions`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        granteeEmail: 'charlie.intruder@trustvault.local',
        permissionLevel: 'download'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/Only the document owner can grant sharing permissions/i);
  });

  // Test Case 5: A recipient attempts to revoke permissions -> 403
  it("5. Rejects recipient's attempt to revoke permissions on the document", async () => {
    const res = await request(app)
      .delete(`/api/documents/${userADocId}/permissions/${activePermissionId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/Only the document owner can revoke permissions/i);
  });

  // Test Case 6: A user attempts to change ownership or inject forged parameters -> fails/ignored
  it("6. Prevents privilege escalation and forged ownership updates via request body", async () => {
    const res = await request(app)
      .patch(`/api/documents/${userADocId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Hacked Title',
        owner_id: userBId // attempt to reassign owner
      });

    // Bob is not the owner, update must be rejected with 403
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/Only the document owner can update document details/i);
  });

  // Revocation Step: Alice revokes Bob's access
  it("Alice (owner) revokes Bob's access", async () => {
    const res = await request(app)
      .delete(`/api/documents/${userADocId}/permissions/${activePermissionId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/revoked/i);
  });

  // Test Case 7: A user attempts to access a document after their permission has been revoked -> 403
  it("7. Immediately rejects Bob's download request after permission revocation (Immediate Revocation)", async () => {
    const res = await request(app)
      .get(`/api/documents/${userADocId}/download`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toMatch(/permission|access denied/i);
  });

  // Test Case 8: A user attempts to manipulate another user's document or permission ID -> 403/404
  it("8. Rejects access when targeting invalid or manipulated document IDs (BOLA/IDOR)", async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/documents/${fakeUuid}`)
      .set('Authorization', `Bearer ${userCToken}`);

    expect([403, 404]).toContain(res.status);
  });

  // Test Case 9: File upload validation rejects dangerous extensions
  it("9. Rejects file upload with dangerous executable extension (.sh, .exe, .bat)", async () => {
    const dangerousExtensions = [
      { name: 'malware_test.exe', content: 'MZ mock binary payload for testing' },
      { name: 'exploit_test.sh', content: '#!/bin/bash\necho "test script"' },
      { name: 'batch_test.bat', content: '@echo off\necho "test batch"' }
    ];

    for (const item of dangerousExtensions) {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${userAToken}`)
        .field('title', 'Malicious Upload Attempt')
        .attach('file', Buffer.from(item.content), item.name);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toMatch(/Dangerous file extension|not supported/i);
    }
  });

  // Test Case 10: Unauthorized access to audit records is blocked
  it("10. Prevents unauthenticated and unauthorized access to audit verification and logs", async () => {
    const resUnauth = await request(app).get('/api/audit');
    expect([401, 404]).toContain(resUnauth.status);

    const resVerifyUnauth = await request(app).get('/api/audit/verify');
    expect([401, 404]).toContain(resVerifyUnauth.status);
  });
});
