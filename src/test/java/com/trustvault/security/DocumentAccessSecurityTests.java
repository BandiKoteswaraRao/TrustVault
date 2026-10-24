package com.trustvault.security;

import com.trustvault.dto.DocumentEditDto;
import com.trustvault.dto.DocumentUploadDto;
import com.trustvault.model.*;
import com.trustvault.repository.DocumentRepository;
import com.trustvault.repository.UserRepository;
import com.trustvault.service.AuditService;
import com.trustvault.service.DocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
public class DocumentAccessSecurityTests {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuditService auditService;

    private User aliceOwner;
    private User bobAttacker;
    private User adminUser;
    private Document confidentialDoc;

    @BeforeEach
    void setUp() throws IOException {
        documentRepository.deleteAll();
        userRepository.deleteAll();

        aliceOwner = userRepository.save(new User("alice@test.local", "alice", "Alice Owner",
                passwordEncoder.encode("Pass123!"), Role.ROLE_OWNER));

        bobAttacker = userRepository.save(new User("bob@test.local", "bob", "Bob Viewer",
                passwordEncoder.encode("Pass123!"), Role.ROLE_VIEWER));

        adminUser = userRepository.save(new User("admin@test.local", "admin", "Admin",
                passwordEncoder.encode("Pass123!"), Role.ROLE_ADMIN));

        MockMultipartFile file = new MockMultipartFile(
                "file", "confidential.pdf", "application/pdf",
                "CONFIDENTIAL CONTENT OF ALICE".getBytes(StandardCharsets.UTF_8)
        );
        DocumentUploadDto uploadDto = new DocumentUploadDto();
        uploadDto.setTitle("Alice Confidential File");
        uploadDto.setCategory("Confidential");
        uploadDto.setFile(file);

        confidentialDoc = documentService.uploadDocument(uploadDto, aliceOwner, "127.0.0.1");
    }

    @Test
    @DisplayName("IDOR Prevention: Bob cannot view Alice's unshared document metadata")
    void testBobCannotViewAlicesDocument() {
        long deniedAuditsBefore = auditService.getSecurityViolationsCount();

        assertThatThrownBy(() -> documentService.getDocumentForViewing(confidentialDoc.getId(), bobAttacker, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to view");

        // Verify ACCESS_DENIED was logged in the tamper-evident audit trail
        long deniedAuditsAfter = auditService.getSecurityViolationsCount();
        assertThat(deniedAuditsAfter).isGreaterThan(deniedAuditsBefore);
    }

    @Test
    @DisplayName("IDOR Prevention: Bob cannot download Alice's unshared document file")
    void testBobCannotDownloadAlicesDocument() {
        assertThatThrownBy(() -> documentService.getDocumentForDownload(confidentialDoc.getId(), bobAttacker, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to download");
    }

    @Test
    @DisplayName("IDOR Prevention: Bob cannot edit Alice's unshared document")
    void testBobCannotEditAlicesDocument() {
        DocumentEditDto editDto = new DocumentEditDto();
        editDto.setId(confidentialDoc.getId());
        editDto.setTitle("Hacked Title by Bob");
        editDto.setCategory("General");

        assertThatThrownBy(() -> documentService.editDocument(editDto, bobAttacker, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to edit");

        // Verify document title remained unchanged
        Document docInDb = documentRepository.findById(confidentialDoc.getId()).orElseThrow();
        assertThat(docInDb.getTitle()).isEqualTo("Alice Confidential File");
    }

    @Test
    @DisplayName("IDOR Prevention: Bob cannot delete Alice's unshared document")
    void testBobCannotDeleteAlicesDocument() {
        assertThatThrownBy(() -> documentService.deleteDocument(confidentialDoc.getId(), bobAttacker, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to delete");

        // Verify document still exists in DB
        assertThat(documentRepository.existsById(confidentialDoc.getId())).isTrue();
    }

    @Test
    @DisplayName("Admin Role Authorization: Administrator can view and download all documents")
    void testAdminCanAccessAnyDocument() {
        var viewedDoc = documentService.getDocumentForViewing(confidentialDoc.getId(), adminUser, "127.0.0.1");
        assertThat(viewedDoc.getTitle()).isEqualTo(confidentialDoc.getTitle());

        var downloadedDoc = documentService.getDocumentForDownload(confidentialDoc.getId(), adminUser, "127.0.0.1");
        assertThat(downloadedDoc.originalFilename()).isEqualTo("confidential.pdf");
    }
}
