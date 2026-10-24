package com.trustvault.service;

import com.trustvault.dto.AuditVerificationReport;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditLog;
import com.trustvault.model.AuditStatus;
import com.trustvault.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Appends an audit event to the cryptographic hash chain.
     * Uses Propagation.REQUIRES_NEW so that security audit logs (like ACCESS_DENIED)
     * are committed in an autonomous transaction even if the caller throws SecurityException.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public synchronized AuditLog recordEvent(String actorUsername, String actorRole, AuditAction action,
                                             String targetType, String targetId, String details,
                                             AuditStatus status, String ipAddress) {
        Optional<AuditLog> latestOpt = auditLogRepository.findTopByOrderByIdDesc();
        String previousHash = latestOpt.map(AuditLog::getCurrentHash).orElse(AuditLog.GENESIS_HASH);

        LocalDateTime now = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        AuditLog auditLog = new AuditLog();
        auditLog.setTimestamp(now);
        auditLog.setActorUsername(actorUsername != null ? actorUsername : "system");
        auditLog.setActorRole(actorRole != null ? actorRole : "ROLE_SYSTEM");
        auditLog.setAction(action);
        auditLog.setTargetType(targetType);
        auditLog.setTargetId(targetId);
        auditLog.setDetails(details);
        auditLog.setStatus(status != null ? status : AuditStatus.SUCCESS);
        auditLog.setIpAddress(ipAddress != null ? ipAddress : "127.0.0.1");
        auditLog.setPreviousHash(previousHash);

        String canonicalPayload = auditLog.toCanonicalPayload();
        String currentHash = calculateSha256(canonicalPayload);
        auditLog.setCurrentHash(currentHash);

        AuditLog saved = auditLogRepository.save(auditLog);
        log.info("Audit entry #{} logged: action={}, actor={}, status={}, hash={}",
                saved.getId(), action, actorUsername, status, currentHash.substring(0, 16) + "...");
        return saved;
    }

    /**
     * Verifies the cryptographic integrity of the entire audit chain.
     * Checks:
     * 1. Genesis hash correctness.
     * 2. Sequential previous-hash linkage (detects deleted, inserted, or reordered records).
     * 3. Canonical payload hash recalculation (detects any modified data field).
     */
    @Transactional(readOnly = true)
    public AuditVerificationReport verifyChainIntegrity() {
        List<AuditLog> logs = auditLogRepository.findAllByOrderByIdAsc();
        if (logs.isEmpty()) {
            return AuditVerificationReport.success(0, AuditLog.GENESIS_HASH, AuditLog.GENESIS_HASH);
        }

        String genesisHash = logs.get(0).getPreviousHash();
        String expectedPrevHash = AuditLog.GENESIS_HASH;

        for (int i = 0; i < logs.size(); i++) {
            AuditLog current = logs.get(i);

            // 1. Verify previous hash link
            if (!current.getPreviousHash().equalsIgnoreCase(expectedPrevHash)) {
                String reason = String.format(
                        "Broken chain link at index %d (Record ID %d). Expected previous hash '%s' but found '%s'. Possible record deletion or reordering.",
                        i, current.getId(), expectedPrevHash, current.getPreviousHash());
                log.warn("AUDIT TAMPER ALERT: {}", reason);
                return AuditVerificationReport.failure(logs.size(), current.getId(), i, reason,
                        genesisHash, logs.get(logs.size() - 1).getCurrentHash());
            }

            // 2. Recompute hash from canonical payload to verify data immutability
            String canonicalPayload = current.toCanonicalPayload();
            String recalculatedHash = calculateSha256(canonicalPayload);

            if (!current.getCurrentHash().equalsIgnoreCase(recalculatedHash)) {
                String reason = String.format(
                        "Cryptographic hash mismatch at index %d (Record ID %d). Recorded hash '%s' does not match recalculated hash '%s'. Record content has been modified.",
                        i, current.getId(), current.getCurrentHash(), recalculatedHash);
                log.warn("AUDIT TAMPER ALERT: {}", reason);
                return AuditVerificationReport.failure(logs.size(), current.getId(), i, reason,
                        genesisHash, logs.get(logs.size() - 1).getCurrentHash());
            }

            // Advance expected previous hash for next record
            expectedPrevHash = current.getCurrentHash();
        }

        String latestHash = logs.get(logs.size() - 1).getCurrentHash();
        log.info("Audit chain verification complete: {} records verified successfully.", logs.size());
        return AuditVerificationReport.success(logs.size(), AuditLog.GENESIS_HASH, latestHash);
    }

    public Page<AuditLog> getAuditLogs(AuditAction action, AuditStatus status, String query, Pageable pageable) {
        return auditLogRepository.searchAuditLogs(action, status, query, pageable);
    }

    public List<AuditLog> getRecentLogs() {
        return auditLogRepository.findTop10ByOrderByTimestampDesc();
    }

    public long getTotalAuditCount() {
        return auditLogRepository.count();
    }

    public long getSecurityViolationsCount() {
        return auditLogRepository.countByStatus(AuditStatus.DENIED);
    }

    /**
     * Simulates database tampering by altering a record's data directly without updating hash.
     * For security testing and automated test suite verification.
     */
    @Transactional
    public void simulateTamperForTest(Long recordId, String tamperedDetails) {
        AuditLog log = auditLogRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("Audit record not found: " + recordId));
        log.setDetails(tamperedDetails);
        auditLogRepository.save(log);
    }

    /**
     * Simulates record deletion for test verification of broken chain detection.
     */
    @Transactional
    public void simulateDeletionForTest(Long recordId) {
        auditLogRepository.deleteById(recordId);
    }

    public static String calculateSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodedhash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available in JVM", e);
        }
    }
}
