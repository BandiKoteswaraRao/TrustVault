# TrustVault — Security Policy & Cryptographic Specification

## 1. Security Architecture Overview

TrustVault is engineered using a **Zero-Trust Security Model** where every protected operation is verified on the server side prior to execution. Trust is never delegated to client-side flags, stale session tokens, or unverified claims.

```
+-----------------------------------------------------------------------------------+
|                              Client Web Browser                                   |
+-----------------------------------------------------------------------------------+
                                         |
                       [ HTTPS / TLS 1.3 + CSRF Token ]
                                         v
+-----------------------------------------------------------------------------------+
|                            Spring Security Filter Chain                           |
|  - CSRF Token Validation                                                          |
|  - AuthenticationProvider (BCrypt strength 12)                                    |
|  - Session Fixation Protection (changeSessionId)                                  |
|  - AccessDeniedHandlerImpl (Logs ACCESS_DENIED to Audit Chain)                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             Controller / Service Layer                            |
|  - Role-Based Access Control (@PreAuthorize)                                      |
|  - Insecure Direct Object Reference (IDOR) Checks (canRead, canEdit, canDelete)   |
|  - Autonomous Security Audit Logging (Propagation.REQUIRES_NEW)                   |
+-----------------------------------------------------------------------------------+
             |                                                    |
             v                                                    v
+-----------------------------+                  +----------------------------------+
|    Private Storage Layer    |                  |  Cryptographic Audit Chain (DB)  |
| - Directory Traversal Check |                  | - SHA-256 Chained Blocks         |
| - Whitelist Extensions      |                  | - Deterministic Serialization    |
| - UUID-based Disk Filenames |                  | - One-Click Tamper Verification  |
+-----------------------------+                  +----------------------------------+
```

---

## 2. Role Permissions Matrix

| Operation | Admin (`ROLE_ADMIN`) | Document Owner (`ROLE_OWNER`) | Viewer (`ROLE_VIEWER`) | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| **Login / Register** | Yes | Yes | Yes | Yes |
| **View Own Documents** | Yes | Yes | N/A (None owned) | Denied (403/Login) |
| **View Shared Documents** | Yes | Yes | Yes (`READ` or `EDIT`) | Denied (403/Login) |
| **View Unshared Documents** | Yes (System Audit) | Denied (IDOR Block) | Denied (IDOR Block) | Denied (403/Login) |
| **Upload Document** | Yes | Yes | Denied (403) | Denied (403/Login) |
| **Edit Own Document** | Yes | Yes | Denied | Denied (403/Login) |
| **Edit Shared Document** | Yes | Yes | Yes (Only if `EDIT`) | Denied (403/Login) |
| **Delete Document** | Yes | Yes (Own only) | Denied (403) | Denied (403/Login) |
| **Grant / Revoke Sharing** | Yes | Yes (Own only) | Denied (403) | Denied (403/Login) |
| **View Audit Trail** | Yes | Denied (403) | Denied (403) | Denied (403/Login) |
| **Verify Audit Chain** | Yes | Denied (403) | Denied (403) | Denied (403/Login) |

---

## 3. Cryptographic Tamper-Evident Audit Specification

TrustVault implements an immutable, append-only cryptographic hash chain modeled on distributed ledger concepts:

### 3.1 Genesis Condition
The first record in the database links to a defined 64-character Genesis Hash:
$$\text{GENESIS\_HASH} = \text{"0000000000000000000000000000000000000000000000000000000000000000"}$$

### 3.2 Canonical Data Serialization
To guarantee deterministic cryptographic hashing regardless of SQL formatting or database engines, the canonical string is assembled using strict ISO-8601 timestamps and pipe (`|`) delimiters:
$$\text{payload} = \text{timestamp} \parallel \text{actor} \parallel \text{role} \parallel \text{action} \parallel \text{targetType} \parallel \text{targetId} \parallel \text{details} \parallel \text{status} \parallel \text{ipAddress} \parallel \text{previousHash}$$

### 3.3 Block Chaining Formula
For any record $i \ge 1$:
$$\text{previousHash}_i = \text{currentHash}_{i-1}$$
$$\text{currentHash}_i = \text{SHA-256}(\text{payload}_i)$$

### 3.4 Verification Algorithm
1. Retrieve all audit logs ordered by `id ASC`.
2. Verify that record 0 links to $\text{GENESIS\_HASH}$.
3. For each sequential record $i$:
   - Check link integrity: $\text{record}[i].\text{previousHash} == \text{record}[i-1].\text{currentHash}$. If not matching, alert: **Chain Broken (Record deleted or reordered)**.
   - Recompute hash: $\text{hash}' = \text{SHA-256}(\text{record}[i].\text{toCanonicalPayload()})$.
   - Check content integrity: $\text{record}[i].\text{currentHash} == \text{hash}'$. If not matching, alert: **Tampering Detected (Record data altered)**.

---

## 4. Reporting Security Vulnerabilities

We take the security of TrustVault seriously. If you discover a security vulnerability, please report it via private disclosure:
* **Email:** `security@trustvault.local` (or open a confidential GitHub Security Advisory)
* **Response SLA:** Within 24 hours of notification.
* Please provide a reproducible proof-of-concept and do not publicly disclose until a patch is released.
