package com.trustvault.service;

import org.apache.commons.io.FilenameUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
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
    private final String supabaseUrl;
    private final String supabaseKey;
    private final String supabaseBucket;
    private final boolean isSupabaseConfigured;

    public StorageService(
            @Value("${trustvault.storage.upload-dir:storage/uploads}") String uploadDir,
            @Value("${trustvault.storage.max-file-size:10485760}") long maxFileSize,
            @Value("${trustvault.supabase.url:}") String supabaseUrl,
            @Value("${trustvault.supabase.service-role-key:}") String supabaseKey,
            @Value("${trustvault.supabase.bucket:trustvault-documents}") String supabaseBucket) {
        this.storageLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.maxFileSize = maxFileSize;
        this.supabaseUrl = (supabaseUrl != null && !supabaseUrl.isBlank()) ? supabaseUrl.replaceAll("/+$", "") : "";
        this.supabaseKey = (supabaseKey != null && !supabaseKey.isBlank()) ? supabaseKey.trim() : "";
        this.supabaseBucket = (supabaseBucket != null && !supabaseBucket.isBlank()) ? supabaseBucket.trim() : "trustvault-documents";
        this.isSupabaseConfigured = !this.supabaseUrl.isBlank() && !this.supabaseKey.isBlank();

        try {
            Files.createDirectories(this.storageLocation);
            if (isSupabaseConfigured) {
                log.info("Initialized StorageService: Primary=Supabase Private Storage (bucket='{}', url='{}'), LocalCache='{}'",
                        this.supabaseBucket, this.supabaseUrl, this.storageLocation);
                ensureSupabaseBucketExists();
            } else {
                log.info("Initialized StorageService: Primary=Local Filesystem ('{}') [Supabase credentials not configured]",
                        this.storageLocation);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize local document storage folder at: " + this.storageLocation, e);
        }
    }

    public record StoredFileInfo(String originalFilename, String storedFilename, long size, String contentType, String sha256Hash) {}

    /**
     * Validates and saves an uploaded file to private storage.
     * Prevents path traversal, executable uploads, computes content SHA-256,
     * and uploads to Supabase Storage (with local cache fallback).
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

        // Generate safe randomized UUID file name
        String storedFilename = UUID.randomUUID().toString() + "." + extension;

        // Calculate SHA-256 digest and read bytes
        byte[] fileBytes = file.getBytes();
        String fileHash;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(fileBytes);
            fileHash = HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 digest unavailable", e);
        }

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

        // If Supabase Storage is configured, upload to private bucket
        if (isSupabaseConfigured) {
            uploadToSupabase(storedFilename, fileBytes, contentType);
        }

        // Always save copy to local cache directory for offline resilience
        Path destination = this.storageLocation.resolve(storedFilename).normalize();
        if (!destination.startsWith(this.storageLocation)) {
            throw new SecurityException("Path traversal attempt detected. Storage target is outside root directory.");
        }
        Files.write(destination, fileBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        log.info("Securely stored document: original='{}', stored='{}', size={} bytes, hash={}, supabase={}",
                sanitizedFilename, storedFilename, fileBytes.length, fileHash, isSupabaseConfigured);

        return new StoredFileInfo(sanitizedFilename, storedFilename, fileBytes.length, contentType, fileHash);
    }

    /**
     * Loads a file as a Resource for secure download with server-side authorization.
     */
    public Resource loadAsResource(String storedFilename) {
        String sanitized = FilenameUtils.getName(storedFilename);

        // 1. Try local storage first
        Path filePath = this.storageLocation.resolve(sanitized).normalize();
        if (filePath.startsWith(this.storageLocation) && Files.exists(filePath) && Files.isReadable(filePath)) {
            try {
                return new UrlResource(filePath.toUri());
            } catch (MalformedURLException e) {
                log.warn("Malformed URL for local file {}, falling back to Supabase if configured", sanitized);
            }
        }

        // 2. If not found locally and Supabase is configured, fetch from Supabase Storage
        if (isSupabaseConfigured) {
            byte[] remoteBytes = downloadFromSupabase(sanitized);
            if (remoteBytes != null && remoteBytes.length > 0) {
                // Cache locally for faster next access
                try {
                    Files.write(filePath, remoteBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                } catch (IOException ignored) {}
                return new ByteArrayResource(remoteBytes, sanitized);
            }
        }

        throw new IllegalArgumentException("File not found or unreadable: " + storedFilename);
    }

    /**
     * Deletes a file from both Supabase Storage and local cache.
     */
    public void deleteFile(String storedFilename) {
        String sanitized = FilenameUtils.getName(storedFilename);

        // Delete from Supabase Storage
        if (isSupabaseConfigured) {
            deleteFromSupabase(sanitized);
        }

        // Delete from local cache
        try {
            Path filePath = this.storageLocation.resolve(sanitized).normalize();
            if (filePath.startsWith(this.storageLocation)) {
                Files.deleteIfExists(filePath);
                log.info("Deleted physical file from local storage: {}", sanitized);
            }
        } catch (IOException e) {
            log.error("Failed to delete local file: {}", sanitized, e);
        }
    }

    private void ensureSupabaseBucketExists() {
        try {
            String checkUrl = String.format("%s/storage/v1/bucket/%s", supabaseUrl, supabaseBucket);
            HttpURLConnection conn = (HttpURLConnection) URI.create(checkUrl).toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            int status = conn.getResponseCode();
            if (status == 200) {
                log.info("Supabase private storage bucket '{}' verified.", supabaseBucket);
            } else if (status == 404) {
                log.info("Bucket '{}' not found on Supabase. Attempting auto-creation...", supabaseBucket);
                String createUrl = String.format("%s/storage/v1/bucket", supabaseUrl);
                HttpURLConnection createConn = (HttpURLConnection) URI.create(createUrl).toURL().openConnection();
                createConn.setRequestMethod("POST");
                createConn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
                createConn.setRequestProperty("apikey", supabaseKey);
                createConn.setRequestProperty("Content-Type", "application/json");
                createConn.setDoOutput(true);
                createConn.setConnectTimeout(8000);
                createConn.setReadTimeout(8000);

                String jsonBody = String.format("{\"id\":\"%s\",\"name\":\"%s\",\"public\":false}", supabaseBucket, supabaseBucket);
                try (OutputStream os = createConn.getOutputStream()) {
                    os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
                }

                int createStatus = createConn.getResponseCode();
                if (createStatus >= 200 && createStatus < 300) {
                    log.info("Successfully created private Supabase bucket '{}'.", supabaseBucket);
                } else {
                    log.warn("Supabase bucket creation returned status: {}", createStatus);
                }
            }
        } catch (Exception e) {
            log.warn("Could not verify or create Supabase bucket '{}': {}", supabaseBucket, e.getMessage());
        }
    }

    private void uploadToSupabase(String objectName, byte[] data, String contentType) throws IOException {
        try {
            String uploadUrl = String.format("%s/storage/v1/object/%s/%s", supabaseUrl, supabaseBucket, objectName);
            HttpURLConnection conn = (HttpURLConnection) URI.create(uploadUrl).toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setRequestProperty("Content-Type", contentType);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(data);
            }

            int status = conn.getResponseCode();
            if (status >= 200 && status < 300) {
                log.info("Uploaded object to Supabase Private Storage: {}", objectName);
            } else {
                throw new IOException(String.format("Supabase upload failed with HTTP status %d", status));
            }
        } catch (Exception e) {
            throw new IOException("Failed uploading to Supabase Storage: " + e.getMessage(), e);
        }
    }

    private byte[] downloadFromSupabase(String objectName) {
        try {
            String downloadUrl = String.format("%s/storage/v1/object/%s/%s", supabaseUrl, supabaseBucket, objectName);
            HttpURLConnection conn = (HttpURLConnection) URI.create(downloadUrl).toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);

            int status = conn.getResponseCode();
            if (status == 200) {
                try (InputStream is = conn.getInputStream()) {
                    return is.readAllBytes();
                }
            } else {
                log.warn("Supabase download returned HTTP {}: {}", status, objectName);
                return null;
            }
        } catch (Exception e) {
            log.error("Failed to download object from Supabase: {}", objectName, e);
            return null;
        }
    }

    private void deleteFromSupabase(String objectName) {
        try {
            String deleteUrl = String.format("%s/storage/v1/object/%s/%s", supabaseUrl, supabaseBucket, objectName);
            HttpURLConnection conn = (HttpURLConnection) URI.create(deleteUrl).toURL().openConnection();
            conn.setRequestMethod("DELETE");
            conn.setRequestProperty("Authorization", "Bearer " + supabaseKey);
            conn.setRequestProperty("apikey", supabaseKey);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);

            int status = conn.getResponseCode();
            log.info("Supabase delete response for {}: status {}", objectName, status);
        } catch (Exception e) {
            log.warn("Failed to delete object from Supabase: {}", objectName, e);
        }
    }

    public Path getStorageLocation() {
        return storageLocation;
    }

    public boolean isSupabaseConfigured() {
        return isSupabaseConfigured;
    }

    public String getSupabaseBucket() {
        return supabaseBucket;
    }
}
