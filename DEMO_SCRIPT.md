# TrustVault — Interactive Evaluation & Demo Script

Follow this step-by-step guide to demonstrate and evaluate all core security, smart sharing, and cryptographic audit trail features in TrustVault.

---

## 1. Quick Launch

Launch the application using your preferred method:

```powershell
# Method A: Pre-built standalone JAR (Zero-config, embedded H2 in MySQL mode)
java -jar target\trustvault-1.0.0.jar

# Method B: Maven boot run
.\.tools\maven\bin\mvn.cmd spring-boot:run
```

Open your browser to: **[http://localhost:8080](http://localhost:8080)**

---

## 2. Pre-Seeded Demo Accounts

The login screen features **1-Click Quick-Fill buttons** for all three roles:

| Role | Username / Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@trustvault.local` (or `admin`) | `Admin@TrustVault2026!` | View system audit trail, run cryptographic verification, inspect all documents |
| **Document Owner (Alice)** | `owner@trustvault.local` (or `alice_owner`) | `Owner@TrustVault2026!` | Upload documents, edit metadata, grant/revoke permissions to collaborators |
| **Viewer (Bob)** | `viewer@trustvault.local` (or `bob_viewer`) | `Viewer@TrustVault2026!` | View and download documents explicitly shared with him; cannot upload or edit |

---

## 3. Walkthrough Scenarios

### Scenario A: Exploring Alice's Vault & Smart Sharing
1. Click the **"Doc Owner (Alice)"** button on the login screen and submit.
2. In the Dashboard, notice Alice's documents:
   - `Q3 Financial Audit Report 2026` (Financial)
   - `Master Mutual NDA Agreement` (Legal)
   - `Zero-Trust Architecture Spec` (Technical)
3. Navigate to **Upload**:
   - Drag & drop any sample `.pdf` or `.docx` file.
   - Enter title `"Executive Strategy 2026"`, category `"Confidential"`.
   - Submit. Note that an immutable SHA-256 hash was generated and logged.
4. Open `Master Mutual NDA Agreement`:
   - Click **Manage Access** (`/documents/2/share`).
   - Notice Bob is **not** currently listed.
5. Sign out using the top-right exit button.

---

### Scenario B: Testing Insecure Direct Object Reference (IDOR) Defense
1. Sign in as **"Viewer (Bob)"** (`viewer@trustvault.local`).
2. Notice Bob's dashboard:
   - `Q3 Financial Audit Report 2026` is visible because Alice previously granted him `READ` access.
   - Click it and verify Bob can download the document.
3. Now attempt an IDOR attack:
   - In your browser's address bar, manually type: `http://localhost:8080/documents/2` (Alice's private NDA document).
   - Press Enter.
4. **Result:**
   - Spring Security and `DocumentService` intercept the request.
   - You are redirected to the security enforcement page: **403 Forbidden — Access Intercepted**.
   - Notice the explanation: *"Policy: Insecure Direct Object Reference (IDOR) & RBAC Check. Status: Intercepted & Recorded in Immutable Audit Chain."*
5. Try directly hitting the download link: `http://localhost:8080/documents/2/download`.
   - **Result:** Intercepted with 403 Forbidden.

---

### Scenario C: Smart Sharing & Immediate Revocation
1. Sign in as **Alice** (`owner@trustvault.local`).
2. Open `Master Mutual NDA Agreement` and click **Manage Access**.
3. Select **"Bob (Compliance Viewer)"** from the dropdown, choose **READ**, and click **Grant Permission**.
4. Sign out, and sign back in as **Bob**.
5. Bob's dashboard now lists `Master Mutual NDA Agreement`. Bob can now view and download it!
6. Sign back in as **Alice**, go to `Master Mutual NDA Agreement` &rarr; **Manage Access**, and click **Revoke Access** next to Bob's name.
7. Sign back in as **Bob** and immediately attempt to view `Master Mutual NDA Agreement`.
8. **Result:** Instant 403 Access Denied! Revocation is immediate—no stale tokens, no waiting for session expiration.

---

### Scenario D: Admin Audit Trail & Cryptographic Verification
1. Sign in as **"Admin"** (`admin@trustvault.local`).
2. Notice the Admin Dashboard:
   - Metric cards show total documents, active users, total audit records, and security violations.
   - Notice the IDOR security violations counter recorded Bob's unauthorized attempts!
3. Click **Audit Trail** in the top navigation bar (`/audit`).
4. Inspect the table:
   - Each event displays its `# Block ID`, timestamp, actor, IP address, action, and cryptographic hashes:
     * `Previous Hash` (linked to preceding block)
     * `Current Hash` (SHA-256 of canonical payload + previous hash)
   - Filter by `Action` (e.g. `ACCESS_DENIED`) or search for `"Bob"`.
5. Click the green button: **"Verify Full Chain Integrity"**.
   - The system loops through all blocks from Genesis (`0000...0000`), recomputing SHA-256 hashes on the fly.
   - **Result Banner:** *"Cryptographic Chain Intact — All cryptographic hash links match and canonical data signatures are authentic."*

---

### Scenario E: Automated Security Test Suite Verification
Run the 18 automated integration tests to prove authorization, IDOR protection, upload sanitization, and tamper detection:

```powershell
.\.tools\maven\bin\mvn.cmd test
```

Expected output:
```
[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```
