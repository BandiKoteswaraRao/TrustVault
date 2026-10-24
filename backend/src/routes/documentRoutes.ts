import { Router } from 'express';
import {
  handleUploadDocument,
  handleListOwnedDocuments,
  handleListSharedDocuments,
  handleGetDocumentDetails,
  handleDownloadDocument,
  handleUpdateDocument,
  handleDeleteDocument
} from '../controllers/documentController.js';
import {
  handleGrantPermission,
  handleRevokePermission,
  handleListPermissions
} from '../controllers/permissionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { validateBody, grantPermissionSchema, updateDocumentSchema } from '../middleware/validate.js';

const router = Router();

// Every document operation strictly requires server-side token authentication
router.use(authenticateToken);

// Document CRUD & Listing
router.post('/', uploadMiddleware.single('file'), handleUploadDocument);
router.get('/', handleListOwnedDocuments);
router.get('/shared', handleListSharedDocuments);
router.get('/:id', handleGetDocumentDetails);
router.get('/:id/download', handleDownloadDocument);
router.patch('/:id', validateBody(updateDocumentSchema), handleUpdateDocument);
router.delete('/:id', handleDeleteDocument);

// Permission Management (Owner-enforced)
router.post('/:id/permissions', validateBody(grantPermissionSchema), handleGrantPermission);
router.get('/:id/permissions', handleListPermissions);
router.delete('/:id/permissions/:permissionId', handleRevokePermission);

export default router;
