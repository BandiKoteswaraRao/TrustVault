import path from 'path';
import { query, transaction } from '../db/index.js';
import { validateFileSafety, saveFile, deleteStoredFile } from './fileStorageService.js';
import { recordAuditEvent } from './auditService.js';

export interface DocumentRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  file_name: string;
  storage_path: string;
  file_size: string | number;
  mime_type: string;
  sha256_checksum: string;
  created_at: string;
  updated_at: string;
  owner_email?: string;
  owner_name?: string;
  access_type?: 'owner' | 'grantee';
}

export async function uploadDocument(params: {
  userId: string;
  userEmail: string;
  title: string;
  description?: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  ipAddress?: string;
  userAgent?: string;
}): Promise<DocumentRow> {
  // 1. Validate file safety (extension + magic bytes)
  validateFileSafety(params.originalName, params.buffer, params.mimeType);

  // 2. Persist to isolated storage with UUIDv4 filename
  const { storageFilename, checksum } = await saveFile(params.buffer, params.originalName);

  try {
    // 3. Insert record into database inside transaction with audit trail
    return await transaction(async (tx) => {
      const docRes = await tx.query<DocumentRow>(
        `INSERT INTO documents (
          owner_id, title, description, file_name, storage_path, file_size, mime_type, sha256_checksum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          params.userId,
          params.title.trim(),
          params.description ? params.description.trim() : null,
          path.basename(params.originalName),
          storageFilename,
          params.buffer.length,
          params.mimeType,
          checksum
        ]
      );

      const doc = docRes.rows[0];

      // Record audit event
      await recordAuditEvent(
        {
          actorId: params.userId,
          actorEmail: params.userEmail,
          action: 'DOCUMENT_UPLOAD',
          targetType: 'DOCUMENT',
          targetId: doc.id,
          outcome: 'SUCCESS',
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: {
            fileName: doc.file_name,
            fileSize: doc.file_size,
            mimeType: doc.mime_type,
            checksum: doc.sha256_checksum
          }
        },
        tx
      );

      return doc;
    });
  } catch (error) {
    // Clean up uploaded file on database failure
    await deleteStoredFile(storageFilename);
    throw error;
  }
}

export async function getOwnedDocuments(
  userId: string,
  search?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ documents: DocumentRow[]; total: number; page: number; totalPages: number }> {
  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM documents WHERE owner_id = $1';
  const queryParams: any[] = [userId];

  if (search && search.trim()) {
    queryParams.push(`%${search.trim()}%`);
    sql += ` AND (title ILIKE $${queryParams.length} OR file_name ILIKE $${queryParams.length})`;
  }

  // Count total
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countRes = await query<{ count: string }>(countSql, queryParams);
  const total = parseInt(countRes.rows[0]?.count || '0', 10);

  // Pagination
  queryParams.push(limit);
  sql += ` ORDER BY created_at DESC LIMIT $${queryParams.length}`;
  queryParams.push(offset);
  sql += ` OFFSET $${queryParams.length}`;

  const docsRes = await query<DocumentRow>(sql, queryParams);

  return {
    documents: docsRes.rows.map(d => ({ ...d, access_type: 'owner' })),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getSharedDocuments(userId: string): Promise<DocumentRow[]> {
  const sql = `
    SELECT d.*, u.email as owner_email, u.full_name as owner_name, p.permission_level, p.created_at as shared_at
    FROM documents d
    JOIN document_permissions p ON p.document_id = d.id
    JOIN users u ON u.id = d.owner_id
    WHERE p.grantee_id = $1 AND p.revoked_at IS NULL
    ORDER BY p.created_at DESC
  `;

  const res = await query<DocumentRow>(sql, [userId]);
  return res.rows.map(d => ({ ...d, access_type: 'grantee' }));
}

export async function getDocumentWithAuthorization(
  documentId: string,
  userId: string
): Promise<{ document: DocumentRow; accessType: 'owner' | 'grantee'; permissionLevel: string }> {
  // 1. Fetch document
  const docRes = await query<DocumentRow>(
    `SELECT d.*, u.email as owner_email, u.full_name as owner_name
     FROM documents d
     JOIN users u ON u.id = d.owner_id
     WHERE d.id = $1`,
    [documentId]
  );

  if (docRes.rowCount === 0) {
    const error: any = new Error('Document not found.');
    error.statusCode = 404;
    throw error;
  }

  const document = docRes.rows[0];

  // 2. Check if owner
  if (document.owner_id === userId) {
    return { document, accessType: 'owner', permissionLevel: 'admin' };
  }

  // 3. Check active permission
  const permRes = await query<{ permission_level: string }>(
    `SELECT permission_level
     FROM document_permissions
     WHERE document_id = $1 AND grantee_id = $2 AND revoked_at IS NULL`,
    [documentId, userId]
  );

  if (permRes.rowCount && permRes.rowCount > 0) {
    return {
      document,
      accessType: 'grantee',
      permissionLevel: permRes.rows[0].permission_level
    };
  }

  // Requester has no ownership and no active permission
  const error: any = new Error('Access denied: You do not have permission to access this document.');
  error.statusCode = 403;
  throw error;
}

export async function deleteDocument(
  documentId: string,
  userId: string,
  userEmail: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const docRes = await query<DocumentRow>(
    'SELECT * FROM documents WHERE id = $1',
    [documentId]
  );

  if (docRes.rowCount === 0) {
    const error: any = new Error('Document not found.');
    error.statusCode = 404;
    throw error;
  }

  const doc = docRes.rows[0];

  // Strict ownership check (BOLA / IDOR defense)
  if (doc.owner_id !== userId) {
    const error: any = new Error('Access denied: Only the document owner can delete this document.');
    error.statusCode = 403;
    throw error;
  }

  await transaction(async (tx) => {
    // Delete from database (cascade deletes permissions)
    await tx.query('DELETE FROM documents WHERE id = $1', [documentId]);

    // Record audit event
    await recordAuditEvent(
      {
        actorId: userId,
        actorEmail: userEmail,
        action: 'DOCUMENT_DELETE',
        targetType: 'DOCUMENT',
        targetId: documentId,
        outcome: 'SUCCESS',
        ipAddress,
        userAgent,
        metadata: { fileName: doc.file_name, storagePath: doc.storage_path }
      },
      tx
    );
  });

  // Delete physical file
  await deleteStoredFile(doc.storage_path);
}

export async function updateDocument(
  documentId: string,
  userId: string,
  data: { title: string; description?: string }
): Promise<DocumentRow> {
  const docRes = await query<DocumentRow>('SELECT * FROM documents WHERE id = $1', [documentId]);
  if (docRes.rowCount === 0) {
    const error: any = new Error('Document not found.');
    error.statusCode = 404;
    throw error;
  }

  const doc = docRes.rows[0];

  // Strict ownership check
  if (doc.owner_id !== userId) {
    const error: any = new Error('Access denied: Only the document owner can update document details.');
    error.statusCode = 403;
    throw error;
  }

  const updated = await query<DocumentRow>(
    `UPDATE documents
     SET title = $1, description = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [data.title.trim(), data.description ? data.description.trim() : null, documentId]
  );

  return updated.rows[0];
}
