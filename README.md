# TrustVault — Secure Document Sharing with a Real Audit Trail

[![Security: OWASP Top 10](https://img.shields.io/badge/Security-OWASP%20Top%2010%20Verified-emerald.svg)](THREATS.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791.svg)](https://www.postgresql.org/)
[![Audit: SHA--256 Chained](https://img.shields.io/badge/Audit-SHA--256%20Cryptographic%20Chain-purple.svg)](docs/DEMO_SCRIPT.md)
[![Tests: 34 Passing](https://img.shields.io/badge/Tests-34%20Passing%20(100%25)-brightgreen.svg)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TrustVault is an enterprise-grade digital document storage and controlled sharing platform engineered from scratch with **server-enforced zero-trust authorization**, **isolated UUID storage**, **immediate permission revocation**, and an **append-only, SHA-256 hash-linked cryptographic audit trail** with automated mathematical tamper verification.

---

## 1. Project Overview & Problem Statement

Digital documents are frequently shared between individuals and organizations, introducing grave risks of:
- **Broken Object-Level Authorization (IDOR / BOLA):** Attackers manipulating document UUIDs or IDs in API requests to access confidential records.
- **Broken Function-Level Authorization (BFLA):** Document recipients delegating access to unauthorized third parties or revoking legitimate owners.
- **Dangling Access Post-Revocation:** Systems that rely on cached tokens or pre-signed URLs allowing continued access after permissions are revoked.
- **Accountability Vacuum & Audit Tampering:** File sharing systems that lack audit records, or store mutable log rows that can be silently altered, truncated, or re-ordered by malicious insiders.

**TrustVault solves this comprehensively:**
1. **Zero-Trust Access Control:** Frontend UI button states are cosmetic; every single download and document operation dynamically queries PostgreSQL for active, non-revoked authorization in real time.
2. **Immediate Access Revocation:** The instant an owner revokes access, all subsequent download attempts by the grantee fail immediately with HTTP 403 Forbidden.
3. **Cryptographic SHA-256 Audit Trail:** Every sensitive operation (login, upload, download, share, revoke, verification) is sealed in an append-only hash chain linking each record to its predecessor.
4. **Automated Mathematical Tamper Detection:** A built-in verification engine recalculates the canonical hash chain from genesis to head, identifying exact event corruption indices, broken links, and altered payloads.

---

## 2. System Architecture & Request Data Flow

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
|   [ Express.js REST API ]                                                       |
|     ├─ Helmet HTTP Security Headers (CSP, HSTS, X-Frame-Options, noSniff)       |
|     ├─ Strict CORS Policy (Configured Origin Only)                              |
|     ├─ Rate Limiting (Global 100 req/15m; Auth 10 attempts/15m)                 |
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
|     ├─ File Storage Engine (Isolated storage, magic-byte MIME validation)       |
|     └─ Audit Service (Canonical SHA-256 hash-chaining in DB transactions)        |
+---------------------------------------------------------------------------------+
                | Parameterized SQL Queries & File I/O
================|==================================================================
                | TRUST BOUNDARY 3: Persistent Storage
                v
+------------------------------------+    +---------------------------------------+
| PostgreSQL Relational Database     |    | Private Local / Cloud Object Storage  |
|  - Users (Bcrypt hashes, salt 12)  |    |  - Non-executable isolated directory  |
|  - Documents (Metadata & status)   |    |  - UUID filename mapping              |
|  - Permissions (Active & revoked)  |    |  - No public HTTP exposure            |
|  - Audit Events (Hash-linked chain)|    |                                       |
+------------------------------------+    +---------------------------------------+
```

---

## 3. Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js LTS, Express, TypeScript, Multer
- **Database:** PostgreSQL 16 (with reproducible SQL migrations, connection pooling, and embedded PGlite WASM test engine)
- **Password Hashing:** Bcrypt with 12 salt rounds
- **Authentication:** Short-lived JWTs, Bearer token authorization
- **Input Validation:** Zod schemas with input normalization
- **Security:** Helmet, strict CORS, Express Rate Limit, Parameterized SQL queries, magic-byte signature validation
- **Audit Engine:** Canonical JSON serialization, SHA-256 hash chaining, HMAC external checkpoint anchor
- **Testing:** Vitest, Supertest (34 passing automated security & integration tests)

---

## 4. Cryptographic Audit Trail & Verification Design

### Mathematical Hash Chaining
Each audit event contains a canonical hash computed over its serialized payload and linked to the preceding event's digest:

$$Hash_0 = \text{SHA-256}(\text{CanonicalPayload}_0 \parallel \text{GENESIS\_HASH})$$
$$Hash_i = \text{SHA-256}(\text{CanonicalPayload}_i \parallel Hash_{i-1})$$

Where $\text{GENESIS\_HASH} = \text{0000000000000000000000000000000000000000000000000000000000000000}$.

### Canonical JSON Serialization
To prevent false-positive corruption alerts caused by differing dictionary key orders, `canonicalStringify()` sorts all keys lexicographically at every recursive depth:
```typescript
{
  action: "DOCUMENT_UPLOAD",
  actorEmail: "alice.owner@trustvault.local",
  actorId: "uuid-alice",
  id: "uuid-event",
  ipAddress: "127.0.0.1",
  metadata: { checksum: "...", fileName: "..." },
  outcome: "SUCCESS",
  prevHash: "previous-event-hash-64-chars",
  targetId: "uuid-doc",
  targetType: "DOCUMENT",
  timestamp: "2026-10-24T11:00:00.000Z",
  userAgent: "Mozilla/5.0..."
}
```

### Tamper Detection Capabilities
The `verifyAuditChain()` engine checks:
1. **Link Continuity:** Confirms `event[i].prev_hash === event[i-1].current_hash`. Flags deleted, inserted, or reordered records.
2. **Payload Authenticity:** Recomputes `expected_hash` from the canonical event data and verifies `event.current_hash === expected_hash`. Flags modified actions, outcomes, or metadata.
3. **External HMAC Checkpoint Anchor:** Cryptographically seals the chain head with an HMAC-SHA256 signature using `AUDIT_HMAC_SECRET`.

---

## 5. Automated Test Suite & Actual Results

TrustVault includes 34 automated security, authorization, and integrity tests:

```text
 ✓ tests/security/auth.test.ts (10 tests)
   ✓ successfully registers a user with normalized email and secure password
   ✓ rejects duplicate registration with 409 Conflict
   ✓ rejects weak passwords failing security complexity criteria
   ✓ successfully authenticates with valid credentials and issues JWT
   ✓ rejects invalid password with generic error (prevents username enumeration)
   ✓ rejects non-existent email with identical generic error
   ✓ denies access to protected endpoint /api/auth/me without authorization header
   ✓ denies access to protected endpoint /api/auth/me with forged or invalid token
   ✓ allows access to protected endpoint /api/auth/me with valid Bearer token
   ✓ records audit events for registration, login success, and login failure

 ✓ tests/security/authorization.test.ts (13 tests)
   ✓ 1. Rejects unauthenticated request to list documents with 401 Unauthorized
   ✓ 2. Rejects User B's attempt to download User A's private document before permission is granted
   ✓ 3. Rejects User B's attempt to view the permission list of User A's document
   ✓ Owner (Alice) grants access to Bob successfully
   ✓ Bob can successfully download the document while permission is active
   ✓ 4. Rejects recipient's (Bob) attempt to grant access to a third party (Charlie) (BFLA)
   ✓ 5. Rejects recipient's attempt to revoke permissions on the document
   ✓ 6. Prevents privilege escalation and forged ownership updates via request body
   ✓ Alice (owner) revokes Bob's access
   ✓ 7. Immediately rejects Bob's download request after permission revocation (Immediate Revocation)
   ✓ 8. Rejects access when targeting invalid or manipulated document IDs (BOLA/IDOR)
   ✓ 9. Rejects file upload with dangerous executable extension (.sh, .exe, .bat)
   ✓ 10. Prevents unauthenticated and unauthorized access to audit verification and logs

 ✓ tests/security/auditIntegrity.test.ts (7 tests)
   ✓ 1. Computes valid hash chain with genesis link and external HMAC anchor
   ✓ 2. Detects payload data tampering (e.g. modified action or outcome)
   ✓ 3. Detects modified current_hash (tampered hash)
   ✓ 4. Detects broken link / deleted historical event
   ✓ 5. Maintains integrity during concurrent audit event writes
   ✓ 6. API endpoint GET /api/audit/verify returns verification report
   ✓ 7. API endpoint GET /api/audit filters logs by action and targetType

 ✓ tests/security/inputValidation.test.ts (4 tests)
   ✓ 1. Safely parameterizes SQL injection payloads in search query parameter
   ✓ 2. Safely parameterizes SQL injection payloads in login authentication
   ✓ 3. Neutralizes and safely stores XSS payloads in document title and metadata
   ✓ 4. Rejects path traversal file names (../../etc/passwd)

Test Files  4 passed (4)
     Tests  34 passed (34)
  Duration  4.38s
```

---

## 6. Local Setup from Scratch

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- PostgreSQL (or automated embedded WASM database)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/BandiKoteswaraRao/TrustVault.git
cd TrustVault
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration if needed
```

### 3. Install Dependencies
```bash
# Backend
cd backend
npm.cmd install

# Frontend
cd ../frontend
npm.cmd install
```

### 4. Run Migrations & Seed Demo Accounts
```bash
cd ../backend
npm.cmd run migrate
npm.cmd run seed
```

### 5. Run Security Test Suite
```bash
npm.cmd test
```

### 6. Start Development Servers
```bash
# Terminal 1: Backend (Port 4000)
cd backend
npm.cmd run dev

# Terminal 2: Frontend (Port 5173)
cd frontend
npm.cmd run dev
```

Open `http://localhost:5173` in your browser.

---

## 7. Interactive Evaluation Demo

The application comes with pre-seeded demo accounts:
- **Owner (Alice):** `demo.owner@trustvault.local` (Password: `DemoOwner123!`)
- **Recipient (Bob):** `demo.recipient@trustvault.local` (Password: `DemoRecipient123!`)

For the full 9-step evaluator demo walkthrough, refer to [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

---

## 8. Live Deployment & Public Links

- **Live Public HTTPS Web App:** https://silent-peas-matter.loca.lt
  *(For localtunnel verification prompt, enter tunnel password IP: `103.174.160.17`)*
- **Direct Local Network (LAN) URL:** `http://192.168.1.72:4000` (Access from any smartphone or tablet connected to the local Wi-Fi)
- **Local Fullstack Application:** `http://localhost:4000`
- **Live Health Check Endpoint:** https://silent-peas-matter.loca.lt/health (returns `{"status":"healthy","service":"TrustVault Core API",...}`)
- **Public GitHub Repository:** https://github.com/BandiKoteswaraRao/TrustVault

### Cloud Deployment (Render Blueprint)
TrustVault is fully configured for 1-click cloud deployment via `render.yaml`:
1. Push repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select `TrustVault` to provision the PostgreSQL 16 database and Node.js fullstack service automatically.

Refer to [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment instructions on free-tier hosting (Render, Vercel, Neon).

---

## 9. Key Documentation Files
- [Threat Model & Traceability Matrix (THREATS.md)](THREATS.md)
- [AI-Assisted Development Log (PROMPTS.md)](PROMPTS.md)
- [Free Live Deployment Guide (docs/DEPLOYMENT.md)](docs/DEPLOYMENT.md)
- [Interactive Evaluation Demo Script (docs/DEMO_SCRIPT.md)](docs/DEMO_SCRIPT.md)
