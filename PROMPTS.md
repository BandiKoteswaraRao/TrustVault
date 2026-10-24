# TrustVault — AI-Assisted Engineering Journal (PROMPTS.md)

This log records the genuine, chronological development prompts, technical decisions, architectural iterations, and security corrections made during the construction of the TrustVault platform.

---

### Entry 1: Environment Inspection & Build Toolchain Configuration
* **Date:** 2026-10-24 15:58:30 IST
* **Category:** Tooling & Runtime Environment
* **Context & Objective:** Inspect available system binaries and initialize a compatible Maven + Spring Boot project for Java 25.
* **Prompt / Task Description:**
  > "Inspect the workspace environment for installed Java, Maven, Git, and MySQL toolchains. Verify version compatibility with modern Spring Boot standards."
* **Observations & Technical Decisions:**
  - Located Oracle JDK 25 (`25.0.1 LTS`) and MySQL Server 26.7 running on port 3306.
  - Located Apache Maven 3.10.0 in user downloads; configured a local workspace copy under `.tools/maven` so builds remain fully accessible.
  - Selected Spring Boot `3.3.5` with `<maven.compiler.release>21</maven.compiler.release>` to ensure compilation and bytecode compatibility with the LTS target.

---

### Entry 2: Full-Stack Architecture, Data Model, and Security Infrastructure
* **Date:** 2026-10-24 16:07:00 IST
* **Category:** Architecture & Data Layer
* **Context & Objective:** Model the domain entities (`User`, `Role`, `Document`, `DocumentPermission`, `AuditLog`) and implement Spring Security 6 RBAC with Thymeleaf extras.
* **Prompt / Task Description:**
  > "Design the core entities and security services for TrustVault: Admin, Document Owner, and Viewer roles with BCrypt hashing, private file storage with sanitized UUIDs, smart sharing with immediate revocation, and a SHA-256 cryptographic hash chain for audit events."
* **Observations & Technical Decisions:**
  - Established unique constraint `uk_doc_user` on `document_permissions (document_id, user_id)` to enforce a single granular permission level per recipient (`READ` or `EDIT`).
  - Added indexes on `audit_logs (actor_username, action, timestamp, status)` for fast search and filtering.
  - Configured session management with `sessionFixation().changeSessionId()` to prevent session fixation attacks.

---

### Entry 3: Decoupling Test Dependencies from Main Source & Database Separation
* **Date:** 2026-10-24 16:19:15 IST
* **Category:** Build Engineering & Compilation
* **Context & Objective:** Fix compilation failure in `DataInitializer` and prevent H2 initialization errors on MySQL DDL.
* **Prompt / Task Description:**
  > "Fix compilation errors in DataInitializer where MockMultipartFile from spring-test scope was referenced in main source, and prevent H2 database from choking on MySQL-specific CREATE DATABASE statements."
* **Observations & Technical Decisions:**
  - `DataInitializer.java` originally imported `org.springframework.mock.web.MockMultipartFile`, which is restricted to test scope. Replaced with an internal `SimpleMultipartFile` implementing `MultipartFile`.
  - Moved MySQL DDL to `database/schema.sql` and `src/main/resources/schema-mysql.sql`, adding `spring.sql.init.mode=never` to `application.properties` and `application-test.properties` so Hibernate handles DDL generation for in-memory H2 tests seamlessly.

---

### Entry 4: Cryptographic Audit Security Correction — Deterministic Timestamp Serialization
* **Date:** 2026-10-24 16:29:45 IST
* **Category:** Audit Security & Cryptography
* **Context & Objective:** Eliminate subtle hash discrepancies caused by precision mismatches between JVM memory and database persistence columns.
* **Prompt / Task Description:**
  > "Ensure the cryptographic hash chain verification produces 100% deterministic SHA-256 digests across different database drivers and persistence flushes."
* **Challenge Encountered:**
  - In Java 21/25, `LocalDateTime.now()` records timestamps with up to 9 digits of nanosecond precision (`.123456789`).
  - When persisted into SQL `DATETIME(6)` or `TIMESTAMP` columns, the database engine truncates fractional seconds to 6 or 0 decimal digits.
  - Upon reloading the record from the database during verification, recalculating the hash resulted in false-positive tamper warnings because `.toCanonicalPayload()` saw a different string representation than the one originally hashed.
* **Mitigation & Fix:**
  - Enforced `timestamp = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS)` in `AuditService.recordEvent()`.
  - Defined a static, strict `CANONICAL_TIMESTAMP_FORMATTER` (`yyyy-MM-dd'T'HH:mm:ss`) in `AuditLog.java`.
  - This ensures identical canonical payloads and byte-for-byte deterministic SHA-256 hashes regardless of SQL driver or reload lifecycle.

---

### Entry 5: Authorization Security Correction — Preserving Security Denials via Autonomous Transactions
* **Date:** 2026-10-24 16:34:05 IST
* **Category:** Authorization & Transaction Security
* **Context & Objective:** Guarantee that IDOR access violation attempts are permanently persisted in the audit trail even when the business method rejects the request with an exception.
* **Prompt / Task Description:**
  > "Fix test failure in DocumentAccessSecurityTests where IDOR ACCESS_DENIED audit count remained 0 after an unauthorized access attempt was blocked."
* **Challenge Encountered:**
  - `DocumentService.getDocumentForViewing` was annotated with `@Transactional(readOnly = true)`.
  - When an unauthorized viewer attempted to access another user's document, `auditService.recordEvent(..., ACCESS_DENIED, ...)` was called, followed immediately by `throw new SecurityException(...)`.
  - Spring's transaction interceptor rolled back the entire transaction upon catching `SecurityException`, inadvertently discarding the critical `ACCESS_DENIED` security audit entry from the database.
* **Verification & Git Commit:**
  - Verified by `DocumentAccessSecurityTests.testBobCannotViewAlicesDocument` passing with 100% assertion success.
  - Implemented in commit [`993269d`](https://github.com/BandiKoteswaraRao/TrustVault/commit/993269d) (`feat: complete TrustVault full-stack secure document sharing with tamper-evident audit trail`).
