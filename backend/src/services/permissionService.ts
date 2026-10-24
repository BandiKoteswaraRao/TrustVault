import { query, transaction } from '../db/index.js';
import { recordAuditEvent } from './auditService.js';

export interface PermissionRow {
  id: string;
  document_id: string;
  grantee_id: string;
  grantee_email: string;
  grantee_name: string;
  granted_by: string;
  permission_level: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export async function grantPermission(params: {
  documentId: string;
  ownerId: string;
  ownerEmail: string;
  granteeEmail: string;
  permissionLevel: 'read' | 'download';
  ipAddress?: string;
  userAgent?: string;
}): Promise<PermissionRow> {
  const normalizedGranteeEmail = params.granteeEmail.trim().toLowerCase();

  // 1. Verify document exists and requester is the true OWNER
  const docRes = await query<{ id: string; owner_id: string; title: string }>(
    'SELECT id, owner_id, title FROM documents WHERE id = $1',
    [params.documentId]
  );

  if (docRes.rowCount === 0) {
    const error: any = new Error('Document not found.');
    error.statusCode = 404;
    throw error;
  }

  const doc = docRes.rows[0];

  // BFLA enforcement: Only document owner can grant permissions
  if (doc.owner_id !== params.ownerId) {
    const error: any = new Error('Access denied: Only the document owner can grant sharing permissions.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Lookup grantee user
  const granteeRes = await query<{ id: string; email: string; full_name: string }>(
    'SELECT id, email, full_name FROM users WHERE LOWER(email) = $1',
    [normalizedGranteeEmail]
  );

  if (granteeRes.rowCount === 0) {
    const error: any = new Error(`User with email '${normalizedGranteeEmail}' does not exist.`);
    error.statusCode = 404;
    throw error;
  }

  const grantee = granteeRes.rows[0];

  // Cannot share with self
  if (grantee.id === params.ownerId) {
    const error: any = new Error('You cannot grant permissions to yourself as the document owner.');
    error.statusCode = 400;
    throw error;
  }

  // Check if active permission already exists
  const existingActive = await query(
    'SELECT id FROM document_permissions WHERE document_id = $1 AND grantee_id = $2 AND revoked_at IS NULL',
    [params.documentId, grantee.id]
  );

  if (existingActive.rowCount && existingActive.rowCount > 0) {
    const error: any = new Error(`Document is already actively shared with ${normalizedGranteeEmail}.`);
    error.statusCode = 409;
    throw error;
  }

  // 3. Insert permission & record audit event in atomic transaction
  return await transaction(async (tx) => {
    const permRes = await tx.query<{
      id: string;
      document_id: string;
      grantee_id: string;
      granted_by: string;
      permission_level: string;
      created_at: string;
      revoked_at: string | null;
      revoked_by: string | null;
    }>(
      `INSERT INTO document_permissions (
        document_id, grantee_id, granted_by, permission_level
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [params.documentId, grantee.id, params.ownerId, params.permissionLevel]
    );

    const perm = permRes.rows[0];

    // Record audit event
    await recordAuditEvent(
      {
        actorId: params.ownerId,
        actorEmail: params.ownerEmail,
        action: 'PERMISSION_GRANT',
        targetType: 'PERMISSION',
        targetId: perm.id,
        outcome: 'SUCCESS',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          documentId: params.documentId,
          granteeId: grantee.id,
          granteeEmail: grantee.email,
          permissionLevel: params.permissionLevel
        }
      },
      tx
    );

    return {
      ...perm,
      grantee_email: grantee.email,
      grantee_name: grantee.full_name
    };
  });
}

export async function revokePermission(params: {
  documentId: string;
  permissionId: string;
  ownerId: string;
  ownerEmail: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  // 1. Verify document and check owner
  const docRes = await query<{ id: string; owner_id: string }>(
    'SELECT id, owner_id FROM documents WHERE id = $1',
    [params.documentId]
  );

  if (docRes.rowCount === 0) {
    const error: any = new Error('Document not found.');
    error.statusCode = 404;
    throw error;
  }

  if (docRes.rows[0].owner_id !== params.ownerId) {
    const error: any = new Error('Access denied: Only the document owner can revoke permissions.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Fetch permission
  const permRes = await query<{ id: string; grantee_id: string; revoked_at: string | null }>(
    'SELECT id, grantee_id, revoked_at FROM document_permissions WHERE id = $1 AND document_id = $2',
    [params.permissionId, params.documentId]
  );

  if (permRes.rowCount === 0) {
    const error: any = new Error('Permission record not found.');
    error.statusCode = 404;
    throw error;
  }

  const perm = permRes.rows[0];
  if (perm.revoked_at !== null) {
    const error: any = new Error('Permission has already been revoked.');
    error.statusCode = 400;
    throw error;
  }

  // 3. Revoke inside transaction with audit trail
  await transaction(async (tx) => {
    await tx.query(
      `UPDATE document_permissions
       SET revoked_at = NOW(), revoked_by = $1
       WHERE id = $2`,
      [params.ownerId, params.permissionId]
    );

    // Record audit event
    await recordAuditEvent(
      {
        actorId: params.ownerId,
        actorEmail: params.ownerEmail,
        action: 'PERMISSION_REVOKE',
        targetType: 'PERMISSION',
        targetId: params.permissionId,
        outcome: 'SUCCESS',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: {
          documentId: params.documentId,
          granteeId: perm.grantee_id,
          permissionId: params.permissionId
        }
      },
      tx
    );
  });
}

export async function getDocumentPermissions(
  documentId: string,
  userId: string
): Promise<PermissionRow[]> {
  // 1. Verify requester is the OWNER (recipients must NOT view permission list)
  const docRes = await query<{ owner_id: string }>(
    'SELECT owner_id FROM documents WHERE id = $1',
    [documentId]
  );

  if (docRes.rowCount === 0) {
    const error: any = new Error('Document not found.');
    error.statusCode = 404;
    throw error;
  }

  if (docRes.rows[0].owner_id !== userId) {
    const error: any = new Error('Access denied: Only the document owner can view permissions.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Fetch permissions with grantee user details
  const sql = `
    SELECT p.*, u.email as grantee_email, u.full_name as grantee_name
    FROM document_permissions p
    JOIN users u ON u.id = p.grantee_id
    WHERE p.document_id = $1
    ORDER BY p.created_at DESC
  `;

  const res = await query<PermissionRow>(sql, [documentId]);
  return res.rows;
}
