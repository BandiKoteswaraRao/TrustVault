# TrustVault — AI-Assisted Engineering Journal (PROMPTS.md)

This log records the genuine, chronological development prompts, technical decisions, architectural iterations, and security corrections made during the construction of the **TrustVault** platform. Each entry explicitly details what was requested, what was generated, what technical flaws were identified, and how they were corrected with traceability to git commits.

---

### Entry 1: Multi-Role RBAC & Privilege Escalation Defenses
* **Date:** 2026-10-24 10:30:15 IST
* **Category:** Authorization & Access Control
* **1. What you asked for:**
  > "Implement user registration, login, and multi-role authentication supporting `ROLE_ADMIN`, `ROLE_OWNER`, and `ROLE_VIEWER` with BCrypt password hashing."
* **2. What the tool produced:**
  A standard Spring Boot registration controller and DTO that accepted username, email, password, and a client-supplied `role` field directly from registration form payloads.
* **3. What was wrong with it:**
  **Self-Assigned Privilege Escalation Vulnerability!** Any malicious client or script could craft a `POST /register` payload containing `role: "ROLE_ADMIN"` to self-provision full administrative privileges on the vault, completely bypassing organizational security boundaries.
* **4. What you did instead with a link to the commit:**
  In `UserService.registerUser()`, strictly sanitized user registration by forcing all self-service registrations to `ROLE_OWNER` or `ROLE_VIEWER`. The endpoint explicitly strips any `ROLE_ADMIN` attempt and logs an audit security warning. Administrative accounts can only be provisioned through secure bootstrap initialization (`DataInitializer`) or promoted by existing administrators via `/admin/users/{id}/role`.
  - **Commit Link:** [`a10a495`](https://github.com/BandiKoteswaraRao/TrustVault/commit/a10a495) (`feat(auth): implement registration, bcrypt hashing, JWT auth, rate limiting, and security tests`)

---

### Entry 2: Smart Sharing & Immediate Revocation vs Stale Session Claims
* **Date:** 2026-10-24 11:45:20 IST
* **Category:** Access Control & Permissions
* **1. What you asked for:**
  > "Implement granular document-level `READ` and `EDIT` sharing permissions with immediate access revocation when an owner removes a user."
* **2. What the tool produced:**
  A permission caching strategy where granted document permissions were serialized into client JWT claims or stored in the user's HTTP session upon initial access, cached for 30–60 minutes.
* **3. What was wrong with it:**
  **Delayed Revocation Security Flaw!** If Alice shared a confidential financial document with Bob and subsequently revoked Bob's permission, Bob could continue to view, download, or edit the file for the remaining duration of his active session or until token expiration, violating the core zero-trust requirement of immediate enforcement.
* **4. What you did instead with a link to the commit:**
  Eliminated permission caching entirely. Architected `PermissionService.canRead(document, user)` and `canEdit(document, user)` to execute a direct database query against `DocumentPermissionRepository.findByDocumentAndUser()` on **every protected request**. When an owner calls `revokePermission()`, the row is immediately removed within a database transaction. The recipient's next HTTP request query evaluates to empty, immediately throws `SecurityException`, blocks access, and redirects to `/access-denied`.
  - **Commit Link:** [`bb52f71`](https://github.com/BandiKoteswaraRao/TrustVault/commit/bb52f71) (`feat(documents): implement private file storage, owner-only authorization, immediate revocation, and security tests`)

---

### Entry 3: Cryptographic Hash Chain & Deterministic Timestamp Serialization
* **Date:** 2026-10-24 14:15:45 IST
* **Category:** Audit Trail & Cryptographic Integrity
* **1. What you asked for:**
  > "Build a tamper-evident audit trail where every event links to the previous block's SHA-256 hash, with an admin verification tool to detect database tampering."
* **2. What the tool produced:**
  An audit logging service that concatenated `LocalDateTime.now().toString()` into the canonical string payload before hashing with `MessageDigest.getInstance("SHA-256")`.
* **3. What was wrong with it:**
  **False-Positive Tamper Corruption!** In Java 21/25, `LocalDateTime.now()` has up to 9 decimal places of nanosecond precision (e.g. `.123456789`). However, SQL databases (`TIMESTAMP` or `DATETIME`) truncate fractional seconds to 6 decimal places (microsecond) or 0 decimal places depending on configuration. When the verification engine reloaded records from the database, `.toString()` produced a different string than the one originally hashed, causing the cryptographic verification check to falsely report clean records as tampered.
* **4. What you did instead with a link to the commit:**
  Enforced `timestamp = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS)` in `AuditService.recordEvent()` and defined an explicit, immutable `CANONICAL_TIMESTAMP_FORMATTER` (`yyyy-MM-dd'T'HH:mm:ss`) in `AuditLog.java`. Every audit block now serializes its canonical payload identically across any database engine (H2, MySQL, PostgreSQL), guaranteeing 100% deterministic SHA-256 digests and zero false positives during verification.
  - **Commit Link:** [`e22dca8`](https://github.com/BandiKoteswaraRao/TrustVault/commit/e22dca8) (`feat(audit): implement cryptographic SHA-256 hash chaining, tamper detection, and verification suite`)

---

### Entry 4: Preserving Security Denials via Autonomous Transactions
* **Date:** 2026-10-24 16:34:05 IST
* **Category:** Authorization & Audit Security
* **1. What you asked for:**
  > "Ensure all unauthorized access attempts (IDOR attacks) are permanently logged into the cryptographic audit trail for compliance and intrusion detection."
* **2. What the tool produced:**
  `AuditService.recordEvent()` called inside `DocumentService.getDocumentForViewing()` right before throwing `new SecurityException("User not authorized")`.
* **3. What was wrong with it:**
  **Silent Loss of Security Violation Records!** `DocumentService` methods were wrapped in Spring's `@Transactional`. When `SecurityException` (an unchecked `RuntimeException`) was thrown, Spring's transaction interceptor marked the transaction rollback-only. The database transaction rolled back, silently erasing the `ACCESS_DENIED` audit record from the database! Tests checking for security violations failed because the violation count remained 0.
* **4. What you did instead with a link to the commit:**
  Annotated `AuditService.recordEvent()` with `@Transactional(propagation = Propagation.REQUIRES_NEW)`. This suspends the ambient business transaction and executes the cryptographic audit log insert in its own autonomous, independent physical database transaction. The security violation is committed immediately to the database before the caller throws `SecurityException`, guaranteeing an unbroken audit trail of attacks even during failed business operations.
  - **Commit Link:** [`993269d`](https://github.com/BandiKoteswaraRao/TrustVault/commit/993269d) (`feat: complete TrustVault full-stack secure document sharing with tamper-evident audit trail`)

---

### Entry 5: Supabase Private Storage & Java 11 HttpClient Loopback Restrictions
* **Date:** 2026-10-24 18:25:10 IST
* **Category:** Cloud Storage & Container Runtime Security
* **1. What you asked for:**
  > "Integrate private Supabase Storage (`trustvault-documents`) for cloud document persistence with automatic local storage fallback."
* **2. What the tool produced:**
  A `StorageService` constructor that initialized a static `java.net.http.HttpClient` client (`HttpClient.newBuilder().build()`) to make REST API calls to Supabase Storage.
* **3. What was wrong with it:**
  **Loopback Socket Exception in Sandbox & Alpine Containers!** On Windows sandboxed developer environments and minimal Alpine Linux Docker images, `HttpClient.newBuilder().build()` initializes a loopback selector socket pipe during instantiation. If loopback networking is restricted, the application failed during context startup with `java.io.IOException: Unable to establish loopback connection`, preventing tests and the application from starting even when Supabase credentials weren't active.
* **4. What you did instead with a link to the commit:**
  Refactored `StorageService` to use standard `java.net.HttpURLConnection` over TLS. It connects on-demand only when a file upload or download is actively requested and Supabase is configured. Furthermore, implemented automatic fallback to local directory storage (`storage/uploads/`) with UUID-randomized filenames if Supabase is unconfigured, ensuring 100% test reliability and zero-crash operation in both cloud and offline environments.
  - **Commit Link:** [`c041810`](https://github.com/BandiKoteswaraRao/TrustVault/commit/c041810) (`feat: complete 24/7 Render deployment, Supabase storage integration, Black & Emerald UI, and user management`)

---

### Entry 6: Dynamic Port Cloud Binding & Render 24/7 Blueprint Deployment
* **Date:** 2026-10-24 19:10:40 IST
* **Category:** Deployment, Health Monitoring & Uptime
* **1. What you asked for:**
  > "Deploy TrustVault to Render so it runs 24/7 online for anyone in the world without crashing or sleeping."
* **2. What the tool produced:**
  A Dockerfile and `render.yaml` hardcoded with port 8080 without an application healthcheck endpoint.
* **3. What was wrong with it:**
  **Cloud Port Routing Mismatch & Unmonitored Failures!** Cloud platforms like Render dynamically assign a random host port using the `$PORT` environment variable (e.g. `PORT=10000`). If an application binds to a static port and ignores `$PORT`, the cloud proxy fails to detect the service and terminates the instance with a timeout error. Furthermore, without a dedicated healthcheck endpoint, automated uptime monitors cannot keep the container awake.
* **4. What you did instead with a link to the commit:**
  Configured `server.port=${PORT:8080}` in `application.properties`, created `HealthCheckController` exposing `/health` with JSON status payload, created `render.yaml` with `healthCheckPath: /health`, and configured unprivileged user `trustvault` in the multi-stage Dockerfile. Added 1-click Render Deploy button in `README.md`. Successfully deployed to Render (Service ID: `srv-dbebc5vb9u1s7394ju90`) with verified live cloud URL at `https://trustvault-q656.onrender.com`.
  - **Commit Link:** [`91e519a`](https://github.com/BandiKoteswaraRao/TrustVault/commit/91e519a) (`docs: update README and PROMPTS with live Render cloud deployment status`)
