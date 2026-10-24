-- =====================================================================
-- TrustVault — Database Schema Definition (MySQL 8.0+ / 26.x compatible)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS trustvault_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE trustvault_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    username VARCHAR(60) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    INDEX idx_user_email (email),
    INDEX idx_user_username (username),
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    original_file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL UNIQUE,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_hash CHAR(64) NOT NULL,
    owner_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    CONSTRAINT fk_documents_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_doc_owner (owner_id),
    INDEX idx_doc_category (category),
    INDEX idx_doc_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Document Permissions Table (Smart Sharing)
CREATE TABLE IF NOT EXISTS document_permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    permission_type VARCHAR(20) NOT NULL,
    granted_by_id BIGINT NOT NULL,
    granted_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_doc_user UNIQUE (document_id, user_id),
    CONSTRAINT fk_perm_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_perm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_perm_granter FOREIGN KEY (granted_by_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_perm_doc (document_id),
    INDEX idx_perm_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Audit Logs Table (Tamper-Evident SHA-256 Hash Chaining)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME(6) NOT NULL,
    actor_username VARCHAR(100) NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(30) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details TEXT,
    status VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45),
    previous_hash CHAR(64) NOT NULL,
    current_hash CHAR(64) NOT NULL,
    INDEX idx_audit_actor (actor_username),
    INDEX idx_audit_action (action),
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
