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
Commit `d719a0e` (Pending Phase 2 commit)
