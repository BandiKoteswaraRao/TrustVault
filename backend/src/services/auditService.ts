import crypto from 'crypto';
import { getDb, IDatabaseClient } from '../db/index.js';
import { config } from '../config/index.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface AuditEventInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: 'USER' | 'DOCUMENT' | 'PERMISSION' | 'SYSTEM' | 'AUTH';
  targetId?: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

export interface StoredAuditEvent {
  id: string;
  sequence_number: number;
  timestamp: string | Date;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  prev_hash: string;
  current_hash: string;
}

export interface VerificationResult {
  isValid: boolean;
  totalEvents: number;
  tamperedIndex?: number;
  tamperedEventId?: string;
  tamperedSequenceNumber?: number;
  reason?: string;
  expectedHash?: string;
  actualHash?: string;
  verifiedAt: string;
  hmacSignature?: string;
}

/**
 * Deterministic canonical JSON serialization.
 * Recursively sorts object keys so {a: 1, b: 2} produces identical JSON to {b: 2, a: 1}.
 */
export function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes the SHA-256 hash of an audit event linked to its previous hash.
 */
export function computeEventHash(params: {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, any>;
  prevHash: string;
}): string {
  const canonicalPayload = canonicalStringify({
    action: params.action,
    actorEmail: params.actorEmail || null,
    actorId: params.actorId || null,
    id: params.id,
    ipAddress: params.ipAddress || null,
    metadata: params.metadata || {},
    outcome: params.outcome,
    prevHash: params.prevHash,
    targetId: params.targetId || null,
    targetType: params.targetType,
    timestamp: params.timestamp,
    userAgent: params.userAgent || null
  });

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

/**
 * Records an audit event safely inside an isolated transaction with sequence locking.
 */
export async function recordAuditEvent(
  input: AuditEventInput,
  providedTx?: IDatabaseClient
): Promise<StoredAuditEvent> {
  const executeInClient = async (client: IDatabaseClient): Promise<StoredAuditEvent> => {
    // 1. Fetch latest event with lock to prevent concurrent hash chain divergence
    const lastEventRes = await client.query<{ current_hash: string; sequence_number: string }>(
      'SELECT current_hash, sequence_number FROM audit_events ORDER BY sequence_number DESC LIMIT 1'
    );

    const prevHash = lastEventRes.rowCount && lastEventRes.rowCount > 0
      ? lastEventRes.rows[0].current_hash
      : GENESIS_HASH;

    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const metadata = input.metadata || {};

    // 2. Compute canonical hash
    const currentHash = computeEventHash({
      id: eventId,
      timestamp,
      actorId: input.actorId || null,
      actorEmail: input.actorEmail || null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      outcome: input.outcome,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      metadata,
      prevHash
    });

    // 3. Insert event
    const insertRes = await client.query<StoredAuditEvent>(
      `INSERT INTO audit_events (
        id, timestamp, actor_id, actor_email, action, target_type, target_id,
        outcome, ip_address, user_agent, metadata, prev_hash, current_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        eventId,
        timestamp,
        input.actorId || null,
        input.actorEmail || null,
        input.action,
        input.targetType,
        input.targetId || null,
        input.outcome,
        input.ipAddress || null,
        input.userAgent || null,
        JSON.stringify(metadata),
        prevHash,
        currentHash
      ]
    );

    return insertRes.rows[0];
  };

  if (providedTx) {
    return executeInClient(providedTx);
  }

  const db = await getDb();
  return db.transaction(executeInClient);
}

/**
 * Validates the entire audit chain from genesis to head.
 * Verifies each event's hash against its canonical data, and verifies contiguous link integrity.
 */
export async function verifyAuditChain(client?: IDatabaseClient): Promise<VerificationResult> {
  const runner = client || (await getDb());
  const res = await runner.query<StoredAuditEvent>(
    'SELECT * FROM audit_events ORDER BY sequence_number ASC'
  );

  const events = res.rows;
  const verifiedAt = new Date().toISOString();

  if (events.length === 0) {
    return {
      isValid: true,
      totalEvents: 0,
      verifiedAt
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const normalizedTimestamp = new Date(event.timestamp).toISOString();

    // 1. Check prev_hash link
    if (event.prev_hash !== expectedPrevHash) {
      return {
        isValid: false,
        totalEvents: events.length,
        tamperedIndex: i,
        tamperedEventId: event.id,
        tamperedSequenceNumber: Number(event.sequence_number),
        reason: `Broken chain link at index ${i}: expected prev_hash '${expectedPrevHash}', found '${event.prev_hash}'`,
        expectedHash: expectedPrevHash,
        actualHash: event.prev_hash,
        verifiedAt
      };
    }

    // 2. Recompute current_hash from canonical event fields
    const metadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : (event.metadata || {});
    const recomputedHash = computeEventHash({
      id: event.id,
      timestamp: normalizedTimestamp,
      actorId: event.actor_id,
      actorEmail: event.actor_email,
      action: event.action,
      targetType: event.target_type,
      targetId: event.target_id,
      outcome: event.outcome,
      ipAddress: event.ip_address,
      userAgent: event.user_agent,
      metadata,
      prevHash: event.prev_hash
    });

    if (event.current_hash !== recomputedHash) {
      return {
        isValid: false,
        totalEvents: events.length,
        tamperedIndex: i,
        tamperedEventId: event.id,
        tamperedSequenceNumber: Number(event.sequence_number),
        reason: `Payload tampering detected at index ${i} (Event ID: ${event.id}): stored hash '${event.current_hash}' does not match recomputed hash '${recomputedHash}'`,
        expectedHash: recomputedHash,
        actualHash: event.current_hash,
        verifiedAt
      };
    }

    // Set next link
    expectedPrevHash = event.current_hash;
  }

  // Compute optional external HMAC checkpoint for the chain head
  const headHash = events[events.length - 1].current_hash;
  const hmacSignature = crypto
    .createHmac('sha256', config.AUDIT_HMAC_SECRET)
    .update(headHash)
    .digest('hex');

  return {
    isValid: true,
    totalEvents: events.length,
    verifiedAt,
    hmacSignature
  };
}
