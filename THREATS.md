# TrustVault — STRIDE Threat Model & Security Analysis

This document provides a comprehensive security assessment of **TrustVault**, detailing evaluated threat vectors under the STRIDE methodology, their implemented mitigations, automated verification tests, and acknowledged residual risks.

---

## 1. STRIDE Threat Matrix

| Threat Category | Threat Scenario | Impact | Implemented Mitigation | Verification Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates legitimate user or brute-forces login credentials. | Critical | &bull; BCrypt password hashing (strength 12 in prod, 4 in test)<br>&bull; Server-side Spring Security authentication provider<br>&bull; Session fixation protection with session regeneration upon login. | `TrustVaultApplicationTests`, `CustomUserDetailsService` | **Mitigated** |
| **Tampering** | Rogue actor or insider modifies audit logs or alters document metadata directly in the database. | Critical | &bull; Cryptographic SHA-256 hash chaining (previous hash linking)<br>&bull; Canonical payload serialization for deterministic verification<br>&bull; One-click verify tool detecting record modification, insertion, or reordering. | `AuditChainIntegrityTests.testTamperDetectionOnModifiedRecordData` | **Mitigated** |
| **Repudiation** | User denies uploading, downloading, modifying, or deleting a confidential file. | High | &bull; Autonomous audit logging with `Propagation.REQUIRES_NEW`<br>&bull; Client IP address, actor role, timestamp, and target ID recorded in cryptographic blocks<br>&bull; File content SHA-256 computed on upload. | `AuditChainIntegrityTests.testSequentialRecordsFormValidChain`, `DocumentServiceValidationTests` | **Mitigated** |
| **Information Disclosure (IDOR)** | Authenticated Viewer guesses or manipulates document ID (`/documents/{id}/download`) to access another owner's confidential files. | High | &bull; Server-side authorization check (`canRead`) executed on every single document access<br>&bull; Direct-file access blocked: files stored outside web root with randomized UUID names<br>&bull; Failed attempts immediately logged as `ACCESS_DENIED`. | `DocumentAccessSecurityTests.testBobCannotViewAlicesDocument`, `testBobCannotDownloadAlicesDocument` | **Mitigated** |
| **Denial of Service (DoS)** | Attacker uploads excessively large files or attempts to flood server storage. | Medium | &bull; Multipart upload request limits enforced at Spring Boot servlet container (10MB per file, 12MB total)<br>&bull; Whitelist extension filtering rejects executables and unapproved binaries. | `DocumentServiceValidationTests.testEmptyFileRejected` | **Mitigated** |
| **Elevation of Privilege** | Normal user attempts to grant themselves `ROLE_ADMIN` or edit documents where only `READ` was shared. | High | &bull; `UserService.registerUser` forces `ROLE_OWNER` or `ROLE_VIEWER`, stripping unauthorized `ROLE_ADMIN` requests<br>&bull; Granular `canEdit` vs `canRead` checks in `PermissionService`<br>&bull; Method-level security (`@PreAuthorize`). | `SharingImmediateRevocationTests.testReadGranteeCannotEditOrDelete` | **Mitigated** |

---

## 2. In-Depth Attack Vectors & Defense Architecture

### 2.1 Insecure Direct Object References (IDOR)
* **Attack Scenario:** User Bob (`ROLE_VIEWER`) accesses Alice's confidential document ID 2 by issuing `GET /documents/2` or `GET /documents/2/download`.
* **Mitigation:**
  `DocumentService.getDocumentForViewing` and `getDocumentForDownload` strictly invoke `permissionService.canRead(document, user)`. If the user is neither the owner, nor an administrator, nor in possession of an active `READ` or `EDIT` permission in `document_permissions`, the request is immediately rejected with `SecurityException` and redirected to `/access-denied`.
* **Audit Enforcement:** Every blocked attempt is immediately recorded into the tamper-evident audit trail with `AuditAction.ACCESS_DENIED` and `AuditStatus.DENIED`.

### 2.2 Path Traversal & Arbitrary File Overwrite
* **Attack Scenario:** Attacker uploads a file with filename `../../../../Windows/System32/calc.exe` or `..\\secret.pdf`.
* **Mitigation:**
  `StorageService.storeFile()` extracts only the clean filename using `FilenameUtils.getName()`, checks for directory traversal tokens (`..`, `/`, `\`, null bytes), whitelists allowed extensions (`.pdf`, `.docx`, `.xlsx`, etc.), and saves the file on disk under a randomized UUID name (`UUID.randomUUID().toString() + "." + extension`). Path resolution is verified using `.startsWith(storageLocation)`.

### 2.3 Audit Log Tampering & Repudiation
* **Attack Scenario:** An insider or compromised database administrator executes `UPDATE audit_logs SET details = ...` or `DELETE FROM audit_logs WHERE id = ...` to erase traces of an exfiltration attempt.
* **Mitigation:**
  TrustVault links every audit entry to its predecessor using SHA-256:
  $$\text{current\_hash} = \text{SHA-256}(\text{timestamp} \parallel \text{actor} \parallel \text{role} \parallel \text{action} \parallel \text{target} \parallel \text{details} \parallel \text{status} \parallel \text{ip} \parallel \text{previous\_hash})$$
  The verification algorithm recomputes every hash from Genesis block (`0000...0000`) through the entire chain. If any detail is altered, the recalculated hash differs; if any row is deleted or reordered, the `previous_hash` link is broken. The exact failing record ID and index are reported.

### 2.4 Immediate Revocation vs Stale Tokens
* **Attack Scenario:** An owner shares a document with a collaborator, but subsequently revokes access. The collaborator attempts to reuse cached sessions or tokens.
* **Mitigation:**
  Permissions are not stored as static claims in client cookies or JWTs. Instead, every protected request verifies the live relationship in the database via `DocumentPermissionRepository.findByDocumentAndUser()`. When an owner calls `revokePermission()`, the row is deleted immediately, and the recipient is blocked on their very next HTTP request.

---

## 3. Residual & Accepted Risks

1. **Local Host Compromise / Root Database Key Access:** If an attacker gains full OS root access to the database server, they could theoretically recalculate the entire hash chain from the tampered record forward.
   * *Recommended Production Enhancement:* Ship audit block headers periodically to an immutable external ledger, append-only WORM cloud storage (e.g. AWS S3 Object Lock), or external timestamp authority (RFC 3161).
2. **File Content Inspection:** TrustVault validates file extensions and MIME types. Advanced deep-packet malware inspection (e.g., ClamAV ICAP scanner) should be integrated in enterprise environments handling untrusted external uploads.
