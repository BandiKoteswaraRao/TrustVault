package com.trustvault.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_actor", columnList = "actorUsername"),
    @Index(name = "idx_audit_action", columnList = "action"),
    @Index(name = "idx_audit_timestamp", columnList = "timestamp")
})
public class AuditLog {

    public static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
    public static final DateTimeFormatter CANONICAL_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false, length = 100)
    private String actorUsername;

    @Column(nullable = false, length = 30)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AuditAction action;

    @Column(length = 50)
    private String targetType;

    @Column(length = 100)
    private String targetId;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuditStatus status;

    @Column(length = 45)
    private String ipAddress;

    @Column(nullable = false, length = 64)
    private String previousHash;

    @Column(nullable = false, length = 64)
    private String currentHash;

    public AuditLog() {
    }

    public AuditLog(LocalDateTime timestamp, String actorUsername, String actorRole,
                    AuditAction action, String targetType, String targetId,
                    String details, AuditStatus status, String ipAddress,
                    String previousHash, String currentHash) {
        this.timestamp = timestamp;
        this.actorUsername = actorUsername;
        this.actorRole = actorRole;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.details = details;
        this.status = status;
        this.ipAddress = ipAddress;
        this.previousHash = previousHash;
        this.currentHash = currentHash;
    }

    /**
     * Builds the deterministic canonical string representation used for SHA-256 hash chaining.
     * Note: ID is excluded or normalized, or timestamp is ISO formatted so hashing is 100% reproducible.
     */
    public String toCanonicalPayload() {
        return String.join("|",
                timestamp != null ? timestamp.format(CANONICAL_TIMESTAMP_FORMATTER) : "",
                actorUsername != null ? actorUsername : "",
                actorRole != null ? actorRole : "",
                action != null ? action.name() : "",
                targetType != null ? targetType : "",
                targetId != null ? targetId : "",
                details != null ? details : "",
                status != null ? status.name() : "",
                ipAddress != null ? ipAddress : "",
                previousHash != null ? previousHash : GENESIS_HASH
        );
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getActorUsername() {
        return actorUsername;
    }

    public void setActorUsername(String actorUsername) {
        this.actorUsername = actorUsername;
    }

    public String getActorRole() {
        return actorRole;
    }

    public void setActorRole(String actorRole) {
        this.actorRole = actorRole;
    }

    public AuditAction getAction() {
        return action;
    }

    public void setAction(AuditAction action) {
        this.action = action;
    }

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public AuditStatus getStatus() {
        return status;
    }

    public void setStatus(AuditStatus status) {
        this.status = status;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getPreviousHash() {
        return previousHash;
    }

    public void setPreviousHash(String previousHash) {
        this.previousHash = previousHash;
    }

    public String getCurrentHash() {
        return currentHash;
    }

    public void setCurrentHash(String currentHash) {
        this.currentHash = currentHash;
    }
}
