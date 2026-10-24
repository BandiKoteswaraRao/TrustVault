# TrustVault — Secure Document Sharing with a Tamper-Evident Audit Trail

[![Java](https://img.shields.io/badge/Java-21%20%7C%2025%20LTS-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Spring Security](https://img.shields.io/badge/Spring%20Security-6.3-green.svg)](https://spring.io/projects/spring-security)
[![Database](https://img.shields.io/badge/Database-MySQL%20%7C%20H2-blue.svg)](https://www.mysql.com/)
[![Tests](https://img.shields.io/badge/JUnit%205-18%20Passed-success.svg)](#running-automated-tests)

**TrustVault** is an enterprise-grade full-stack web application designed for high-security document sharing, granular access control, and compliance auditing. Built on Spring Boot, Spring Security, and Thymeleaf, TrustVault guarantees strict server-side authorization on every operation, eliminates Insecure Direct Object References (IDOR), and seals every security event inside a **tamper-evident SHA-256 cryptographic hash chain** with real-time integrity verification.

---

## 🛡️ Core Features

1. **Authentication & Multi-Role RBAC:**
   - Pre-configured `ROLE_ADMIN`, `ROLE_OWNER`, and `ROLE_VIEWER` roles.
   - Passwords securely hashed with BCrypt (strength 12).
   - Session fixation defense and CSRF protection on all forms.
   - 1-Click Demo Login credentials directly on the sign-in page.

2. **Secure Document Management:**
   - Private file storage outside the web root directory (`storage/uploads/`).
   - Disk filenames randomized using cryptographically strong UUIDs (`<uuid>.<ext>`) to prevent direct static access.
   - Strict filename sanitization (`FilenameUtils.getName()`) preventing directory traversal (`..`, `%00`).
   - Extension whitelist validation (`.pdf`, `.docx`, `.xlsx`, `.png`, etc.) rejecting dangerous executables (`.exe`, `.jsp`, `.sh`, `.bat`).
   - Instant calculation and storage of raw file content SHA-256 digests.

3. **Smart Sharing & Immediate Revocation:**
   - Document owners can grant granular `READ` (view & download) or `EDIT` (view, download, modify) access to specific collaborators.
   - **Immediate Revocation:** Permissions are verified directly against the database on every protected request. Revoking access blocks the recipient on their very next HTTP request without waiting for token expiry.

4. **Tamper-Evident Audit Trail (Cryptographic Hash Chain):**
   - Every security event (upload, download, edit, delete, grant, revoke, and denied access) is sealed into a cryptographic block.
   - Each block contains: `timestamp`, `actor`, `action`, `target`, `details`, `status`, `ip_address`, `previous_hash`, and `current_hash`.
   - Starts from an established 64-character Genesis Hash (`0000...0000`).
   - **One-Click Integrity Verification:** Recalculates every hash from Genesis to the latest block. Instantly flags modified records, broken links from deletions, or reordered blocks with exact record ID and index.

5. **Executive Security Dashboard:**
   - Real-time metrics: Total Documents, Active Users, Total Audit Blocks, and Security Violations (IDOR interceptions).
   - Live Audit Chain Status indicator with hash display.
   - Recent activity feed and document browser.

6. **Accessible & Responsive Enterprise UI:**
   - Clean, modern Dark-Mode Security SaaS theme built with Tailwind CSS.
   - Search query and category filters (`Financial`, `Legal`, `Confidential`, `Technical`, `Personal`, `General`).
   - Custom accessible 403 Forbidden, 404 Not Found, and 500 Error pages explaining security interception context.

---

## 🧱 Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Framework** | Java 21 / 25, Spring Boot 3.3.5 |
| **Security & RBAC** | Spring Security 6, BCrypt, CSRF Protection |
| **Persistence / ORM** | Spring Data JPA, Hibernate ORM 6.5 |
| **Databases** | MySQL 8.x / 26.x (Production) &amp; Embedded H2 (Zero-Config Fallback) |
| **Frontend Templates** | Thymeleaf 3, Thymeleaf Spring Security 6 extras |
| **Styling & Interaction** | Tailwind CSS CDN, Modern Dark-Theme SaaS CSS, Vanilla JavaScript |
| **Build & Testing** | Apache Maven 3.10.0, JUnit 5, AssertJ, Spring Security Test |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Quick Start (Zero-Configuration)

### Prerequisites
- Java JDK 21 or 25 installed.

### Run the Pre-Built Standalone JAR
TrustVault comes ready-to-run with zero configuration. By default, it runs against an embedded in-memory database in MySQL mode:

```powershell
# In PowerShell:
& "C:\Program Files\Java\jdk-25\bin\java.exe" -jar target\trustvault-1.0.0.jar
```

Open your browser and navigate to:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 🔑 Pre-Seeded Demo Accounts (1-Click Login)

The login screen features **1-Click Quick-Fill buttons** so you can test all roles immediately:

| Role | Username / Email | Password | What You Can Test |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@trustvault.local` | `Admin@TrustVault2026!` | View system audit trail, run cryptographic verification, view all documents |
| **Doc Owner (Alice)** | `owner@trustvault.local` | `Owner@TrustVault2026!` | Upload documents, edit files, grant/revoke sharing permissions |
| **Viewer (Bob)** | `viewer@trustvault.local` | `Viewer@TrustVault2026!` | View shared docs; test IDOR blocking on Alice's private documents |

---

## 🗄️ Running with Local MySQL Server

To run TrustVault against your local MySQL server (`MySQL 8.x` or `MySQL 26.x`):

1. **Create the database in MySQL:**
   ```sql
   CREATE DATABASE IF NOT EXISTS trustvault_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. **Launch with MySQL Profile:**
   ```powershell
   $env:SPRING_PROFILES_ACTIVE = "mysql"
   $env:SPRING_DATASOURCE_USERNAME = "root"
   $env:SPRING_DATASOURCE_PASSWORD = "<YOUR_MYSQL_ROOT_PASSWORD>"
   & "C:\Program Files\Java\jdk-25\bin\java.exe" -jar target\trustvault-1.0.0.jar
   ```

---

## 🧪 Running Automated Tests

TrustVault includes 18 automated integration tests covering authorization, IDOR defenses, upload validation, immediate revocation, and audit tamper detection:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
$env:Path = "C:\Program Files\Java\jdk-25\bin;$env:Path"
cmd.exe /c "call `"$PWD\.tools\maven\bin\mvn.cmd`" test"
```

**Test Suite Coverage Summary:**
```
[INFO] Running com.trustvault.service.AuditChainIntegrityTests
- Test 1: First audit record securely links to Genesis Hash [PASSED]
- Test 2: Sequential records form an unbroken cryptographic SHA-256 chain [PASSED]
- Test 3: Tampering with record details in DB is immediately detected [PASSED]
- Test 4: Deleting an intermediate record breaks chain link and is detected [PASSED]

[INFO] Running com.trustvault.security.DocumentAccessSecurityTests
- IDOR Prevention: Bob cannot view Alice's unshared document metadata [PASSED]
- IDOR Prevention: Bob cannot download Alice's unshared document file [PASSED]
- IDOR Prevention: Bob cannot edit Alice's unshared document [PASSED]
- IDOR Prevention: Bob cannot delete Alice's unshared document [PASSED]
- Admin Role Authorization: Administrator can access any document [PASSED]

[INFO] Running com.trustvault.controller.SharingImmediateRevocationTests
- Smart Sharing: Owner grants READ -> Recipient accesses immediately [PASSED]
- Immediate Revocation: Revoking access blocks recipient on next request [PASSED]
- Role Enforcement: READ grantee cannot edit or delete document [PASSED]
- Permission Upgrade: Upgrading to EDIT allows recipient modification [PASSED]

[INFO] Running com.trustvault.service.DocumentServiceValidationTests
- Upload Validation: Allowed extensions accepted and stored with SHA-256 [PASSED]
- Upload Security: Dangerous executables (.exe, .jsp, .sh, .bat) blocked [PASSED]
- Path Traversal Defense: Directory traversal in filenames intercepted [PASSED]
- Upload Validation: Empty files rejected [PASSED]

[INFO] Running com.trustvault.TrustVaultApplicationTests
- Spring Boot Application Context loads cleanly [PASSED]

[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

## 🧭 Core Endpoints & Route Map

| Path | Method | Access Clearance | Purpose |
| :--- | :---: | :---: | :--- |
| `/login` | `GET`, `POST` | Public | Authentication & 1-click demo login |
| `/register` | `GET`, `POST` | Public | Self-registration (Owner or Viewer) |
| `/dashboard` | `GET` | Authenticated | Executive dashboard with metrics |
| `/documents` | `GET` | Authenticated | Document table with search & category filter |
| `/documents/upload` | `GET`, `POST` | Admin, Owner | Secure document upload |
| `/documents/{id}` | `GET` | Owner, Grantee, Admin | Document metadata & access list (IDOR protected) |
| `/documents/{id}/download` | `GET` | Owner, Grantee, Admin | Secure file download (IDOR protected) |
| `/documents/{id}/edit` | `GET`, `POST` | Owner, Edit Grantee, Admin | Update title, description, category, file |
| `/documents/{id}/delete` | `POST` | Owner, Admin | Delete document and disk file |
| `/documents/{id}/share` | `GET`, `POST` | Owner, Admin | Grant READ or EDIT permission to user |
| `/documents/{id}/revoke` | `POST` | Owner, Admin | Immediately revoke user access |
| `/audit` | `GET` | Admin only | Audit trail explorer with filter bar |
| `/audit/verify` | `POST` | Admin only | Trigger one-click chain verification |
| `/access-denied` | `GET` | Public | Friendly 403 error page with IDOR details |

---

## 💡 Quick Guidance (Telugu-English / Simple English)

> **English:** To start the application, open PowerShell and run:  
> `java -jar target\trustvault-1.0.0.jar`  
> Then open your browser at `http://localhost:8080`. You can click the demo buttons (Admin, Owner, Viewer) to log in instantly!
>
> **Telugu-English:** Application run cheyyadaniki, PowerShell lo ee command ivvandi:  
> `java -jar target\trustvault-1.0.0.jar`  
> Taruvatha browser lo `http://localhost:8080` open cheyyandi. Login screen meeda unna Admin, Owner, Viewer buttons meeda okkasari click chesthe credentials automatic ga fill ayyi login avvochu!

---

## 📁 Project Structure

```
TrustVault/
├── pom.xml                               # Maven project descriptor & dependencies
├── Dockerfile                            # Multi-stage production container build
├── docker-compose.yml                    # Stack definition (App + MySQL 8.0)
├── README.md                             # Comprehensive project documentation
├── THREATS.md                            # STRIDE threat model & mitigations
├── PROMPTS.md                            # AI engineering journal & genuine reflections
├── SECURITY.md                           # Security architecture & crypto spec
├── DATABASE.md                           # Schema definition & MySQL instructions
├── DEPLOYMENT.md                         # Production Linux & Docker deployment guide
├── DEMO_SCRIPT.md                        # Step-by-step evaluator testing guide
├── database/
│   ├── schema.sql                        # MySQL DDL table creation script
│   └── seed.sql                          # Demo seed data script
├── storage/uploads/                      # Private document storage folder
└── src/
    ├── main/
    │   ├── java/com/trustvault/
    │   │   ├── TrustVaultApplication.java
    │   │   ├── config/                   # SecurityConfig, DataInitializer
    │   │   ├── controller/               # Auth, Dashboard, Document, Audit controllers
    │   │   ├── dto/                      # Data Transfer Objects & validation
    │   │   ├── model/                    # JPA Entities (User, Document, Permission, Audit)
    │   │   ├── repository/               # Spring Data JPA Repositories
    │   │   ├── security/                 # UserDetails, SecurityUtils, AccessDeniedHandler
    │   │   └── service/                  # Audit, Storage, Document, Permission, UserService
    │   └── resources/
    │       ├── application.properties    # Default profile (H2 MySQL mode)
    │       ├── application-mysql.properties # MySQL production profile
    │       ├── static/css/app.css        # Enterprise dark-theme CSS
    │       ├── static/js/app.js          # Clipboard copy & dropzone JS
    │       └── templates/                # Thymeleaf HTML views
    └── test/                             # 18 Automated JUnit 5 integration tests
```

---

## 📄 License
This project is licensed under the MIT License.
