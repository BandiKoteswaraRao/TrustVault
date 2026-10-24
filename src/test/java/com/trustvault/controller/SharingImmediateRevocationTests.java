package com.trustvault.controller;

import com.trustvault.dto.DocumentEditDto;
import com.trustvault.dto.DocumentUploadDto;
import com.trustvault.model.Document;
import com.trustvault.model.PermissionType;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.DocumentPermissionRepository;
import com.trustvault.repository.DocumentRepository;
import com.trustvault.repository.UserRepository;
import com.trustvault.service.DocumentService;
import com.trustvault.service.PermissionService;
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
public class SharingImmediateRevocationTests {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private PermissionService permissionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private DocumentPermissionRepository permissionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User aliceOwner;
    private User bobViewer;
    private Document testDoc;

    @BeforeEach
    void setUp() throws IOException {
        permissionRepository.deleteAll();
        documentRepository.deleteAll();
        userRepository.deleteAll();

        aliceOwner = userRepository.save(new User("alice@share.local", "alice", "Alice Owner",
                passwordEncoder.encode("Pass123!"), Role.ROLE_OWNER));

        bobViewer = userRepository.save(new User("bob@share.local", "bob", "Bob Viewer",
                passwordEncoder.encode("Pass123!"), Role.ROLE_VIEWER));

        MockMultipartFile file = new MockMultipartFile(
                "file", "board_meeting.pdf", "application/pdf",
                "Minutes of board meeting 2026".getBytes(StandardCharsets.UTF_8)
        );
        DocumentUploadDto dto = new DocumentUploadDto();
        dto.setTitle("Board Meeting Minutes");
        dto.setCategory("Confidential");
        dto.setFile(file);

        testDoc = documentService.uploadDocument(dto, aliceOwner, "127.0.0.1");
    }

    @Test
    @DisplayName("Smart Sharing: Owner grants READ -> Recipient can access immediately")
    void testGrantReadAllowsAccess() {
        // Initially Bob has no access
        assertThatThrownBy(() -> documentService.getDocumentForViewing(testDoc.getId(), bobViewer, "127.0.0.1"))
                .isInstanceOf(SecurityException.class);

        // Alice grants READ to Bob
        permissionService.grantOrUpdatePermission(testDoc, bobViewer, PermissionType.READ, aliceOwner, "127.0.0.1");

        // Bob can now view and download immediately
        Document viewed = documentService.getDocumentForViewing(testDoc.getId(), bobViewer, "127.0.0.1");
        assertThat(viewed.getTitle()).isEqualTo("Board Meeting Minutes");

        var download = documentService.getDocumentForDownload(testDoc.getId(), bobViewer, "127.0.0.1");
        assertThat(download.originalFilename()).isEqualTo("board_meeting.pdf");
    }

    @Test
    @DisplayName("Immediate Revocation: Revoking access blocks recipient on the next protected request")
    void testImmediateRevocationBlocksOnNextRequest() {
        // 1. Grant READ permission
        permissionService.grantOrUpdatePermission(testDoc, bobViewer, PermissionType.READ, aliceOwner, "127.0.0.1");

        // 2. Verify Bob can read
        Document viewed = documentService.getDocumentForViewing(testDoc.getId(), bobViewer, "127.0.0.1");
        assertThat(viewed).isNotNull();

        // 3. Alice immediately revokes Bob's permission
        permissionService.revokePermission(testDoc, bobViewer, aliceOwner, "127.0.0.1");

        // 4. Bob's very next request to view MUST throw SecurityException (immediate effect)
        assertThatThrownBy(() -> documentService.getDocumentForViewing(testDoc.getId(), bobViewer, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to view");

        // 5. Bob's very next request to download MUST throw SecurityException
        assertThatThrownBy(() -> documentService.getDocumentForDownload(testDoc.getId(), bobViewer, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to download");
    }

    @Test
    @DisplayName("Role Enforcement: READ permission grantee cannot edit or delete document")
    void testReadGranteeCannotEditOrDelete() {
        permissionService.grantOrUpdatePermission(testDoc, bobViewer, PermissionType.READ, aliceOwner, "127.0.0.1");

        // Attempting to edit must fail
        DocumentEditDto editDto = new DocumentEditDto();
        editDto.setId(testDoc.getId());
        editDto.setTitle("Illegal Edit by READ User");

        assertThatThrownBy(() -> documentService.editDocument(editDto, bobViewer, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to edit");

        // Attempting to delete must fail
        assertThatThrownBy(() -> documentService.deleteDocument(testDoc.getId(), bobViewer, "127.0.0.1"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("not authorized to delete");
    }

    @Test
    @DisplayName("Permission Upgrade: Upgrading to EDIT allows recipient to modify document")
    void testUpgradeToEditAllowsModification() throws IOException {
        // Upgrade Bob to EDIT
        permissionService.grantOrUpdatePermission(testDoc, bobViewer, PermissionType.EDIT, aliceOwner, "127.0.0.1");

        DocumentEditDto editDto = new DocumentEditDto();
        editDto.setId(testDoc.getId());
        editDto.setTitle("Updated Title by Bob (Authorized Editor)");
        editDto.setCategory("Confidential");

        Document updated = documentService.editDocument(editDto, bobViewer, "127.0.0.1");
        assertThat(updated.getTitle()).isEqualTo("Updated Title by Bob (Authorized Editor)");
    }
}
