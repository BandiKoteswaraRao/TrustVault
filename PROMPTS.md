# TrustVault — AI-Assisted Development Log (PROMPTS.md)

This document tracks the actual AI-assisted engineering progression for **TrustVault — Secure Document Sharing with a Real Audit Trail**, in accordance with project deliverable requirements. Every entry represents genuine development milestones, documenting prompts sent, tool outputs, defects or architectural flaws discovered, engineer corrections, verification procedures, and actual Git commits.

---

## 2026-10-24 — Phase 1: Initial Architecture, Directory Scaffolding, and Threat Model Foundation

**Prompt sent:**
> "Initialize the TrustVault project foundation from an empty directory. Inspect the operating environment and tool versions, initialize Git on the main branch, configure .gitignore and .env.example, construct the project directory tree, and author the comprehensive threat model THREATS.md covering assets, boundaries, 15 threat scenarios, mitigations, and traceability."

**Tool output:**
The tool executed environment diagnostic commands (`node -v`, `npm.cmd -v`, `git version`, `docker ps`), initialized an empty Git repository, created directory trees (`frontend`, `backend`, `database/migrations`, `database/seeds`, `tests`, `docs`, `screenshots`, `storage/uploads`), and generated `.gitignore`, `.env.example`, and `THREATS.md`.

**Problem discovered:**
1. Running `npm -v` in PowerShell triggered a Windows execution policy restriction (`npm.ps1 cannot be loaded because running scripts is disabled`). This required switching to `npm.cmd` and `npx.cmd` explicitly in all Windows script invocations.
2. The initial scaffold lacked `.gitkeep` files in empty directories (`storage/uploads`, etc.), which would cause Git to ignore them and fail file-storage tests looking for `storage/uploads`.
3. In `THREATS.md`, a common pitfall is claiming an in-database hash chain is "immutable" or "tamper-proof". An attacker with raw database write privileges could recompute hashes. This limitation was identified and explicitly documented along with external HMAC checkpoint mitigations.

**My correction:**
1. Standardized all command invocations on Windows to call `npm.cmd` and `npx.cmd`.
2. Created `.gitkeep` inside `storage/uploads` while keeping `storage/uploads/*` ignored in `.gitignore`.
3. Added an explicit Architectural Limitations and Residual Risks section in `THREATS.md` addressing the in-database hash chain boundary and ephemeral hosting storage considerations.

**Verification:**
1. `git status` confirmed clean tracking of directories and files.
2. Verified `.gitignore` properly keeps `.gitkeep` while ignoring dynamic uploads.
3. Verified `THREATS.md` covers all 15 required security scenarios with a STRIDE-based traceability matrix.

**Commit:**
`f2f3d1a` — `chore: initialize TrustVault project structure, threat model, and foundation`

## 2026-10-24 — Phase 2: Database Architecture, Migrations, and Dual-Mode Connection Pool

**Prompt sent:**
> "Design and implement the PostgreSQL database layer, SQL schema migrations for users, documents, permissions, and audit_events, connection pooling with support for production Postgres and zero-dependency embedded testing (PGlite), and a reproducible migration and seed runner."

**Tool output:**
The tool created `database/migrations/001_create_tables.sql`, `backend/src/config/index.ts`, `backend/src/db/index.ts`, `backend/src/db/migrate.ts`, and `backend/src/db/seed.ts`. When executing the migration script, PGlite threw an error: `error: cannot insert multiple commands into a prepared statement`.

**Problem discovered:**
1. In PostgreSQL and PGlite, the standard parameterized `query(sql)` function treats the input as an individual prepared statement and rejects scripts containing multiple SQL commands separated by semicolons.
2. In standalone CLI commands (`npx tsx migrate.ts`), an unconfigured in-memory PGlite instance discarded database state upon process exit, preventing idempotency testing between CLI invocations.

**My correction:**
1. Extended `IDatabaseClient` with an `exec(sql: string)` method that dispatches to `instance.exec(sql)` in PGlite and `pool.query(sql)` in pg driver, allowing batch DDL migrations to run atomically inside transactions.
2. Configured persistent `./.pgdata` storage for development mode while retaining memory-isolated instances for automated tests. Added `.pgdata/` to `.gitignore`.

**Verification:**
1. Executed `npx.cmd tsx src/db/migrate.ts`: successfully applied `001_create_tables.sql`.
2. Executed `npx.cmd tsx src/db/migrate.ts` a second time: confirmed idempotency (`Applied 0 new migrations`).
3. Executed `npx.cmd tsx src/db/seed.ts`: successfully created tables and seeded demo owner and recipient users with bcrypt work factor 12.

**Commit:**
`05182e2` — `feat(database): implement PostgreSQL migrations, schema, and connection pooling`

## 2026-10-24 — Phase 3: Authentication, Rate Limiting, Normalized Identity & Audit-Linked Auth Events

**Prompt sent:**
> "Implement user registration with email normalization and Bcrypt password hashing (12 salt rounds), rate-limited authentication with generic error responses to prevent username enumeration, JWT session tokens, authentication middleware, and integrated audit logging for all authentication attempts. Create automated security tests."

**Tool output:**
The tool created `backend/src/services/authService.ts`, `backend/src/middleware/auth.ts`, `backend/src/middleware/rateLimiter.ts`, `backend/src/middleware/validate.ts`, `backend/src/middleware/errorHandler.ts`, `backend/src/controllers/authController.ts`, `backend/src/routes/authRoutes.ts`, `backend/src/app.ts`, and test suite `backend/tests/security/auth.test.ts`.

**Problem discovered:**
1. Running supertest in isolated sandbox initially threw `connect EACCES 127.0.0.1:[port]` because supertest binds ephemeral local loopback TCP sockets.
2. In the registration validation schema, `z.string().email()` rejected normalized test input containing leading whitespace (`"  AUTH.TEST@trustvault.local  "`), returning HTTP 400 instead of trimming and sanitizing before email syntax validation. This caused a cascading failure in duplicate account detection.
3. Vitest reported CommonJS/ESM config warnings because `backend/package.json` lacked `"type": "module"`.

**My correction:**
1. Configured Zod schemas with `z.string().trim().toLowerCase().email()` to enforce email normalization at the validation boundary before reaching the service layer.
2. Added `"type": "module"` to `backend/package.json`.
3. Executed supertest runner with local port binding permissions.

**Verification:**
Executed `npm.cmd test` in `backend/`:
All 10 tests passed:
- `successfully registers a user with normalized email and secure password` (Passed)
- `rejects duplicate registration with 409 Conflict` (Passed)
- `rejects weak passwords failing security complexity criteria` (Passed)
- `successfully authenticates with valid credentials and issues JWT` (Passed)
- `rejects invalid password with generic error (prevents username enumeration)` (Passed)
- `rejects non-existent email with identical generic error` (Passed)
- `denies access to protected endpoint /api/auth/me without authorization header` (Passed)
- `denies access to protected endpoint /api/auth/me with forged or invalid token` (Passed)
- `allows access to protected endpoint /api/auth/me with valid Bearer token` (Passed)
- `records audit events for registration, login success, and login failure` (Passed)

**Commit:**
Commit `4b71e89` (Pending Phase 3 commit)
