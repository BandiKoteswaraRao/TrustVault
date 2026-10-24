package com.trustvault.service;

import com.trustvault.dto.DocumentUploadDto;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.UserRepository;
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
public class DocumentServiceValidationTests {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private StorageService storageService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.trustvault.repository.DocumentRepository documentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User owner;

    @BeforeEach
    void setUp() {
        documentRepository.deleteAll();
        userRepository.deleteAll();
        owner = userRepository.save(new User("uploader@test.local", "uploader", "Uploader User",
                passwordEncoder.encode("Pass123!"), Role.ROLE_OWNER));
    }

    @Test
    @DisplayName("Upload Validation: Allowed document extensions are accepted and stored with SHA-256")
    void testAllowedExtensionsAccepted() throws IOException {
        String[] allowedFiles = {"report.pdf", "data.xlsx", "memo.docx", "notes.txt", "diagram.png"};

        for (String filename : allowedFiles) {
            MockMultipartFile file = new MockMultipartFile(
                    "file", filename, "application/octet-stream",
                    ("Content for " + filename).getBytes(StandardCharsets.UTF_8)
            );
            DocumentUploadDto dto = new DocumentUploadDto();
            dto.setTitle("Test " + filename);
            dto.setCategory("General");
            dto.setFile(file);

            var doc = documentService.uploadDocument(dto, owner, "127.0.0.1");
            assertThat(doc.getId()).isNotNull();
            assertThat(doc.getFileHash()).hasSize(64);
            assertThat(doc.getStoredFileName()).endsWith("." + filename.split("\\.")[1]);
        }
    }

    @Test
    @DisplayName("Upload Security: Executable and script extensions (.exe, .jsp, .sh, .bat) are blocked")
    void testExecutableExtensionsRejected() {
        String[] dangerousFiles = {"malware.exe", "backdoor.jsp", "shell.sh", "script.bat", "exploit.cmd", "agent.py"};

        for (String filename : dangerousFiles) {
            MockMultipartFile file = new MockMultipartFile(
                    "file", filename, "application/octet-stream",
                    "MALICIOUS PAYLOAD".getBytes(StandardCharsets.UTF_8)
            );
            DocumentUploadDto dto = new DocumentUploadDto();
            dto.setTitle("Dangerous File");
            dto.setCategory("General");
            dto.setFile(file);

            assertThatThrownBy(() -> documentService.uploadDocument(dto, owner, "127.0.0.1"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("Disallowed file type");
        }
    }

    @Test
    @DisplayName("Path Traversal Defense: Directory traversal sequences in filenames are strictly intercepted")
    void testPathTraversalFilenamesBlocked() {
        String[] traversalFiles = {
                "../../../../etc/passwd.pdf",
                "..\\..\\Windows\\System32\\calc.pdf",
                "folder/../../../secret.docx"
        };

        for (String filename : traversalFiles) {
            MockMultipartFile file = new MockMultipartFile(
                    "file", filename, "application/pdf",
                    "Traversal Attempt".getBytes(StandardCharsets.UTF_8)
            );
            DocumentUploadDto dto = new DocumentUploadDto();
            dto.setTitle("Traversal Test");
            dto.setCategory("General");
            dto.setFile(file);

            // FilenameUtils.getName() strips paths, or validation throws SecurityException
            // Ensure no file can ever escape the storage root directory
            try {
                var doc = documentService.uploadDocument(dto, owner, "127.0.0.1");
                assertThat(doc.getStoredFileName()).doesNotContain("..");
                assertThat(doc.getStoredFileName()).doesNotContain("/");
                assertThat(doc.getStoredFileName()).doesNotContain("\\");
            } catch (Exception e) {
                assertThat(e).isInstanceOf(SecurityException.class);
            }
        }
    }

    @Test
    @DisplayName("Upload Validation: Empty files are rejected")
    void testEmptyFileRejected() {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]
        );
        DocumentUploadDto dto = new DocumentUploadDto();
        dto.setTitle("Empty File");
        dto.setCategory("General");
        dto.setFile(emptyFile);

        assertThatThrownBy(() -> documentService.uploadDocument(dto, owner, "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }
}
