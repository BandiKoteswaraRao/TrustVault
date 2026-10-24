package com.trustvault.service;

import com.trustvault.dto.DocumentEditDto;
import com.trustvault.dto.DocumentUploadDto;
import com.trustvault.model.*;
import com.trustvault.repository.DocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documentRepository;
    private final StorageService storageService;
    private final PermissionService permissionService;
    private final AuditService auditService;

    public DocumentService(DocumentRepository documentRepository,
                           StorageService storageService,
                           PermissionService permissionService,
                           AuditService auditService) {
        this.documentRepository = documentRepository;
        this.storageService = storageService;
        this.permissionService = permissionService;
        this.auditService = auditService;
    }

    @Transactional
    public Document uploadDocument(DocumentUploadDto dto, User owner, String clientIp) throws IOException {
        StorageService.StoredFileInfo fileInfo = storageService.storeFile(dto.getFile());

        Document document = new Document();
        document.setTitle(dto.getTitle());
        document.setDescription(dto.getDescription());
        document.setCategory(dto.getCategory() != null && !dto.getCategory().isBlank() ? dto.getCategory() : "General");
        document.setOriginalFileName(fileInfo.originalFilename());
        document.setStoredFileName(fileInfo.storedFilename());
        document.setFileSize(fileInfo.size());
        document.setContentType(fileInfo.contentType());
        document.setFileHash(fileInfo.sha256Hash());
        document.setOwner(owner);

        Document saved = documentRepository.save(document);

        auditService.recordEvent(
                owner.getUsername(),
                owner.getRole().name(),
                AuditAction.DOCUMENT_UPLOAD,
                "DOCUMENT",
                saved.getId().toString(),
                String.format("Uploaded document '%s' (%s, %d bytes, SHA-256: %s)",
                        saved.getTitle(), saved.getOriginalFileName(), saved.getFileSize(), saved.getFileHash()),
                AuditStatus.SUCCESS,
                clientIp
        );

        log.info("Document uploaded: id={}, title='{}', owner={}", saved.getId(), saved.getTitle(), owner.getUsername());
        return saved;
    }

    @Transactional(readOnly = true)
    public Document getDocumentForViewing(Long documentId, User user, String clientIp) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found with ID: " + documentId));

        if (!permissionService.canRead(document, user)) {
            auditService.recordEvent(
                    user != null ? user.getUsername() : "anonymousUser",
                    user != null ? user.getRole().name() : "ROLE_ANONYMOUS",
                    AuditAction.ACCESS_DENIED,
                    "DOCUMENT",
                    documentId.toString(),
                    String.format("IDOR block: Unauthorized attempt to view metadata of document '%s' (ID %d)",
                            document.getTitle(), documentId),
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new SecurityException("You are not authorized to view this document.");
        }

        auditService.recordEvent(
                user.getUsername(),
                user.getRole().name(),
                AuditAction.DOCUMENT_VIEW,
                "DOCUMENT",
                documentId.toString(),
                "Viewed details of document '" + document.getTitle() + "'",
                AuditStatus.SUCCESS,
                clientIp
        );

        return document;
    }

    public record DownloadableDocument(Resource resource, String originalFilename, String contentType, long fileSize) {}

    @Transactional(readOnly = true)
    public DownloadableDocument getDocumentForDownload(Long documentId, User user, String clientIp) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found with ID: " + documentId));

        if (!permissionService.canRead(document, user)) {
            auditService.recordEvent(
                    user != null ? user.getUsername() : "anonymousUser",
                    user != null ? user.getRole().name() : "ROLE_ANONYMOUS",
                    AuditAction.ACCESS_DENIED,
                    "DOCUMENT",
                    documentId.toString(),
                    String.format("IDOR block: Unauthorized attempt to download document '%s' (ID %d)",
                            document.getTitle(), documentId),
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new SecurityException("You are not authorized to download this document.");
        }

        Resource resource = storageService.loadAsResource(document.getStoredFileName());

        auditService.recordEvent(
                user.getUsername(),
                user.getRole().name(),
                AuditAction.DOCUMENT_DOWNLOAD,
                "DOCUMENT",
                documentId.toString(),
                String.format("Downloaded document '%s' (original filename: '%s')",
                        document.getTitle(), document.getOriginalFileName()),
                AuditStatus.SUCCESS,
                clientIp
        );

        return new DownloadableDocument(resource, document.getOriginalFileName(),
                document.getContentType(), document.getFileSize());
    }

    @Transactional
    public Document editDocument(DocumentEditDto dto, User user, String clientIp) throws IOException {
        Document document = documentRepository.findById(dto.getId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found with ID: " + dto.getId()));

        if (!permissionService.canEdit(document, user)) {
            auditService.recordEvent(
                    user != null ? user.getUsername() : "anonymousUser",
                    user != null ? user.getRole().name() : "ROLE_ANONYMOUS",
                    AuditAction.ACCESS_DENIED,
                    "DOCUMENT",
                    dto.getId().toString(),
                    String.format("IDOR block: Unauthorized attempt to edit document '%s' (ID %d)",
                            document.getTitle(), dto.getId()),
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new SecurityException("You are not authorized to edit this document.");
        }

        document.setTitle(dto.getTitle());
        document.setDescription(dto.getDescription());
        if (dto.getCategory() != null && !dto.getCategory().isBlank()) {
            document.setCategory(dto.getCategory());
        }

        boolean replacedFile = false;
        if (dto.getReplacementFile() != null && !dto.getReplacementFile().isEmpty()) {
            String oldStoredFilename = document.getStoredFileName();
            StorageService.StoredFileInfo newFileInfo = storageService.storeFile(dto.getReplacementFile());

            document.setOriginalFileName(newFileInfo.originalFilename());
            document.setStoredFileName(newFileInfo.storedFilename());
            document.setFileSize(newFileInfo.size());
            document.setContentType(newFileInfo.contentType());
            document.setFileHash(newFileInfo.sha256Hash());
            replacedFile = true;

            // Delete old physical file
            storageService.deleteFile(oldStoredFilename);
        }

        Document updated = documentRepository.save(document);

        auditService.recordEvent(
                user.getUsername(),
                user.getRole().name(),
                AuditAction.DOCUMENT_EDIT,
                "DOCUMENT",
                updated.getId().toString(),
                String.format("Updated document '%s' (content replacement: %b)", updated.getTitle(), replacedFile),
                AuditStatus.SUCCESS,
                clientIp
        );

        return updated;
    }

    @Transactional
    public void deleteDocument(Long documentId, User user, String clientIp) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found with ID: " + documentId));

        if (!permissionService.canDelete(document, user)) {
            auditService.recordEvent(
                    user != null ? user.getUsername() : "anonymousUser",
                    user != null ? user.getRole().name() : "ROLE_ANONYMOUS",
                    AuditAction.ACCESS_DENIED,
                    "DOCUMENT",
                    documentId.toString(),
                    String.format("IDOR block: Unauthorized attempt to delete document '%s' (ID %d)",
                            document.getTitle(), documentId),
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new SecurityException("You are not authorized to delete this document.");
        }

        String storedFilename = document.getStoredFileName();
        String docTitle = document.getTitle();

        documentRepository.delete(document);
        storageService.deleteFile(storedFilename);

        auditService.recordEvent(
                user.getUsername(),
                user.getRole().name(),
                AuditAction.DOCUMENT_DELETE,
                "DOCUMENT",
                documentId.toString(),
                String.format("Deleted document '%s' (ID %d)", docTitle, documentId),
                AuditStatus.SUCCESS,
                clientIp
        );

        log.info("Deleted document: id={}, title='{}', by={}", documentId, docTitle, user.getUsername());
    }

    @Transactional(readOnly = true)
    public List<Document> getAccessibleDocuments(User user, String category, String query) {
        if (user.getRole() == Role.ROLE_ADMIN) {
            return documentRepository.searchAll(category, query);
        }
        return documentRepository.searchAccessibleByUser(user, category, query);
    }

    public Optional<Document> findById(Long id) {
        return documentRepository.findById(id);
    }

    public long getTotalDocumentCount() {
        return documentRepository.count();
    }
}
