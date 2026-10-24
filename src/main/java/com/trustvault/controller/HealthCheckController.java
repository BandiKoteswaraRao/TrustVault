package com.trustvault.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthCheckController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "TrustVault",
                "tagline", "TrustVault — secure document sharing with a real audit trail",
                "version", "1.0.0",
                "security", "Zero-Trust RBAC & Cryptographic Audit Trail Active",
                "timestamp", Instant.now().toString()
        ));
    }
}
