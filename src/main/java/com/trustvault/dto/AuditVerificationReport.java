package com.trustvault.dto;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class AuditVerificationReport {

    private boolean valid;
    private int totalRecords;
    private Long failedAtRecordId;
    private Integer failedAtIndex;
    private String failureReason;
    private String genesisHash;
    private String latestHash;
    private String verifiedAt;

    public AuditVerificationReport() {
        this.verifiedAt = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    public static AuditVerificationReport success(int totalRecords, String genesisHash, String latestHash) {
        AuditVerificationReport report = new AuditVerificationReport();
        report.setValid(true);
        report.setTotalRecords(totalRecords);
        report.setGenesisHash(genesisHash);
        report.setLatestHash(latestHash);
        report.setFailureReason("All cryptographic hash links and canonical data signatures verified successfully. Zero tampering detected.");
        return report;
    }

    public static AuditVerificationReport failure(int totalRecords, Long failedAtRecordId, Integer failedAtIndex,
                                                  String failureReason, String genesisHash, String latestHash) {
        AuditVerificationReport report = new AuditVerificationReport();
        report.setValid(false);
        report.setTotalRecords(totalRecords);
        report.setFailedAtRecordId(failedAtRecordId);
        report.setFailedAtIndex(failedAtIndex);
        report.setFailureReason(failureReason);
        report.setGenesisHash(genesisHash);
        report.setLatestHash(latestHash);
        return report;
    }

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public int getTotalRecords() {
        return totalRecords;
    }

    public void setTotalRecords(int totalRecords) {
        this.totalRecords = totalRecords;
    }

    public Long getFailedAtRecordId() {
        return failedAtRecordId;
    }

    public void setFailedAtRecordId(Long failedAtRecordId) {
        this.failedAtRecordId = failedAtRecordId;
    }

    public Integer getFailedAtIndex() {
        return failedAtIndex;
    }

    public void setFailedAtIndex(Integer failedAtIndex) {
        this.failedAtIndex = failedAtIndex;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public String getGenesisHash() {
        return genesisHash;
    }

    public void setGenesisHash(String genesisHash) {
        this.genesisHash = genesisHash;
    }

    public String getLatestHash() {
        return latestHash;
    }

    public void setLatestHash(String latestHash) {
        this.latestHash = latestHash;
    }

    public String getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(String verifiedAt) {
        this.verifiedAt = verifiedAt;
    }
}
