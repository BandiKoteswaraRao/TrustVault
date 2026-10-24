import { Request, Response, NextFunction } from 'express';
import {
  grantPermission,
  revokePermission,
  getDocumentPermissions
} from '../services/permissionService.js';

export async function handleGrantPermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const documentId = req.params.id as string;
    const { granteeEmail, permissionLevel } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const perm = await grantPermission({
      documentId,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      granteeEmail,
      permissionLevel: permissionLevel || 'download',
      ipAddress,
      userAgent
    });

    res.status(201).json({
      message: `Access successfully granted to ${granteeEmail}.`,
      permission: perm
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRevokePermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const documentId = req.params.id as string;
    const permissionId = req.params.permissionId as string;
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    await revokePermission({
      documentId,
      permissionId,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      ipAddress,
      userAgent
    });

    res.status(200).json({
      message: 'Permission successfully revoked. Grantee no longer has access.'
    });
  } catch (error) {
    next(error);
  }
}

export async function handleListPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const documentId = req.params.id as string;
    const permissions = await getDocumentPermissions(documentId, req.user.id);

    res.status(200).json({ permissions });
  } catch (error) {
    next(error);
  }
}
