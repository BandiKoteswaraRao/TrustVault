package com.trustvault.service;

import org.apache.commons.io.FilenameUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "docx", "doc", "xlsx", "xls", "pptx", "txt", "csv", "png", "jpg", "jpeg", "zip"
    );

    private static final Set<String> DANGEROUS_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "sh", "jsp", "jspx", "war", "ear", "jar", "php", "py", "js", "vbs", "scr", "dll", "com", "ps1"
    );

    private final Path storageLocation;
    private final long maxFileSize;

    public StorageService(
            @Value("${trustvault.storage.upload-dir:storage/uploads}") String uploadDir,
            @Value("${trustvault.storage.max-file-size:10485760}") long maxFileSize) {
        this.storageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.maxFileSize = maxFileSize;
        try {
            Files.createDirectories(this.storageLocation);
            log.info("Initialized secure document storage at: {}", this.storageLocation);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize document storage folder at: " + this.storageLocation, e);
        }
    }

    public record StoredFileInfo(String originalFilename, String storedFilename, long size, String contentType, String sha256Hash) {}

    /**
     * Validates and saves an uploaded file to private storage.
     * Prevents path traversal, executable uploads, and computes content SHA-256.
     */
    public StoredFileInfo storeFile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload an empty file");
        }

        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException(String.format("File size (%d bytes) exceeds maximum limit of %d bytes (10MB)",
                    file.getSize(), maxFileSize));
        }

        String rawFilename = file.getOriginalFilename();
        if (rawFilename == null || rawFilename.isBlank()) {
            throw new IllegalArgumentException("Uploaded file must have a valid filename");
        }

        // Sanitize filename to prevent directory traversal
        String sanitizedFilename = FilenameUtils.getName(rawFilename);
        if (sanitizedFilename.contains("..") || sanitizedFilename.contains("/") || sanitizedFilename.contains("\\") || sanitizedFilename.contains("\0")) {
            throw new SecurityException("Potential path traversal sequence detected in filename: " + rawFilename);
        }

        String extension = FilenameUtils.getExtension(sanitizedFilename).toLowerCase(Locale.ROOT);
        if (extension.isBlank() || DANGEROUS_EXTENSIONS.contains(extension) || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new SecurityException("Disallowed file type '." + extension + "'. Allowed types: " + ALLOWED_EXTENSIONS);
        }

        // Generate safe randomized UUID file name on disk
        String storedFilename = UUID.randomUUID().toString() + "." + extension;
        Path destination = this.storageLocation.resolve(storedFilename).normalize();

        // Safety check to ensure path stays strictly inside storage folder
        if (!destination.startsWith(this.storageLocation)) {
            throw new SecurityException("Path traversal attempt detected. Storage target is outside root directory.");
        }

        // Calculate SHA-256 while streaming to disk
        String fileHash;
        try (InputStream inputStream = file.getInputStream()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            fileHash = HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 digest unavailable", e);
        }

        // Save file to destination
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destination, StandardCopyOption.REPLACE_EXISTING);
        }

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        log.info("Securely stored file: original='{}', stored='{}', size={} bytes, hash={}",
                sanitizedFilename, storedFilename, file.getSize(), fileHash);

        return new StoredFileInfo(sanitizedFilename, storedFilename, file.getSize(), contentType, fileHash);
    }

    /**
     * Loads a file as a Resource for secure download.
     */
    public Resource loadAsResource(String storedFilename) {
        try {
            String sanitized = FilenameUtils.getName(storedFilename);
            Path filePath = this.storageLocation.resolve(sanitized).normalize();
            if (!filePath.startsWith(this.storageLocation)) {
                throw new SecurityException("Invalid file path resolution");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new IllegalArgumentException("File not found or unreadable on disk: " + storedFilename);
            }
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Malformed file URI for: " + storedFilename, e);
        }
    }

    /**
     * Deletes a file from disk.
     */
    public void deleteFile(String storedFilename) {
        try {
            String sanitized = FilenameUtils.getName(storedFilename);
            Path filePath = this.storageLocation.resolve(sanitized).normalize();
            if (filePath.startsWith(this.storageLocation)) {
                Files.deleteIfExists(filePath);
                log.info("Deleted physical file: {}", storedFilename);
            }
        } catch (IOException e) {
            log.error("Failed to delete file from disk: {}", storedFilename, e);
        }
    }

    public Path getStorageLocation() {
        return storageLocation;
    }
}
