package com.trustvault.service;

import com.trustvault.dto.AuditVerificationReport;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditLog;
import com.trustvault.model.AuditStatus;
import com.trustvault.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class AuditChainIntegrityTests {

    @Autowired
    private AuditService auditService;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @BeforeEach
    void setUp() {
        auditLogRepository.deleteAll();
    }

    @Test
    @DisplayName("Test 1: First audit record securely links to Genesis Hash")
    void testFirstRecordLinksToGenesisHash() {
        AuditLog record = auditService.recordEvent(
                "alice", "ROLE_OWNER", AuditAction.USER_LOGIN,
                "AUTH", "SESSION_1", "User logged in",
                AuditStatus.SUCCESS, "192.168.1.10"
        );

        assertThat(record.getPreviousHash()).isEqualTo(AuditLog.GENESIS_HASH);
        assertThat(record.getCurrentHash()).hasSize(64);

        AuditVerificationReport report = auditService.verifyChainIntegrity();
        assertThat(report.isValid()).isTrue();
        assertThat(report.getTotalRecords()).isEqualTo(1);
    }

    @Test
    @DisplayName("Test 2: Sequential records form an unbroken cryptographic SHA-256 chain")
    void testSequentialRecordsFormValidChain() {
        AuditLog r1 = auditService.recordEvent("alice", "ROLE_OWNER", AuditAction.DOCUMENT_UPLOAD, "DOCUMENT", "1", "Upload 1", AuditStatus.SUCCESS, "127.0.0.1");
        AuditLog r2 = auditService.recordEvent("bob", "ROLE_VIEWER", AuditAction.DOCUMENT_VIEW, "DOCUMENT", "1", "View 1", AuditStatus.SUCCESS, "127.0.0.1");
        AuditLog r3 = auditService.recordEvent("admin", "ROLE_ADMIN", AuditAction.DOCUMENT_DOWNLOAD, "DOCUMENT", "1", "Download 1", AuditStatus.SUCCESS, "127.0.0.1");

        assertThat(r2.getPreviousHash()).isEqualTo(r1.getCurrentHash());
        assertThat(r3.getPreviousHash()).isEqualTo(r2.getCurrentHash());

        AuditVerificationReport report = auditService.verifyChainIntegrity();
        assertThat(report.isValid()).isTrue();
        assertThat(report.getTotalRecords()).isEqualTo(3);
    }

    @Test
    @DisplayName("Test 3: Tampering with record details in DB is immediately detected")
    void testTamperDetectionOnModifiedRecordData() {
        AuditLog r1 = auditService.recordEvent("alice", "ROLE_OWNER", AuditAction.DOCUMENT_UPLOAD, "DOCUMENT", "1", "Initial upload", AuditStatus.SUCCESS, "127.0.0.1");
        AuditLog r2 = auditService.recordEvent("bob", "ROLE_VIEWER", AuditAction.DOCUMENT_VIEW, "DOCUMENT", "1", "Initial view", AuditStatus.SUCCESS, "127.0.0.1");
        AuditLog r3 = auditService.recordEvent("admin", "ROLE_ADMIN", AuditAction.PERMISSION_GRANT, "PERMISSION", "1:bob", "Initial grant", AuditStatus.SUCCESS, "127.0.0.1");

        // Simulate unauthorized database modification on r2
        auditService.simulateTamperForTest(r2.getId(), "TAMPERED DATA: Bob did NOT view this document!");

        AuditVerificationReport report = auditService.verifyChainIntegrity();
        assertThat(report.isValid()).isFalse();
        assertThat(report.getFailedAtRecordId()).isEqualTo(r2.getId());
        assertThat(report.getFailureReason()).contains("Cryptographic hash mismatch");
    }

    @Test
    @DisplayName("Test 4: Deleting an intermediate audit record breaks the chain link and is detected")
    void testTamperDetectionOnDeletedRecord() {
        AuditLog r1 = auditService.recordEvent("alice", "ROLE_OWNER", AuditAction.DOCUMENT_UPLOAD, "DOCUMENT", "1", "Upload", AuditStatus.SUCCESS, "127.0.0.1");
        AuditLog r2 = auditService.recordEvent("attacker", "ROLE_VIEWER", AuditAction.ACCESS_DENIED, "DOCUMENT", "1", "Exploit attempt", AuditStatus.DENIED, "127.0.0.1");
        AuditLog r3 = auditService.recordEvent("admin", "ROLE_ADMIN", AuditAction.DOCUMENT_DOWNLOAD, "DOCUMENT", "1", "Audit inspection", AuditStatus.SUCCESS, "127.0.0.1");

        // Attacker attempts to delete their failed ACCESS_DENIED log
        auditService.simulateDeletionForTest(r2.getId());

        AuditVerificationReport report = auditService.verifyChainIntegrity();
        assertThat(report.isValid()).isFalse();
        assertThat(report.getFailedAtRecordId()).isEqualTo(r3.getId());
        assertThat(report.getFailureReason()).contains("Broken chain link");
    }
}
