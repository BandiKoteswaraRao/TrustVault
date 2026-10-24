# TrustVault — Enterprise Production Deployment Guide

This guide details how to securely deploy **TrustVault** in production environments using Docker, Docker Compose, or Linux `systemd` with an Nginx TLS reverse proxy.

---

## 1. Environment Variables Reference

Never store production secrets in source control. Configure the following environment variables on the target host:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SPRING_PROFILES_ACTIVE` | Active configuration profile | `mysql` |
| `SPRING_DATASOURCE_URL` | MySQL JDBC connection string | `jdbc:mysql://db.prod.internal:3306/trustvault_db?useSSL=true` |
| `SPRING_DATASOURCE_USERNAME` | Database username | `trustvault_app` |
| `SPRING_DATASOURCE_PASSWORD` | Strong database password | `[REDACTED_HIGH_ENTROPY_PASSWORD]` |
| `TRUSTVAULT_STORAGE_UPLOAD_DIR` | Absolute path for private file storage | `/var/lib/trustvault/storage` |
| `TRUSTVAULT_SECURITY_BCRYPT_STRENGTH` | Production BCrypt cost factor | `12` |
| `SERVER_PORT` | HTTP port | `8080` |

---

## 2. Docker & Docker Compose Deployment (Recommended)

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

## 3. Native Linux Host Deployment (`systemd`)

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
After=syslog.target network.target mysql.service

[Service]
User=trustvault
Group=trustvault
Type=simple
Environment="SPRING_PROFILES_ACTIVE=mysql"
Environment="SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/trustvault_db?useSSL=false&serverTimezone=UTC"
Environment="SPRING_DATASOURCE_USERNAME=trustvault_app"
Environment="SPRING_DATASOURCE_PASSWORD=SuperSecretProdPassword2026!"
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

## 4. Nginx Reverse Proxy with TLS (Let's Encrypt)

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

## 5. Backup & Recovery Strategy

1. **Database Backups:**
   ```bash
   mysqldump -u trustvault_app -p --single-transaction --quick trustvault_db > trustvault_backup_$(date +%F).sql
   ```
2. **Document Storage Files:**
   Backup the `/var/lib/trustvault/storage/uploads` directory using an incremental backup tool (e.g. `restic` or `borgbackup`).
3. **Disaster Recovery:**
   Restore SQL dump followed by file restore to ensure all stored UUID files match the `file_hash` records in `documents`.
