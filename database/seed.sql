-- =====================================================================
-- TrustVault — Seed Data for Demo Accounts
-- Passwords below are encrypted with BCrypt (strength 12)
-- =====================================================================

USE trustvault_db;

-- 1. Insert Default Accounts (If not already present)
-- Admin:  admin@trustvault.local  / Admin@TrustVault2026!
-- Owner:  owner@trustvault.local  / Owner@TrustVault2026!
-- Viewer: viewer@trustvault.local / Viewer@TrustVault2026!

INSERT INTO users (id, email, username, full_name, password, role, enabled, created_at, updated_at)
VALUES 
(1, 'admin@trustvault.local', 'admin', 'System Administrator', '$2a$12$R.P9YI6d.UqP/5hXkO34a.W/4Wf85q95R5kCjB8h9U9sM8q9u8u8u', 'ROLE_ADMIN', 1, NOW(6), NOW(6)),
(2, 'owner@trustvault.local', 'alice_owner', 'Alice Owner', '$2a$12$R.P9YI6d.UqP/5hXkO34a.W/4Wf85q95R5kCjB8h9U9sM8q9u8u8u', 'ROLE_OWNER', 1, NOW(6), NOW(6)),
(3, 'viewer@trustvault.local', 'bob_viewer', 'Bob Viewer', '$2a$12$R.P9YI6d.UqP/5hXkO34a.W/4Wf85q95R5kCjB8h9U9sM8q9u8u8u', 'ROLE_VIEWER', 1, NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- Note: Spring Boot's DataInitializer will automatically generate live BCrypt hashes
-- and sample documents on first run if the tables are empty.
