package com.trustvault.config;

import com.trustvault.dto.DocumentUploadDto;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditStatus;
import com.trustvault.model.PermissionType;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.DocumentRepository;
import com.trustvault.repository.UserRepository;
import com.trustvault.service.AuditService;
import com.trustvault.service.DocumentService;
import com.trustvault.service.PermissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
@Profile("!test")
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final PasswordEncoder passwordEncoder;
    private final DocumentService documentService;
    private final PermissionService permissionService;
    private final AuditService auditService;

    public DataInitializer(UserRepository userRepository,
                           DocumentRepository documentRepository,
                           PasswordEncoder passwordEncoder,
                           DocumentService documentService,
                           PermissionService permissionService,
                           AuditService auditService) {
        this.userRepository = userRepository;
        this.documentRepository = documentRepository;
        this.passwordEncoder = passwordEncoder;
        this.documentService = documentService;
        this.permissionService = permissionService;
        this.auditService = auditService;
    }

    private static class SimpleMultipartFile implements MultipartFile {
        private final String name;
        private final String originalFilename;
        private final String contentType;
        private final byte[] content;

        public SimpleMultipartFile(String name, String originalFilename, String contentType, byte[] content) {
            this.name = name;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.content = content != null ? content : new byte[0];
        }

        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return originalFilename; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return content.length == 0; }
        @Override public long getSize() { return content.length; }
        @Override public byte[] getBytes() { return content; }
        @Override public InputStream getInputStream() { return new ByteArrayInputStream(content); }
        @Override public Resource getResource() { return new ByteArrayResource(content); }
        @Override public void transferTo(File dest) throws IOException {
            try (FileOutputStream fos = new FileOutputStream(dest)) { fos.write(content); }
        }
        @Override public void transferTo(Path dest) throws IOException {
            Files.write(dest, content);
        }
    }

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.count() > 0) {
            log.info("Database already initialized. Skipping demo account seed.");
            return;
        }

        log.info("Seeding TrustVault demo accounts and sample secure documents...");

        // 1. Seed Admin
        User admin = new User(
                "admin@trustvault.local",
                "admin",
                "TrustVault Security Admin",
                passwordEncoder.encode("Admin@TrustVault2026!"),
                Role.ROLE_ADMIN
        );
        admin = userRepository.save(admin);
        auditService.recordEvent(
                "system",
                "ROLE_SYSTEM",
                AuditAction.USER_REGISTER,
                "USER",
                admin.getId().toString(),
                "System initialized default Admin account: " + admin.getEmail(),
                AuditStatus.SUCCESS,
                "127.0.0.1"
        );

        // 2. Seed Document Owner
        User owner = new User(
                "owner@trustvault.local",
                "alice_owner",
                "Alice (Document Owner)",
                passwordEncoder.encode("Owner@TrustVault2026!"),
                Role.ROLE_OWNER
        );
        owner = userRepository.save(owner);
        auditService.recordEvent(
                "system",
                "ROLE_SYSTEM",
                AuditAction.USER_REGISTER,
                "USER",
                owner.getId().toString(),
                "Seeded demo Document Owner account: " + owner.getEmail(),
                AuditStatus.SUCCESS,
                "127.0.0.1"
        );

        // 3. Seed Viewer
        User viewer = new User(
                "viewer@trustvault.local",
                "bob_viewer",
                "Bob (Compliance Viewer)",
                passwordEncoder.encode("Viewer@TrustVault2026!"),
                Role.ROLE_VIEWER
        );
        viewer = userRepository.save(viewer);
        auditService.recordEvent(
                "system",
                "ROLE_SYSTEM",
                AuditAction.USER_REGISTER,
                "USER",
                viewer.getId().toString(),
                "Seeded demo Viewer account: " + viewer.getEmail(),
                AuditStatus.SUCCESS,
                "127.0.0.1"
        );

        // 4. Seed Sample Documents for Alice Owner
        SimpleMultipartFile file1 = new SimpleMultipartFile(
                "file",
                "Q3_Financial_Audit_Report_2026.pdf",
                "application/pdf",
                "%PDF-1.4\n% TrustVault Sample Secure Financial Audit Report Content\nConfidential Financial Data 2026\n%%EOF".getBytes(StandardCharsets.UTF_8)
        );
        DocumentUploadDto dto1 = new DocumentUploadDto();
        dto1.setTitle("Q3 Financial Audit Report 2026");
        dto1.setDescription("Quarterly certified financial audit and balance sheet analysis with tamper-evident attestation.");
        dto1.setCategory("Financial");
        dto1.setFile(file1);
        var doc1 = documentService.uploadDocument(dto1, owner, "127.0.0.1");

        SimpleMultipartFile file2 = new SimpleMultipartFile(
                "file",
                "Master_Mutual_NDA_Agreement.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "TrustVault Confidential Non-Disclosure Agreement Content strictly protected.".getBytes(StandardCharsets.UTF_8)
        );
        DocumentUploadDto dto2 = new DocumentUploadDto();
        dto2.setTitle("Master Mutual NDA Agreement");
        dto2.setDescription("Executive-level non-disclosure agreement with enterprise strict retention rules.");
        dto2.setCategory("Legal");
        dto2.setFile(file2);
        var doc2 = documentService.uploadDocument(dto2, owner, "127.0.0.1");

        SimpleMultipartFile file3 = new SimpleMultipartFile(
                "file",
                "Zero_Trust_Architecture_Spec.pdf",
                "application/pdf",
                "%PDF-1.4\n% TrustVault Zero Trust Architecture Security Whitepaper\nCryptographic hash chains and RBAC\n%%EOF".getBytes(StandardCharsets.UTF_8)
        );
        DocumentUploadDto dto3 = new DocumentUploadDto();
        dto3.setTitle("Zero-Trust Architecture Spec");
        dto3.setDescription("Technical whitepaper specifying cryptographic hash chains and strict server-side authorization.");
        dto3.setCategory("Technical");
        dto3.setFile(file3);
        var doc3 = documentService.uploadDocument(dto3, owner, "127.0.0.1");

        // 5. Alice shares doc1 ("Q3 Financial Audit Report") with Bob (READ permission)
        permissionService.grantOrUpdatePermission(doc1, viewer, PermissionType.READ, owner, "127.0.0.1");

        log.info("TrustVault demo accounts and sample data initialized successfully!");
        log.info("Credentials summary:");
        log.info("  Admin:  admin@trustvault.local  / Admin@TrustVault2026!");
        log.info("  Owner:  owner@trustvault.local  / Owner@TrustVault2026!");
        log.info("  Viewer: viewer@trustvault.local / Viewer@TrustVault2026!");
    }
}
