import { Router } from 'express';
import { handleGetAuditLogs, handleVerifyAuditTrail } from '../controllers/auditController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Authentication required to access audit trails or trigger integrity verification
router.use(authenticateToken);

router.get('/', handleGetAuditLogs);
router.get('/verify', handleVerifyAuditTrail);

export default router;
