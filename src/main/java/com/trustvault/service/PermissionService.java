package com.trustvault.service;

import com.trustvault.model.*;
import com.trustvault.repository.DocumentPermissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class PermissionService {

    private static final Logger log = LoggerFactory.getLogger(PermissionService.class);

    private final DocumentPermissionRepository permissionRepository;
    private final AuditService auditService;

    public PermissionService(DocumentPermissionRepository permissionRepository,
                             AuditService auditService) {
        this.permissionRepository = permissionRepository;
        this.auditService = auditService;
    }

    public boolean canRead(Document document, User user) {
        if (user == null || document == null) {
            return false;
        }
        if (user.getRole() == Role.ROLE_ADMIN) {
            return true;
        }
        if (document.getOwner().getId().equals(user.getId())) {
            return true;
        }
        return permissionRepository.existsByDocumentAndUser(document, user);
    }

    public boolean canEdit(Document document, User user) {
        if (user == null || document == null) {
            return false;
        }
        if (user.getRole() == Role.ROLE_ADMIN) {
            return true;
        }
        if (document.getOwner().getId().equals(user.getId())) {
            return true;
        }
        return permissionRepository.existsByDocumentAndUserAndPermissionType(document, user, PermissionType.EDIT);
    }

    public boolean canDelete(Document document, User user) {
        if (user == null || document == null) {
            return false;
        }
        if (user.getRole() == Role.ROLE_ADMIN) {
            return true;
        }
        return document.getOwner().getId().equals(user.getId());
    }

    public boolean canManagePermissions(Document document, User user) {
        return canDelete(document, user);
    }

    @Transactional
    public DocumentPermission grantOrUpdatePermission(Document document, User targetUser, PermissionType permissionType,
                                                      User granter, String clientIp) {
        if (!canManagePermissions(document, granter)) {
            auditService.recordEvent(
                    granter.getUsername(),
                    granter.getRole().name(),
                    AuditAction.ACCESS_DENIED,
                    "DOCUMENT",
                    document.getId().toString(),
                    "Unauthorized attempt to grant permission on document: " + document.getTitle(),
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new SecurityException("You do not have authorization to share this document.");
        }

        if (document.getOwner().getId().equals(targetUser.getId())) {
            throw new IllegalArgumentException("The document owner already has full rights and cannot be granted custom permissions.");
        }

        Optional<DocumentPermission> existingOpt = permissionRepository.findByDocumentAndUser(document, targetUser);
        DocumentPermission permission;
        boolean isUpdate = existingOpt.isPresent();

        if (isUpdate) {
            permission = existingOpt.get();
            permission.setPermissionType(permissionType);
            permission.setGrantedBy(granter);
            permission.setGrantedAt(LocalDateTime.now());
        } else {
            permission = new DocumentPermission(document, targetUser, permissionType, granter);
        }

        DocumentPermission saved = permissionRepository.save(permission);

        auditService.recordEvent(
                granter.getUsername(),
                granter.getRole().name(),
                AuditAction.PERMISSION_GRANT,
                "PERMISSION",
                document.getId() + ":" + targetUser.getUsername(),
                String.format("Granted %s permission on document '%s' (ID %d) to user '%s'",
                        permissionType, document.getTitle(), document.getId(), targetUser.getUsername()),
                AuditStatus.SUCCESS,
                clientIp
        );

        log.info("Granted permission: docId={}, targetUser={}, type={}, granter={}",
                document.getId(), targetUser.getUsername(), permissionType, granter.getUsername());
        return saved;
    }

    @Transactional
    public void revokePermission(Document document, User targetUser, User revoker, String clientIp) {
        if (!canManagePermissions(document, revoker)) {
            auditService.recordEvent(
                    revoker.getUsername(),
                    revoker.getRole().name(),
                    AuditAction.ACCESS_DENIED,
                    "DOCUMENT",
                    document.getId().toString(),
                    "Unauthorized attempt to revoke permissions on document: " + document.getTitle(),
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new SecurityException("You do not have authorization to revoke permissions for this document.");
        }

        Optional<DocumentPermission> existing = permissionRepository.findByDocumentAndUser(document, targetUser);
        if (existing.isPresent()) {
            permissionRepository.deleteByDocumentAndUser(document, targetUser);

            auditService.recordEvent(
                    revoker.getUsername(),
                    revoker.getRole().name(),
                    AuditAction.PERMISSION_REVOKE,
                    "PERMISSION",
                    document.getId() + ":" + targetUser.getUsername(),
                    String.format("Revoked access permission on document '%s' (ID %d) for user '%s'",
                            document.getTitle(), document.getId(), targetUser.getUsername()),
                    AuditStatus.SUCCESS,
                    clientIp
            );

            log.info("Revoked permission: docId={}, targetUser={}, revoker={}",
                    document.getId(), targetUser.getUsername(), revoker.getUsername());
        }
    }

    public List<DocumentPermission> getPermissionsForDocument(Document document) {
        return permissionRepository.findByDocumentOrderByGrantedAtDesc(document);
    }
}
