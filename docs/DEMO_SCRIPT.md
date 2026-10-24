# TrustVault — Interactive Evaluation Demo Script

This script provides evaluators and reviewers with a step-by-step walkthrough demonstrating all core features: server-enforced authorization, permission delegation, immediate revocation, and real-time cryptographic audit trail verification.

---

## Prerequisites & Pre-Seeded Demo Accounts

The system includes pre-seeded demo accounts with bcrypt-hashed passwords (work factor 12):

| Role | Email Address | Password |
| :--- | :--- | :--- |
| **Owner (Alice)** | `demo.owner@trustvault.local` | `DemoOwner123!` |
| **Recipient (Bob)** | `demo.recipient@trustvault.local` | `DemoRecipient123!` |

---

## Step-by-Step Demonstration Walkthrough

### Step 1: Sign in as Document Owner (Alice)
1. Navigate to the TrustVault web interface.
2. Click **Sign In** or **Get Started**.
3. Click the quick button **"Alice (Owner)"** (or enter `demo.owner@trustvault.local` / `DemoOwner123!`).
4. Click **Authenticate Session**.
5. *Verification:* Confirm you are directed to the Dashboard showing Alice's active session, document count, and audit status.

### Step 2: Upload a Non-Sensitive Sample Document
1. In the top navigation, click **Upload** (or click **Upload Document** on the dashboard).
2. Enter Title: `Project Alpha Security Specification`.
3. Enter Description: `Confidential architectural requirements and threat model`.
4. Drag and drop or browse to select a sample PDF (or `.txt` / `.png` / `.docx` file, max 10MB).
5. Click **Securely Store in Vault**.
6. *Verification:*
   - You are redirected to the Document Details page.
   - The SHA-256 cryptographic digest is calculated and displayed with a green "Verified" badge.
   - The original file name and isolated UUID storage record are created on the backend.

### Step 3: Grant Access to the Recipient (Bob)
1. On the Document Details page for `Project Alpha Security Specification`, locate the **Access Control & Permission Management** panel.
2. Click **Grant Access**.
3. In the Grantee Email field, enter: `demo.recipient@trustvault.local`.
4. Select Permission Level: `Download (Read & Download binary)`.
5. Click **Confirm Grant**.
6. *Verification:*
   - A success notification appears: `Access successfully granted to demo.recipient@trustvault.local`.
   - Bob appears in the **Active Access Grants** table.
   - A `PERMISSION_GRANT` audit event is cryptographically sealed into the database hash chain.

### Step 4: Sign in as Recipient (Bob) and Download Document
1. In the top-right user menu, click **Logout**.
2. Click **Sign In** and click **"Bob (Recipient)"** (or enter `demo.recipient@trustvault.local` / `DemoRecipient123!`).
3. Click **Authenticate Session**.
4. In the navigation, click **Documents**, then select the **Shared With Me** tab.
5. Confirm `Project Alpha Security Specification` appears with:
   - Shared By: Alice VaultOwner
   - Permission: Download
6. Click **Download Authorized Document**.
7. *Verification:* The document downloads successfully to your browser. A `DOCUMENT_DOWNLOAD` audit event is recorded with outcome `SUCCESS`.

### Step 5: Revoke Recipient's Access as Owner (Alice)
1. Logout from Bob's session.
2. Sign back in as Alice (`demo.owner@trustvault.local`).
3. Go to **Documents**, click on `Project Alpha Security Specification`.
4. In the **Active Access Grants** table, locate Bob Recipient.
5. Click the **Revoke** button and confirm the dialog prompt.
6. *Verification:*
   - Bob is immediately moved to the **Revoked Access History** table with timestamp.
   - A `PERMISSION_REVOKE` audit event is sealed into the chain.

### Step 6: Verify Immediate Revocation Enforcement (Zero Latency)
1. Logout and sign back in as Bob (`demo.recipient@trustvault.local`).
2. Go to **Documents** -> **Shared With Me**.
3. Notice that the document is no longer listed in active shares.
4. *Direct API Test (Evaluator Simulation):* If Bob attempts to call `GET /api/documents/<alice-doc-id>/download` using his token, the backend immediately returns:
   ```json
   {
     "error": "Forbidden",
     "message": "Access denied: You do not have permission to access this document."
   }
   ```
5. *Verification:* Immediate revocation is server-enforced; revoked users cannot access the document content.

### Step 7: Inspect and Verify the Cryptographic Audit Trail
1. In the top navigation, click **Audit Trail**.
2. Inspect the audit log table:
   - Review records for: `AUTH_LOGIN_SUCCESS`, `DOCUMENT_UPLOAD`, `PERMISSION_GRANT`, `DOCUMENT_DOWNLOAD`, `PERMISSION_REVOKE`.
   - Click the chevron on any row to expand the record: observe `prev_hash` and `current_hash` (SHA-256 digests).
3. Click **Verify Cryptographic Integrity**.
4. *Verification:*
   - The verification engine computes the canonical hash of every sequential event from genesis to head.
   - A green banner confirms: `Audit Trail Fully Intact & Cryptographically Verified`.
   - The chain head HMAC anchor signature is displayed.

### Step 8: Run Automated Security & Integrity Tests
In the terminal, run the automated test suite:
```bash
cd backend
npm test
```
*Verification:*
- All 34 automated security tests pass:
  - 10 Authentication & Identity tests
  - 13 Server-Enforced Authorization & BOLA/IDOR tests (covering all 10 mandatory negative cases)
  - 7 Cryptographic Audit Chain & Tamper Detection tests
  - 4 SQL Injection, XSS, and Path Traversal tests

### Step 9: Review Live URL & Public GitHub Repository
- **Public GitHub Repository:** *[Configured upon push]*
- **Live Deployment URL:** *[Configured upon deployment]*
- **Health Check Endpoint:** `https://<api-url>/health`
