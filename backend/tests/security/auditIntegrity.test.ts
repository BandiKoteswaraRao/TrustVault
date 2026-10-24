import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrate.js';
import { getDb } from '../../src/db/index.js';
import { recordAuditEvent, verifyAuditChain, GENESIS_HASH } from '../../src/services/auditService.js';

describe('Cryptographic Audit Trail & Integrity Verification Suite', () => {
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await runMigrations();

    // Register user for audit queries
    const res = await request(app).post('/api/auth/register').send({
      email: 'auditor.lead@trustvault.local',
      password: 'AuditPassword123!',
      fullName: 'Lead Compliance Auditor'
    });
    userToken = res.body.token;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    const db = await getDb();
    await db.close();
  });

  it('1. Computes valid hash chain with genesis link and external HMAC anchor', async () => {
    const event = await recordAuditEvent({
      actorId: userId,
      actorEmail: 'auditor.lead@trustvault.local',
      action: 'SYSTEM_DIAGNOSTIC_INIT',
      targetType: 'SYSTEM',
      outcome: 'SUCCESS',
      metadata: { check: 'genesis_compliance' }
    });

    expect(event).toHaveProperty('current_hash');
    expect(event.current_hash).toHaveLength(64); // SHA-256 hex string

    const verification = await verifyAuditChain();
    expect(verification.isValid).toBe(true);
    expect(verification.totalEvents).toBeGreaterThanOrEqual(1);
    expect(verification).toHaveProperty('hmacSignature');
    expect(verification.hmacSignature).toHaveLength(64);
  });

  it('2. Detects payload data tampering (e.g. modified action or outcome)', async () => {
    const db = await getDb();

    // 1. Record an event
    const event = await recordAuditEvent({
      actorId: userId,
      actorEmail: 'auditor.lead@trustvault.local',
      action: 'DOCUMENT_EXPORT',
      targetType: 'DOCUMENT',
      targetId: 'doc-tamper-target-1',
      outcome: 'DENIED',
      metadata: { reason: 'Unauthorized access attempt' }
    });

    // 2. Malicious insider directly modifies database row outcome to SUCCESS without updating hash
    await db.query(
      "UPDATE audit_events SET outcome = 'SUCCESS' WHERE id = $1",
      [event.id]
    );

    // 3. Verify audit chain
    const result = await verifyAuditChain();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Payload tampering detected/i);
    expect(result.tamperedEventId).toBe(event.id);

    // Revert modification to restore clean state for subsequent tests
    await db.query(
      "UPDATE audit_events SET outcome = 'DENIED' WHERE id = $1",
      [event.id]
    );

    const restoredResult = await verifyAuditChain();
    expect(restoredResult.isValid).toBe(true);
  });

  it('3. Detects modified current_hash (tampered hash)', async () => {
    const db = await getDb();

    // Record an event
    const event = await recordAuditEvent({
      actorId: userId,
      actorEmail: 'auditor.lead@trustvault.local',
      action: 'PERMISSION_REVOKE',
      targetType: 'PERMISSION',
      targetId: 'perm-tamper-1',
      outcome: 'SUCCESS'
    });

    // Alter the current_hash
    await db.query(
      "UPDATE audit_events SET current_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' WHERE id = $1",
      [event.id]
    );

    const result = await verifyAuditChain();
    expect(result.isValid).toBe(false);
    expect(result.tamperedEventId).toBe(event.id);

    // Restore original hash
    await db.query(
      'UPDATE audit_events SET current_hash = $1 WHERE id = $2',
      [event.current_hash, event.id]
    );

    const restored = await verifyAuditChain();
    expect(restored.isValid).toBe(true);
  });

  it('4. Detects broken link / deleted historical event', async () => {
    const db = await getDb();

    // Record two chained events
    const eventA = await recordAuditEvent({
      actorId: userId,
      action: 'BATCH_OP_A',
      targetType: 'SYSTEM',
      outcome: 'SUCCESS'
    });

    const eventB = await recordAuditEvent({
      actorId: userId,
      action: 'BATCH_OP_B',
      targetType: 'SYSTEM',
      outcome: 'SUCCESS'
    });

    // Malicious insider deletes eventA from database
    await db.query('DELETE FROM audit_events WHERE id = $1', [eventA.id]);

    // Chain verification should detect broken link at eventB because prev_hash still points to deleted eventA
    const result = await verifyAuditChain();
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Broken chain link/i);
    expect(result.tamperedEventId).toBe(eventB.id);

    // Clean up eventB for remaining test isolation
    await db.query('DELETE FROM audit_events WHERE id = $1', [eventB.id]);
  });

  it('5. Maintains integrity during concurrent audit event writes', async () => {
    // Fire 10 concurrent audit write operations simultaneously
    const writePromises = Array.from({ length: 10 }).map((_, index) =>
      recordAuditEvent({
        actorId: userId,
        actorEmail: 'auditor.lead@trustvault.local',
        action: `CONCURRENT_TEST_OP_${index}`,
        targetType: 'SYSTEM',
        outcome: 'SUCCESS',
        metadata: { concurrencyIndex: index }
      })
    );

    const writtenEvents = await Promise.all(writePromises);
    expect(writtenEvents).toHaveLength(10);

    // Verify complete chain after concurrent execution
    const verification = await verifyAuditChain();
    expect(verification.isValid).toBe(true);
  });

  it('6. API endpoint GET /api/audit/verify returns verification report', async () => {
    const res = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isValid');
    expect(res.body.isValid).toBe(true);
    expect(res.body).toHaveProperty('totalEvents');
    expect(res.body).toHaveProperty('hmacSignature');
    expect(res.body.message).toMatch(/intact and fully verified/i);
  });

  it('7. API endpoint GET /api/audit filters logs by action and targetType', async () => {
    const res = await request(app)
      .get('/api/audit?action=AUDIT_VERIFY')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
    res.body.events.forEach((ev: any) => {
      expect(ev.action).toBe('AUDIT_VERIFY');
    });
  });
});
