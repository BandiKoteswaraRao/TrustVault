package com.trustvault.dto;

import com.trustvault.model.PermissionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class SharePermissionDto {

    @NotNull(message = "Document ID is required")
    private Long documentId;

    @NotBlank(message = "Recipient username or email is required")
    private String userEmailOrUsername;

    @NotNull(message = "Permission level is required")
    private PermissionType permissionType = PermissionType.READ;

    public SharePermissionDto() {
    }

    public SharePermissionDto(Long documentId, String userEmailOrUsername, PermissionType permissionType) {
        this.documentId = documentId;
        this.userEmailOrUsername = userEmailOrUsername;
        this.permissionType = permissionType;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public String getUserEmailOrUsername() {
        return userEmailOrUsername;
    }

    public void setUserEmailOrUsername(String userEmailOrUsername) {
        this.userEmailOrUsername = userEmailOrUsername;
    }

    public PermissionType getPermissionType() {
        return permissionType;
    }

    public void setPermissionType(PermissionType permissionType) {
        this.permissionType = permissionType;
    }
}
