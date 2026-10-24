# TrustVault — Enterprise Production Deployment Guide

This guide details how to securely deploy **TrustVault** in production environments:
1. **Render Cloud Deployment (24/7 Uptime with Blueprint `render.yaml`)**
2. **Supabase Integration (PostgreSQL + Private Storage)**
3. **Environment Variables Reference**
4. **Docker & Docker Compose Deployment**
5. **Native Linux Host Deployment (`systemd`)**
6. **Nginx Reverse Proxy with TLS (Let's Encrypt)**
7. **Backup & Recovery Strategy**

---

## 1. 24/7 Deployment on Render (Recommended Cloud Hosting)

TrustVault includes a native `render.yaml` blueprint and a multi-stage `Dockerfile` (Java 21 LTS runtime).

### Blueprint Setup (1-Click Deployment)
1. Push this repository to GitHub: `https://github.com/BandiKoteswaraRao/TrustVault`.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** -> **Blueprint**.
3. Select the `TrustVault` repository and click **Connect**.
4. Render will parse `render.yaml`, configure the Web Service with Docker runtime, and monitor `/health`.
5. Set the service plan to **Free** (or Starter/Standard for dedicated instances).

### Environment Configuration on Render
In your Web Service Settings -> **Environment Variables**, provide your target database and storage secrets:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` (Automatically bound by Render) | Application HTTP Port |
| `SPRING_PROFILES_ACTIVE` | `postgres` (or `default` for zero-config fallback) | Spring profile |
| `SUPABASE_DB_URL` | `jdbc:postgresql://db.<ref>.supabase.co:5432/postgres?sslmode=require` | Supabase PostgreSQL Connection String |
| `SUPABASE_DB_USER` | `postgres` | Supabase DB Username |
| `SUPABASE_DB_PASSWORD` | `<YOUR_SUPABASE_DB_PASSWORD>` | Supabase DB Password |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase Project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `<YOUR_SERVICE_ROLE_KEY>` | Server-side Supabase privileged key |
| `SUPABASE_STORAGE_BUCKET` | `trustvault-documents` | Name of private storage bucket |
| `TRUSTVAULT_SECURITY_BCRYPT_STRENGTH` | `12` | Production BCrypt cost factor |

### Health Check Endpoint
Render monitors service availability via:
- Path: `/health`
- Expected response: HTTP 200 `{"status":"UP","application":"TrustVault",...}`

---

## 2. Supabase Cloud Configuration (PostgreSQL & Private Storage)

### Step 1: Create Supabase Project
1. Visit [supabase.com](https://supabase.com) and create a new project.
2. Note your project reference ID and database password.

### Step 2: Configure Private Storage Bucket
1. Navigate to **Storage** in your Supabase project.
2. Click **New Bucket**, name it `trustvault-documents`.
3. Toggle **Public Bucket** to **OFF** (Private).
4. Do NOT add public policies; TrustVault authenticates through server-side streaming using the `service_role` key.

### Step 3: Zero-Config Fallback Assurance
If Supabase is temporarily unreachable or credentials are not provided, TrustVault automatically operates in fallback mode:
- Database: Embedded H2 database
- File storage: Local encrypted-storage directory (`storage/uploads/`)
This guarantees 24/7 uptime without total application failure.

---

## 3. Environment Variables Reference

Never store production secrets in source control. Configure the following environment variables on the target host:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SPRING_PROFILES_ACTIVE` | Active configuration profile | `postgres` or `mysql` or `default` |
| `SUPABASE_DB_URL` | PostgreSQL / Supabase JDBC connection string | `jdbc:postgresql://db.<ref>.supabase.co:5432/postgres?sslmode=require` |
| `SUPABASE_DB_USER` | Database username | `postgres` |
| `SUPABASE_DB_PASSWORD` | Strong database password | `[REDACTED_HIGH_ENTROPY_PASSWORD]` |
| `SUPABASE_URL` | Supabase Project URL | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase API key | `[REDACTED_SERVICE_KEY]` |
| `SUPABASE_STORAGE_BUCKET` | Private storage bucket name | `trustvault-documents` |
| `TRUSTVAULT_STORAGE_UPLOAD_DIR` | Absolute path for private local file storage | `/var/lib/trustvault/storage` |
| `TRUSTVAULT_SECURITY_BCRYPT_STRENGTH` | Production BCrypt cost factor | `12` |
| `PORT` | HTTP port for Render / Cloud | `8080` |

---

## 4. Docker & Docker Compose Deployment

### Step 1: Create Environment File (`.env`)
Create a `.env` file in the project root:
```ini
MYSQL_DATABASE=trustvault_db
MYSQL_USER=trustvault_app
MYSQL_PASSWORD=SuperSecretProdPassword2026!
MYSQL_ROOT_PASSWORD=SuperSecretRootPassword2026!
SPRING_PROFILES_ACTIVE=mysql
```

### Step 2: Build and Start Containers
```bash
docker compose up -d --build
```

### Step 3: Verify Health
```bash
docker compose ps
docker compose logs -f app
```

---

## 5. Native Linux Host Deployment (`systemd`)

### Step 1: Create Dedicated Service User
```bash
sudo useradd -r -s /bin/false trustvault
sudo mkdir -p /var/lib/trustvault/storage/uploads
sudo chown -R trustvault:trustvault /var/lib/trustvault
```

### Step 2: Install Application Binary
```bash
sudo cp target/trustvault-1.0.0.jar /opt/trustvault/trustvault.jar
sudo chown -R trustvault:trustvault /opt/trustvault
```

### Step 3: Create systemd Unit (`/etc/systemd/system/trustvault.service`)
```ini
[Unit]
Description=TrustVault Secure Document Vault
After=syslog.target network.target postgresql.service

[Service]
User=trustvault
Group=trustvault
Type=simple
Environment="SPRING_PROFILES_ACTIVE=postgres"
Environment="SUPABASE_DB_URL=jdbc:postgresql://db.YOUR_REF.supabase.co:5432/postgres?sslmode=require"
Environment="SUPABASE_DB_USER=postgres"
Environment="SUPABASE_DB_PASSWORD=SuperSecretProdPassword2026!"
Environment="TRUSTVAULT_STORAGE_UPLOAD_DIR=/var/lib/trustvault/storage/uploads"
ExecStart=/usr/bin/java -Xms512m -Xmx2048m -XX:+UseG1GC -jar /opt/trustvault/trustvault.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Step 4: Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable trustvault
sudo systemctl start trustvault
sudo systemctl status trustvault
```

---

## 6. Nginx Reverse Proxy with TLS (Let's Encrypt)

```nginx
server {
    listen 80;
    server_name vault.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vault.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/vault.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vault.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Maximum file upload size to allow 10MB documents
    client_max_body_size 15M;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 7. Backup & Recovery Strategy

1. **Database Backups (PostgreSQL):**
   ```bash
   pg_dump -U postgres -h db.YOUR_REF.supabase.co postgres > trustvault_backup_$(date +%F).sql
   ```
2. **Document Storage Files:**
   Supabase Storage maintains multi-region replication. For local storage, backup the `/var/lib/trustvault/storage/uploads` directory using an incremental backup tool (e.g. `restic` or `borgbackup`).
3. **Disaster Recovery:**
   Restore SQL dump followed by file restore to ensure all stored UUID files match the `file_hash` records in `documents`.
