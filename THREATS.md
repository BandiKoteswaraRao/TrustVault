# TrustVault — Comprehensive Threat Model & Security Architecture

**Project:** TrustVault — Secure Document Sharing with a Real Audit Trail  
**Date:** 2026-10-24  
**Status:** Active & Maintained  
**Security Standard:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), STRIDE Methodology  

---

## 1. System Overview & Security Objectives

TrustVault provides secure digital document storage, fine-grained multi-party access delegation, immediate access revocation, and an append-only, SHA-256 hash-linked audit trail with tamper verification.

### Core Security Objectives:
1. **Confidentiality:** Documents are accessible strictly by their authenticated owner and currently active grantees. No unauthenticated or unauthorized actor can view document metadata or binary contents.
2. **Integrity:** Audit records are cryptographically chained with SHA-256 links. Any modification, insertion, truncation, or reordering of audit events is immediately flagged by the verification algorithm.
3. **Availability & Resilience:** API endpoints are protected against denial-of-service, brute-force password guessing, and resource exhaustion via rate limiting and strict file-size limits.
4. **Non-Repudiation:** Every security-sensitive operation (authentication, upload, share, revoke, download, audit verification) produces an immutable audit record tied to the authenticated actor context.
5. **Defense-in-Depth:** Validation and authorization are strictly enforced at the backend API layer. UI button states are cosmetic and never trusted.

---

## 2. Assets Requiring Protection

| Asset | Description | Sensitivity |
| :--- | :--- | :--- |
| **User Credentials** | User passwords, password hashes, and session/JWT tokens. | **Critical** |
| **Stored Documents** | Encrypted/raw document blobs uploaded by users into private storage. | **Critical** |
| **Document Metadata** | File names, MIME types, owners, sizes, and timestamps. | **High** |
| **Permission Grants** | Records granting read/download rights to specific recipient users. | **High** |
| **Audit Log Trail** | Cryptographically hash-linked record of all security-sensitive events. | **High** |
| **System Secrets** | `JWT_SECRET`, database connection credentials, and audit HMAC keys. | **Critical** |

---

## 3. Trust Boundaries & Data Flow Diagram

```
+---------------------------------------------------------------------------------+
|                                 UNTRUSTED ZONE                                  |
|                                                                                 |
|   +-----------------------+              +----------------------------------+   |
|   | Browser / Web Client  |              | Attacker / Automated API Scripts |   |
|   +-----------+-----------+              +-----------------+----------------+   |
+---------------|--------------------------------------------|--------------------+
                | HTTPS (TLS 1.3)                            |
================|============================================|=====================
                | TRUST BOUNDARY 1: Perimeter Security       |
                v                                            v
+---------------------------------------------------------------------------------+
|                                 DMZ / API LAYER                                 |
|                                                                                 |
|   [ Express.js Reverse Proxy / Server ]                                         |
|     ├─ Helmet HTTP Security Headers (CSP, HSTS, X-Frame-Options)                |
|     ├─ Strict CORS Validation                                                   |
|     ├─ Global & Auth-Specific Rate Limiters                                     |
|     ├─ Request Body & Query Validation (Zod Schemas)                            |
|     └─ JWT Authentication Middleware (Bearer Header Validation)                 |
+---------------------------------------------------------------------------------+
                | Validated, Authenticated Request Context
================|==================================================================
                | TRUST BOUNDARY 2: Core Domain & Authorization
                v
+---------------------------------------------------------------------------------+
|                         APPLICATION CORE & AUTHORIZATION                        |
|                                                                                 |
|     ├─ Document Service (Ownership enforcement, UUID storage resolution)         |
|     ├─ Permission Service (Owner-only delegation, immediate revocation checks)  |
|     ├─ File Storage Engine (Private storage, magic-byte MIME validation)        |
|     └─ Audit Service (Canonical SHA-256 hash-chaining in DB transactions)        |
+---------------------------------------------------------------------------------+
                | Parameterized SQL Queries & File I/O
================|==================================================================
                | TRUST BOUNDARY 3: Persistent Storage
                v
+------------------------------------+    +---------------------------------------+
| PostgreSQL Relational Database     |    | Private Local / Cloud Object Storage  |
|  - Users (Argon2id/Bcrypt hashes)  |    |  - Non-executable isolated directory  |
|  - Documents (Metadata & status)   |    |  - UUID filename mapping              |
|  - Permissions (Active & revoked)  |    |  - No public HTTP exposure            |
|  - Audit Events (Hash-linked chain)|    |                                       |
+------------------------------------+    +---------------------------------------+
```

---

## 4. Threat Actor Profiles & Assumed Capabilities

1. **Unauthenticated Public Attacker:**
   - Capabilities: Can probe all public endpoints, attempt credential stuffing, brute-force logins, send malformed JSON payloads, manipulate query params and headers, and forge requests.
2. **Authenticated Malicious User (User A vs User B):**
   - Capabilities: Has valid credentials and valid JWT. Can inspect browser requests, manipulate document UUIDs (BOLA/IDOR), forge permission grant/revoke requests, attempt to access documents owned by other users, and attempt privilege escalation.
3. **Revoked Recipient:**
   - Capabilities: Previously had legitimate access to a document. Possesses historical document IDs and download URLs. Tries to continue downloading after the owner revokes access.
4. **Compromised Insider / DB Modifier:**
   - Capabilities: Read/write access to the database rows directly. Attempts to modify historical audit events, delete evidence of access, or alter timestamps.

---

## 5. Threat Scenarios, Impact, Likelihood & Mitigations

### Threat 1: Broken Object-Level Authorization (BOLA / IDOR)
- **Scenario:** User A changes `documentId` in `GET /api/documents/:id` or `GET /api/documents/:id/download` to target User B's document.
- **Likelihood:** High | **Impact:** Critical
- **Mitigation:** The authorization service checks whether `actingUserId === document.owner_id` OR there exists an active, non-revoked permission row `document_id === id AND grantee_id === actingUserId AND revoked_at IS NULL`. If neither matches, returns `403 Forbidden` (or `404 Not Found` to prevent resource enumeration).
- **Enforcement Location:** `backend/src/middleware/authorize.ts`, `backend/src/services/documentService.ts`
- **Automated Test:** `tests/security/authorization.test.ts` -> *"User A cannot access or download User B's private document"*

### Threat 2: Broken Function-Level Authorization (BFLA) & Privilege Escalation
- **Scenario:** A document recipient attempts to grant access to a third party (`POST /api/documents/:id/permissions`) or revoke access (`DELETE /api/documents/:id/permissions/:permId`).
- **Likelihood:** Medium | **Impact:** High
- **Mitigation:** Permission management endpoints explicitly verify that `actingUserId === document.owner_id`. Grantees/recipients are strictly prohibited from delegating or revoking permissions.
- **Enforcement Location:** `backend/src/controllers/permissionController.ts`
- **Automated Test:** `tests/security/authorization.test.ts` -> *"Recipient cannot grant or revoke document permissions"*

### Threat 3: Unauthorized Access Post-Revocation
- **Scenario:** Owner grants User B access, User B confirms download works. Owner revokes User B's access. User B attempts immediate subsequent download.
- **Likelihood:** High | **Impact:** Critical
- **Mitigation:** Permissions are checked dynamically on every single download request in real time against the PostgreSQL database. There is no client-side caching or long-lived static download link. When `revoked_at` is set, subsequent requests fail immediately with `403 Forbidden`.
- **Enforcement Location:** `backend/src/services/permissionService.ts`, `backend/src/controllers/documentController.ts`
- **Automated Test:** `tests/security/authorization.test.ts` -> *"Revoked user cannot download document post-revocation"*

### Threat 4: Account Takeover & Brute-Force Attacks
- **Scenario:** Attacker launches automated dictionary attacks against `/api/auth/login`.
- **Likelihood:** High | **Impact:** High
- **Mitigation:**
  - Strict rate limiting via `express-rate-limit` (max 10 attempts per 15 minutes per IP on auth routes).
  - High-work-factor password hashing (Argon2id / bcrypt with 12 salt rounds).
  - Generic authentication error messages ("Invalid email or password") preventing username enumeration.
  - Normalized email addresses (`email.trim().toLowerCase()`).
- **Enforcement Location:** `backend/src/middleware/rateLimiter.ts`, `backend/src/services/authService.ts`
- **Automated Test:** `tests/security/auth.test.ts` -> *"Rate limiter blocks rapid login attempts"* & *"Returns generic error on failed login"*

### Threat 5: SQL Injection
- **Scenario:** Attacker sends malicious SQL payloads in inputs (e.g. `' OR '1'='1`).
- **Likelihood:** Medium | **Impact:** Critical
- **Mitigation:** All database queries utilize parameterized queries exclusively (`$1, $2, ...` in pg driver). No raw string concatenation or interpolation into SQL queries is permitted.
- **Enforcement Location:** `backend/src/db/index.ts`, `backend/src/models/*`
- **Automated Test:** `tests/security/inputValidation.test.ts` -> *"Parameterized queries safely handle SQL injection payloads"*

### Threat 6: Cross-Site Scripting (XSS)
- **Scenario:** Attacker inputs malicious script tags into document title, description, or user profile (`<script>alert(1)</script>`).
- **Likelihood:** Medium | **Impact:** High
- **Mitigation:**
  - Input validation and sanitization using Zod schemas.
  - React auto-escaping on DOM rendering.
  - Helmet Content-Security-Policy (CSP) headers restricting script execution sources.
- **Enforcement Location:** `backend/src/middleware/validate.ts`, `backend/src/app.ts`
- **Automated Test:** `tests/security/inputValidation.test.ts` -> *"XSS payloads in document titles are safely escaped and rejected/sanitized"*

### Threat 7: Malicious File Uploads & Path Traversal
- **Scenario:** Attacker attempts to upload executable binaries (`.exe`, `.sh`, `.php`), HTML with embedded JS, or filenames containing path traversal sequences (`../../etc/passwd`).
- **Likelihood:** High | **Impact:** Critical
- **Mitigation:**
  - Storage paths are generated server-side using cryptographically secure UUIDv4 identifiers. Original filenames are preserved only as sanitized metadata in the database.
  - Strict file extension and MIME type allowlist (e.g. PDF, PNG, JPEG, TXT, DOCX).
  - File signature / magic byte inspection to verify content matches declared MIME type.
  - Max file size enforcement (10MB).
  - Uploaded files are saved outside the web root (`storage/uploads`) without executable filesystem permissions.
  - Files are served with `Content-Disposition: attachment; filename="..."` and `X-Content-Type-Options: nosniff`.
- **Enforcement Location:** `backend/src/middleware/upload.ts`, `backend/src/services/fileStorageService.ts`
- **Automated Test:** `tests/security/fileUpload.test.ts` -> *"Rejects executable and path traversal file uploads"*

### Threat 8: Tampering with the Audit Trail
- **Scenario:** Malicious actor modifies, deletes, inserts, or re-orders audit log rows in the database.
- **Likelihood:** Medium | **Impact:** High
- **Mitigation:**
  - Each audit event includes a SHA-256 hash computed over: `canonical_json(event_id, timestamp, actor_id, action, target_id, outcome, metadata, prev_hash)`.
  - The hash of the previous event (`prev_hash`) links every record into a continuous chain.
  - Genesis event has `prev_hash: '0000000000000000000000000000000000000000000000000000000000000000'`.
  - Dedicated verification algorithm re-calculates hashes sequentially and validates link integrity.
  - Detects first point of corruption, altered payload, or broken link.
- **Enforcement Location:** `backend/src/services/auditService.ts`
- **Automated Test:** `tests/security/auditIntegrity.test.ts` -> *"Detects modified payload, broken hash link, deleted event, and reordered events"*

### Threat 9: Race Conditions on Concurrent Writes
- **Scenario:** Concurrent permission revocation and download requests, or concurrent audit event creation causing broken hash chains.
- **Likelihood:** Low | **Impact:** Medium
- **Mitigation:**
  - Database transactions with appropriate isolation levels.
  - Strict sequence serialization for audit event hash computation using database advisory locks or sequential transaction wrapping.
- **Enforcement Location:** `backend/src/services/auditService.ts`
- **Automated Test:** `tests/security/auditIntegrity.test.ts` -> *"Concurrent audit writes preserve sequential hash chain validity"*

### Threat 10: Information Leakage in Error Messages
- **Scenario:** Database connection errors or unexpected exceptions expose stack traces, database credentials, or internal filesystem paths to clients.
- **Likelihood:** Medium | **Impact:** Medium
- **Mitigation:**
  - Centralized Express error handler catches all unhandled exceptions.
  - Returns sanitized error responses (`{ error: 'Internal Server Error', message: 'An unexpected error occurred.' }`).
  - Stack traces logged server-side only in development mode; never sent in production responses.
- **Enforcement Location:** `backend/src/middleware/errorHandler.ts`
- **Automated Test:** `tests/security/errorHandling.test.ts` -> *"Internal errors do not leak stack traces or system paths"*

---

## 6. Security Traceability Matrix

| Threat Code | Threat Description | Source Code Location | Automated Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | BOLA / Cross-User Access | `backend/src/middleware/authorize.ts` | `tests/security/authorization.test.ts` | Fully Implemented & Tested |
| **SEC-02** | BFLA / Unauthorized Permission Delegation | `backend/src/controllers/permissionController.ts` | `tests/security/authorization.test.ts` | Fully Implemented & Tested |
| **SEC-03** | Immediate Revocation Enforcement | `backend/src/services/permissionService.ts` | `tests/security/authorization.test.ts` | Fully Implemented & Tested |
| **SEC-04** | Rate Limiting & Brute Force | `backend/src/middleware/rateLimiter.ts` | `tests/security/auth.test.ts` | Fully Implemented & Tested |
| **SEC-05** | SQL Injection via Parameterization | `backend/src/db/index.ts` | `tests/security/inputValidation.test.ts` | Fully Implemented & Tested |
| **SEC-06** | XSS Mitigation & Headers | `backend/src/app.ts` (Helmet + CORS) | `tests/security/inputValidation.test.ts` | Fully Implemented & Tested |
| **SEC-07** | Malicious Upload & Path Traversal | `backend/src/middleware/upload.ts` | `tests/security/fileUpload.test.ts` | Fully Implemented & Tested |
| **SEC-08** | Audit Hash Chain Verification | `backend/src/services/auditService.ts` | `tests/security/auditIntegrity.test.ts` | Fully Implemented & Tested |
| **SEC-09** | Concurrent Audit Write Safety | `backend/src/services/auditService.ts` | `tests/security/auditIntegrity.test.ts` | Fully Implemented & Tested |
| **SEC-10** | Error Information Leakage | `backend/src/middleware/errorHandler.ts` | `tests/security/errorHandling.test.ts` | Fully Implemented & Tested |

---

## 7. Residual Risks & Architectural Limitations

1. **Same-Database Audit Trail Limitation:**
   - *Limitation:* If an attacker obtains full superuser write access to the PostgreSQL database, they could theoretically alter a historical row and recompute all subsequent hashes in the chain.
   - *Mitigation & Defense:* In TrustVault, we implement an optional external HMAC checkpoint anchor (`AUDIT_HMAC_SECRET`) and document that for enterprise immutable compliance, chain head hashes should be mirrored to an external write-once-read-many (WORM) storage or append-only ledger (e.g. AWS S3 Object Lock, Cloudflare R2 with retention, or public timestamping).
2. **Ephemeral Cloud Storage in Free Tiers:**
   - *Limitation:* Certain free container hosts (e.g., standard Render free instances) feature ephemeral container filesystems where uploaded files are reset on container restart unless persistent disks or external S3-compatible storage (e.g. Supabase Storage, Cloudflare R2, AWS S3) is configured.
   - *Mitigation:* The storage service abstracts the storage interface (`StorageProvider`), supporting both secure local disk storage and cloud object storage seamlessly.
