# TrustVault — Secure Document Sharing with a Real Audit Trail

[![Security: OWASP Top 10](https://img.shields.io/badge/Security-OWASP%20Top%2010-green.svg)](THREATS.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TrustVault is an enterprise-grade, security-focused web application designed for secure digital document storage, controlled multi-party access delegation, immediate permission revocation, and append-only, SHA-256 hash-linked audit logging with cryptographic tamper verification.

---

## 1. Project Overview & Problem Statement

Digital documents are frequently shared between individuals and organizations, introducing grave risks of unauthorized access, broken object-level authorization (IDOR/BOLA), lingering permissions post-revocation, data exposure, and inadequate accountability. Traditional file-sharing systems often lack transparent, immutable records of access, or allow silent modification of audit logs without detection.

**TrustVault solves this by providing:**
- **Zero-Trust Access Control:** Server-enforced authorization on every single request; client-side UI states are strictly cosmetic.
- **Cryptographic Audit Trail:** Append-only SHA-256 hash-linked log chain where each audit event cryptographically seals the previous event's hash.
- **Immediate Revocation:** Once access is revoked by a document owner, subsequent download attempts by the grantee fail immediately in real time.
- **Secure File Handling:** Uploaded files are stored outside public web roots with UUIDv4 filenames, magic-byte inspection, strict MIME allowlists, and safe download headers.

---

## 2. Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js LTS, Express, TypeScript
- **Database:** PostgreSQL (with reproducible SQL migrations and connection pooling)
- **Authentication:** HTTP-only cookies / short-lived JWTs, Argon2id/Bcrypt password hashing (work factor 12)
- **Validation & Security:** Zod schemas, Helmet (CSP, HSTS), CORS, Express Rate Limiting, Parameterized SQL queries
- **Audit Engine:** Canonical JSON serialization, SHA-256 hash chaining, dynamic link and payload tamper verification
- **Testing:** Vitest / Supertest automated integration and security test suite
- **Version Control & CI:** Git, GitHub Actions

---

## 3. Project Directory Structure

```text
TrustVault/
├── backend/                  # Express + TypeScript REST API
│   ├── src/
│   │   ├── config/           # Environment variables & constants
│   │   ├── controllers/      # Request handlers (auth, documents, permissions, audit)
│   │   ├── db/               # PostgreSQL client pool & query helpers
│   │   ├── middleware/       # Auth, rate limiting, validation, error handler
│   │   ├── models/           # Data models (User, Document, Permission, AuditEvent)
│   │   ├── routes/           # Express route definitions
│   │   ├── services/         # Business logic (Audit chain, storage, auth)
│   │   ├── types/            # TypeScript type definitions
│   │   └── app.ts            # Express application setup
│   └── tsconfig.json
├── frontend/                 # React + Vite + TypeScript application
│   ├── src/
│   │   ├── components/       # UI components (Navigation, modals, alerts, tables)
│   │   ├── pages/            # View pages (Login, Dashboard, Documents, Audit, etc.)
│   │   ├── services/         # API client & fetch utilities
│   │   └── App.tsx
│   └── vite.config.ts
├── database/
│   ├── migrations/           # Versioned SQL migrations (001_initial_schema.sql, etc.)
│   └── seeds/                # Test and development seed scripts
├── tests/
│   ├── security/             # Negative authorization, BOLA, tamper, & upload tests
│   └── unit/                 # Unit tests for hashing, validation, canonical serialization
├── storage/
│   └── uploads/              # Private, non-executable document storage
├── docs/                     # Architectural documentation, diagrams, demo scripts
├── screenshots/              # Verified test execution & live system screenshots
├── .env.example              # Environment variable template
├── .gitignore                # Excludes secrets, uploads, node_modules
├── PROMPTS.md                # Dated, honest AI-tool engineering log
├── THREATS.md                # Comprehensive threat model & security traceability matrix
└── README.md                 # Primary project documentation
```

---

## 4. Key Security & Architectural Features

### 4.1 Server-Enforced Authorization
TrustVault strictly prohibits trusting browser-supplied ownership or privilege claims. Every request to inspect, share, revoke, or download a document validates:
1. Valid authenticated user session (verified via JWT Bearer token).
2. Explicit ownership match (`owner_id === user.id`), OR
3. An active, non-revoked permission record (`grantee_id === user.id AND revoked_at IS NULL`).

### 4.2 Append-Only SHA-256 Hash Chaining
Audit events form a verifiable hash chain:
$$Hash_i = \text{SHA-256}(\text{CanonicalJSON}(id, timestamp, actor\_id, action, target\_id, outcome, metadata, Hash_{i-1}))$$
The genesis record links to an initial zero-hash (`0000000000000000000000000000000000000000000000000000000000000000`). If any past event is modified, deleted, inserted, or reordered, the verification routine recalculates the chain and pinpoints the exact corrupted event index and link anomaly.

---

## 5. Local Setup & Quickstart

### Prerequisites
- Node.js (v18.0.0 or higher)
- PostgreSQL (or automated embedded test runner)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/TrustVault.git
cd TrustVault
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials and JWT secret
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

### 4. Run Database Migrations
```bash
cd ../backend
npm.cmd run migrate
```

### 5. Run Automated Security & Integration Tests
```bash
npm.cmd test
```

### 6. Start Development Servers
```bash
# Backend (port 4000)
cd backend
npm.cmd run dev

# Frontend (port 5173)
cd frontend
npm.cmd run dev
```

---

## 6. Live Deployment & Repository Links

- **Public GitHub Repository:** *[To be configured in Phase 8]*
- **Live Deployed Application:** *[To be configured in Phase 8]*
- **API Health Check:** *[To be configured in Phase 8]/health*

---

## 7. Security Documentation Links
- [Threat Model & Traceability Matrix (THREATS.md)](THREATS.md)
- [AI-Assisted Development Log (PROMPTS.md)](PROMPTS.md)
