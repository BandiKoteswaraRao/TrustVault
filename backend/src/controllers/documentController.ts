import { Request, Response, NextFunction } from 'express';
import {
  uploadDocument,
  getOwnedDocuments,
  getSharedDocuments,
  getDocumentWithAuthorization,
  deleteDocument,
  updateDocument
} from '../services/documentService.js';
import { getFileReadStream } from '../services/fileStorageService.js';
import { recordAuditEvent } from '../services/auditService.js';

export async function handleUploadDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'No file uploaded. Please select a valid document file.'
      });
      return;
    }

    const { title, description } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Document title is required.'
      });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const doc = await uploadDocument({
      userId: req.user.id,
      userEmail: req.user.email,
      title,
      description,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      message: 'Document uploaded and securely stored.',
      document: doc
    });
  } catch (error) {
    next(error);
  }
}

export async function handleListOwnedDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await getOwnedDocuments(req.user.id, search, page, limit);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleListSharedDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const documents = await getSharedDocuments(req.user.id);
    res.status(200).json({ documents });
  } catch (error) {
    next(error);
  }
}

export async function handleGetDocumentDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const id = req.params.id as string;
    const result = await getDocumentWithAuthorization(id, req.user.id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleDownloadDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const id = req.params.id as string;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // Strict real-time authorization check
    const { document, accessType } = await getDocumentWithAuthorization(id, req.user.id);

    // Record audit event for authorized download
    await recordAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'DOCUMENT_DOWNLOAD',
      targetType: 'DOCUMENT',
      targetId: document.id,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: {
        fileName: document.file_name,
        accessType,
        checksum: document.sha256_checksum
      }
    });

    // Safe download headers preventing inline script execution and MIME confusion
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.file_name)}"`);
    res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");

    const fileStream = getFileReadStream(document.storage_path);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const id = req.params.id as string;
    const { title, description } = req.body;

    const doc = await updateDocument(id, req.user.id, { title, description });
    res.status(200).json({ message: 'Document updated successfully.', document: doc });
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const id = req.params.id as string;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    await deleteDocument(id, req.user.id, req.user.email, ipAddress, userAgent);
    res.status(200).json({ message: 'Document deleted successfully.' });
  } catch (error) {
    next(error);
  }
}
