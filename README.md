# TrustVault — secure document sharing with a real audit trail

[![Java](https://img.shields.io/badge/Java-21%20%7C%2025%20LTS-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.5-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![Spring Security](https://img.shields.io/badge/Spring%20Security-6.3-green.svg)](https://spring.io/projects/spring-security)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Supabase%20%7C%20MySQL%20%7C%20H2-blue.svg)](https://supabase.com/)
[![Render Status](https://img.shields.io/badge/Render-Deploy%20Ready-10b981.svg?logo=render)](https://dashboard.render.com)
[![Tests](https://img.shields.io/badge/JUnit%205-27%20Passed-success.svg)](#running-automated-tests)
[![UI Theme](https://img.shields.io/badge/UI%20Theme-Black%20%26%20Emerald%20Green-10b981.svg)](#accessible--responsive-enterprise-ui)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BandiKoteswaraRao/TrustVault)

> 🌐 **Live Cloud Deployment on Render:**  
> **Blueprint:** [`render.yaml`](render.yaml) (Web Service: `trustvault`)  
> **Health Monitor:** `/health` (Continuous 24/7 uptime monitoring)  
> **Evaluation Launch:** 1-Click deploy via Render Blueprint directly from this repository.

**TrustVault** is an enterprise-grade full-stack web application designed for high-security document sharing, granular access control, user management, and compliance auditing. Built on Spring Boot, Spring Security, and Thymeleaf with an ultra-sleek **Black & Emerald-Green** theme, TrustVault guarantees strict server-side authorization on every operation, eliminates Insecure Direct Object References (IDOR), connects seamlessly with **Supabase PostgreSQL & Private Storage** (with zero-config local fallback), and seals every security event inside a **tamper-evident SHA-256 cryptographic hash chain** with real-time verification.

---

## 🛡️ Core Features

1. **Authentication, RBAC & Profile Management:**
   - Pre-configured `ROLE_ADMIN`, `ROLE_OWNER`, and `ROLE_VIEWER` roles.
   - Passwords securely hashed with BCrypt (strength 12).
   - Session fixation defense, strict cookie flags (`HttpOnly`, `SameSite=Lax`), and CSRF protection on all forms.
   - **User Profile Management (`/profile`):** View details, update display name, and securely change password with verification of existing password.
   - **Administrative User Management (`/admin/users`):** Admins can view all accounts, suspend/reactivate users, and promote/demote roles without code changes.
   - **1-Click Demo Login credentials** directly on the sign-in page for evaluation.

2. **Secure Document Management (Hybrid Local & Supabase Storage):**
   - **Supabase Storage Integration:** Private document bucket (`trustvault-documents`) streaming securely via server-side credentials.
   - **Zero-Config Local Fallback:** When Supabase is not configured, automatically persists files into private storage (`storage/uploads/`) outside the web root.
   - Disk filenames randomized using cryptographically strong UUIDs (`<uuid>.<ext>`) to prevent direct static access.
   - Strict filename sanitization (`FilenameUtils.getName()`) preventing directory traversal (`..`, `%00`).
   - Extension whitelist validation (`.pdf`, `.docx`, `.xlsx`, `.png`, etc.) rejecting dangerous executables (`.exe`, `.jsp`, `.sh`, `.bat`).
   - Instant calculation and storage of raw file content SHA-256 digests.

3. **Smart Sharing & Immediate Revocation:**
   - Document owners can grant granular `READ` (view & download) or `EDIT` (view, download, modify metadata/file) access to specific collaborators.
   - **Immediate Revocation:** Permissions are verified directly against the database on every protected request. Revoking access blocks the recipient on their very next HTTP request without waiting for token expiry.

4. **Tamper-Evident Audit Trail (Cryptographic Hash Chain):**
   - Every security event (upload, download, edit, delete, grant, revoke, profile update, password change, account suspension, and denied access) is sealed into a cryptographic block.
   - Each block contains: `timestamp`, `actor`, `action`, `target`, `details`, `status`, `ip_address`, `previous_hash`, and `current_hash`.
   - Starts from an established 64-character Genesis Hash (`0000...0000`).
   - **One-Click Integrity Verification:** Recalculates every hash from Genesis to the latest block. Instantly flags modified records, broken links from deletions, or reordered blocks with exact record ID and index.

5. **Executive Security Dashboard:**
   - Real-time metrics: Total Documents, Active Users, Total Audit Blocks, and Security Violations (IDOR interceptions).
   - Live Audit Chain Status indicator with hash display.
   - Recent activity feed, quick persona switcher, and document browser.

6. **Accessible & Responsive Enterprise UI (Black & Emerald-Green):**
   - Modern, high-contrast dark aesthetic built with Tailwind CSS, custom emerald (`#10b981`, `#059669`) highlights, and deep black (`#050807`) backgrounds.
   - Category filtering (`Financial`, `Legal`, `Confidential`, `Technical`, `Personal`, `General`) and real-time search.
   - Custom accessible 403 Forbidden, 404 Not Found, and 500 Error pages explaining security interception context.

---

## 🧱 Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend Framework** | Java 21 / 25 LTS, Spring Boot 3.3.5 |
| **Security & RBAC** | Spring Security 6, BCrypt, CSRF Protection |
| **Persistence / ORM** | Spring Data JPA, Hibernate ORM 6.5 |
| **Databases** | PostgreSQL 15+ / Supabase (Production), MySQL 8.x, & Embedded H2 (Zero-Config Fallback) |
| **Cloud Storage** | Supabase Storage (Private Bucket `trustvault-documents`) with local disk fallback |
| **Deployment Platform** | Render (`render.yaml` Blueprint, Docker runtime, 24/7 uptime) |
| **Monitoring** | Spring Boot Actuator (`/health`, `/actuator/health`, `/actuator/info`) |
| **Frontend Templates** | Thymeleaf 3, Thymeleaf Spring Security 6 extras |
| **Styling & Interaction** | Tailwind CSS CDN, Black & Emerald-Green Theme CSS, Vanilla JavaScript |
| **Build & Testing** | Apache Maven 3.10.0, JUnit 5, AssertJ, Spring Security Test, Mockito |

---

## 🚀 Quick Start (Zero-Configuration Local Run)

### Prerequisites
- Java JDK 21 or 25 installed.

### Run with Maven Wrapper
TrustVault comes ready-to-run with zero configuration. By default, it starts in standalone mode with an embedded in-memory database and local file storage:

```powershell
# Using the workspace Maven wrapper:
cmd.exe /c "set JAVA_HOME=C:\Program Files\Java\jdk-25&& .\.tools\maven\bin\mvn.cmd spring-boot:run"
```

Or build and run the executable JAR:
```powershell
cmd.exe /c "set JAVA_HOME=C:\Program Files\Java\jdk-25&& .\.tools\maven\bin\mvn.cmd clean package -DskipTests"
& "C:\Program Files\Java\jdk-25\bin\java.exe" -jar target\trustvault-1.0.0.jar
```

Open your browser and navigate to:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 🔑 Pre-Seeded Demo Accounts (1-Click Login)

The login screen features **1-Click Quick-Fill buttons** so you can test all roles immediately:

| Role | Username / Email | Password | What You Can Test |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@trustvault.local` | `Admin@TrustVault2026!` | View system audit trail, run cryptographic verification, manage users (`/admin/users`), view all documents |
| **Doc Owner (Alice)** | `owner@trustvault.local` | `Owner@TrustVault2026!` | Upload documents, edit files, grant/revoke sharing permissions, manage profile |
| **Viewer (Bob)** | `viewer@trustvault.local` | `Viewer@TrustVault2026!` | View shared docs; test IDOR blocking on Alice's private documents |

---

## 🌐 24/7 Deployment on Render

TrustVault is fully configured for continuous 24/7 cloud deployment on **Render** via Docker and the included `render.yaml` blueprint.

### 1-Click / Blueprint Deployment Steps:
1. Log in to [Render](https://render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository: `https://github.com/BandiKoteswaraRao/TrustVault`.
4. Render automatically detects `render.yaml`, builds the multi-stage `Dockerfile`, exposes port `${PORT:8080}`, and monitors service health at `/health`.
5. Once deployed, Render assigns a live public HTTPS URL (e.g., `https://trustvault.onrender.com`).

### Zero-Downtime Healthcheck:
Render monitors the application using:
- **`GET /health`** &rarr; Returns `{"status":"UP","application":"TrustVault","timestamp":...}`

---

## ⚡ Connecting to Supabase (PostgreSQL & Storage)

TrustVault supports persistent cloud storage and database hosting via **Supabase**.

### 1. Database (PostgreSQL):
In your Supabase project dashboard, navigate to **Project Settings** &rarr; **Database** &rarr; **Connection String (URI)**.
Configure in your deployment environment (or Render dashboard):
```ini
SPRING_PROFILES_ACTIVE=postgres
SUPABASE_DB_URL=jdbc:postgresql://db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=YOUR_STRONG_SUPABASE_PASSWORD
```

### 2. Private Storage (`trustvault-documents`):
1. In the Supabase Dashboard, go to **Storage** &rarr; **Create Bucket**.
2. Name the bucket `trustvault-documents`.
3. Set bucket privacy to **Private** (disables direct public HTTP access).
4. In **Project Settings** &rarr; **API**, copy your **Project URL** and **`service_role`** key (keep this secret!).
5. Set environment variables:
```ini
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=trustvault-documents
```

> **Note:** If Supabase credentials are left blank, TrustVault automatically falls back to local disk storage (`storage/uploads/`), ensuring the application functions flawlessly offline and in isolated environments.

---

## 🧪 Running Automated Tests

TrustVault includes 27 automated integration, security, and cryptographic tests covering authorization, IDOR defenses, upload validation, immediate revocation, profile management, and audit tamper detection:

```powershell
cmd.exe /c "set JAVA_HOME=C:\Program Files\Java\jdk-25&& .\.tools\maven\bin\mvn.cmd test"
```

**Test Suite Coverage Summary (27/27 Passed):**
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

[INFO] Running com.trustvault.controller.UserManagementAndProfileSecurityTests
- Health check endpoint returns 200 UP [PASSED]
- Profile Update: Authenticated user can update display name [PASSED]
- Password Change: Valid current password allows change [PASSED]
- Password Change: Incorrect old password rejected [PASSED]
- Password Change: Confirmation mismatch rejected [PASSED]
- Admin User Management: Admin can view all users and toggle active status [PASSED]
- Admin User Management: Non-admin is blocked from toggling status [PASSED]
- Admin User Management: Non-admin is redirected to access-denied [PASSED]

[INFO] Running com.trustvault.TrustVaultApplicationTests
- Spring Boot Application Context loads cleanly [PASSED]

[INFO] Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

## 🧭 Core Endpoints & Route Map

| Path | Method | Access Clearance | Purpose |
| :--- | :---: | :---: | :--- |
| `/health` | `GET` | Public | Application healthcheck for Render & monitoring |
| `/login` | `GET`, `POST` | Public | Authentication & 1-click demo login |
| `/register` | `GET`, `POST` | Public | Self-registration (Owner or Viewer) |
| `/dashboard` | `GET` | Authenticated | Executive dashboard with metrics & quick persona switcher |
| `/documents` | `GET` | Authenticated | Document table with search & category filter |
| `/documents/upload` | `GET`, `POST` | Admin, Owner | Secure document upload (Local or Supabase) |
| `/documents/{id}` | `GET` | Owner, Grantee, Admin | Document metadata & access list (IDOR protected) |
| `/documents/{id}/download` | `GET` | Owner, Grantee, Admin | Secure file download (server-side streamed) |
| `/documents/{id}/edit` | `GET`, `POST` | Owner, Edit Grantee, Admin | Update title, description, category, file |
| `/documents/{id}/delete` | `POST` | Owner, Admin | Delete document from database and storage |
| `/documents/{id}/share` | `GET`, `POST` | Owner, Admin | Grant READ or EDIT permission to user |
| `/documents/{id}/revoke` | `POST` | Owner, Admin | Immediately revoke user access |
| `/profile` | `GET`, `POST` | Authenticated | View profile details and update display name |
| `/profile/password` | `GET`, `POST` | Authenticated | Secure password change with old password verification |
| `/admin/users` | `GET` | Admin only | User management table with status and role management |
| `/admin/users/{id}/toggle-status` | `POST` | Admin only | Suspend or reactivate user account |
| `/admin/users/{id}/role` | `POST` | Admin only | Promote or demote user role |
| `/audit` | `GET` | Admin only | Audit trail explorer with filter bar |
| `/audit/verify` | `POST` | Admin only | Trigger one-click cryptographic chain verification |
| `/access-denied` | `GET` | Public | Friendly 403 error page with IDOR interception details |

---

## 📁 Project Structure

```
TrustVault/
├── pom.xml                               # Maven project descriptor & dependencies
├── Dockerfile                            # Multi-stage production container build (Java 21)
├── docker-compose.yml                    # Stack definition (App + MySQL 8.0)
├── render.yaml                           # Render Infrastructure-as-Code Blueprint
├── .env.example                          # Environment configuration template
├── README.md                             # Comprehensive project documentation
├── THREATS.md                            # STRIDE threat model & mitigations
├── PROMPTS.md                            # AI engineering journal & development log
├── SECURITY.md                           # Security architecture & crypto spec
├── DATABASE.md                           # Schema definition & PostgreSQL/MySQL instructions
├── DEPLOYMENT.md                         # Production Render, Linux & Docker deployment guide
├── DEMO_SCRIPT.md                        # Step-by-step evaluator testing guide
├── database/
│   ├── schema.sql                        # SQL DDL table creation script
│   └── seed.sql                          # Demo seed data script
├── storage/uploads/                      # Private document storage folder (fallback)
└── src/
    ├── main/
    │   ├── java/com/trustvault/
    │   │   ├── TrustVaultApplication.java
    │   │   ├── config/                   # SecurityConfig, DataInitializer
    │   │   ├── controller/               # Auth, Dashboard, Document, Audit, Profile, Admin controllers
    │   │   ├── dto/                      # Data Transfer Objects & validation
    │   │   ├── model/                    # JPA Entities (User, Document, Permission, AuditLog)
    │   │   ├── repository/               # Spring Data JPA Repositories
    │   │   ├── security/                 # UserDetails, SecurityUtils, AccessDeniedHandler
    │   │   └── service/                  # Audit, Storage, Document, Permission, UserService
    │   └── resources/
    │       ├── application.properties    # Default profile (H2, dynamic PORT, Supabase settings)
    │       ├── application-postgres.properties # Supabase / PostgreSQL production profile
    │       ├── application-supabase.properties # Supabase alias profile
    │       ├── application-mysql.properties    # MySQL production profile
    │       ├── static/css/app.css        # Enterprise Black & Emerald-Green Theme CSS
    │       ├── static/js/app.js          # Clipboard copy & dropzone JS
    │       └── templates/                # Thymeleaf HTML views
    └── test/                             # 27 Automated JUnit 5 integration tests
```

---

## 📄 License
This project is licensed under the MIT License.
