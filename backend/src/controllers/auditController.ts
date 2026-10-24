import { Request, Response, NextFunction } from 'express';
import { query } from '../db/index.js';
import { verifyAuditChain, recordAuditEvent, StoredAuditEvent } from '../services/auditService.js';

export async function handleGetAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const { action, outcome, targetType, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const queryParams: any[] = [];
    const whereClauses: string[] = [];

    // Authorization scoping:
    // If ordinary user, only show events where user is the actor OR target document is owned by user
    if (req.user.role !== 'admin') {
      queryParams.push(req.user.id);
      whereClauses.push(
        `(actor_id = $${queryParams.length} OR target_id IN (SELECT id::text FROM documents WHERE owner_id = $${queryParams.length}))`
      );
    }

    if (action && typeof action === 'string') {
      queryParams.push(action);
      whereClauses.push(`action = $${queryParams.length}`);
    }

    if (outcome && typeof outcome === 'string') {
      queryParams.push(outcome);
      whereClauses.push(`outcome = $${queryParams.length}`);
    }

    if (targetType && typeof targetType === 'string') {
      queryParams.push(targetType);
      whereClauses.push(`target_type = $${queryParams.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_events ${whereSql}`,
      queryParams
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    // Fetch records
    queryParams.push(limitNum);
    const limitClause = `LIMIT $${queryParams.length}`;
    queryParams.push(offset);
    const offsetClause = `OFFSET $${queryParams.length}`;

    const eventsRes = await query<StoredAuditEvent>(
      `SELECT * FROM audit_events ${whereSql} ORDER BY sequence_number DESC ${limitClause} ${offsetClause}`,
      queryParams
    );

    res.status(200).json({
      events: eventsRes.rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    next(error);
  }
}

export async function handleVerifyAuditTrail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const result = await verifyAuditChain();

    // Log the verification action itself into the audit trail
    await recordAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'AUDIT_VERIFY',
      targetType: 'SYSTEM',
      outcome: result.isValid ? 'SUCCESS' : 'FAILURE',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        totalEventsVerified: result.totalEvents,
        tamperedIndex: result.tamperedIndex,
        reason: result.reason
      }
    });

    res.status(200).json({
      ...result,
      message: result.isValid
        ? 'Audit trail cryptographic chain is intact and fully verified.'
        : `Cryptographic tampering detected in audit log: ${result.reason}`
    });
  } catch (error) {
    next(error);
  }
}
