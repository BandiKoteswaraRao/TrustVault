# TrustVault — Free Live Deployment Guide

This guide provides step-by-step instructions to deploy **TrustVault** to 100% free hosting providers without requiring a credit card.

---

## Architecture Overview

```
+---------------------------------------+
|   Vercel / Render Static / Netlify    |  <-- Frontend (React + Vite + Tailwind)
|   https://trustvault-app.vercel.app   |      [Port 443 HTTPS]
+-------------------+-------------------+
                    |
                    | HTTPS REST API Calls (Bearer JWT)
                    v
+---------------------------------------+
|        Render.com / Railway           |  <-- Backend (Node.js + Express)
|  https://trustvault-api.onrender.com  |      [Health Check: /health]
+-------------------+-------------------+
                    |
                    | Secure Parameterized Queries (TLS/SSL)
                    v
+---------------------------------------+
|      Neon.tech / Supabase / Render    |  <-- Database (Managed PostgreSQL 15/16)
|   Serverless PostgreSQL Database      |
+---------------------------------------+
```

---

## Option A: 1-Click Blueprint on Render (Recommended)

Render provides free Web Services, free Static Sites, and free PostgreSQL instances without requiring a credit card.

### Step 1: Fork or Push Repository to GitHub
Ensure your repository is pushed to GitHub and set to **Public**.

### Step 2: Deploy Blueprint on Render
1. Sign in to [Render.com](https://render.com) using your GitHub account.
2. Click **New +** in the top navigation and select **Blueprint**.
3. Select your `TrustVault` repository.
4. Render automatically detects `render.yaml`.
5. It will configure:
   - `trustvault-postgres`: Free PostgreSQL Database
   - `trustvault-backend`: Node.js Web Service (running migrations on startup)
   - `trustvault-frontend`: Static React Site
6. Click **Apply**.
7. Once deployed, copy the generated frontend and backend URLs.
8. Update `CORS_ORIGIN` in backend environment variables to match your frontend URL.

---

## Option B: Vercel (Frontend) + Render / Neon (Backend & Database)

### 1. Database Setup on Neon (Free Serverless PostgreSQL)
1. Go to [Neon.tech](https://neon.tech) and create a free account (no credit card).
2. Create a project named `trustvault-db`.
3. Copy the PostgreSQL connection string (`postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`).

### 2. Backend Deployment on Render
1. Go to [Render.com](https://render.com) -> **New Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `4000`
   - `DATABASE_URL`: *(paste your Neon PostgreSQL connection string)*
   - `JWT_SECRET`: *(generate a 32+ character random string)*
   - `AUDIT_HMAC_SECRET`: *(generate a 32+ character random string)*
   - `CORS_ORIGIN`: `*` (or your Vercel URL once known)
   - `STORAGE_DIR`: `storage/uploads`
5. Click **Create Web Service**. The backend will automatically apply SQL migrations on startup and begin listening.
6. Verify the health check: `https://<your-render-api>.onrender.com/health` returns `{"status":"healthy"}`.

### 3. Frontend Deployment on Vercel
1. Go to [Vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New Project** and select `TrustVault`.
3. Configure:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
4. Add Environment Variable:
   - `VITE_API_URL`: `https://<your-render-api>.onrender.com`
5. Click **Deploy**. Vercel will build and serve your frontend over HTTPS.

---

## Verifying Live Deployment

1. **Public URL Smoke Test:** Open the frontend URL in an incognito / logged-out browser window.
2. **Registration Test:** Register a new test account and verify successful login.
3. **Upload Test:** Upload a sample non-sensitive PDF document.
4. **Audit Verification:** Navigate to `/audit` and click **Verify Cryptographic Integrity**. Confirm the green verified banner appears with SHA-256 event count.
5. **Health Check:** Confirm `https://<api-url>/health` returns HTTP 200 with service metadata.
