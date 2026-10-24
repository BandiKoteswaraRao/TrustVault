package com.trustvault.controller;

import com.trustvault.dto.AuditVerificationReport;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditLog;
import com.trustvault.model.AuditStatus;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/audit")
@PreAuthorize("hasRole('ADMIN')")
public class AuditController {

    private final AuditService auditService;
    private final SecurityUtils securityUtils;

    public AuditController(AuditService auditService, SecurityUtils securityUtils) {
        this.auditService = auditService;
        this.securityUtils = securityUtils;
    }

    @GetMapping
    public String listAuditLogs(@RequestParam(required = false) AuditAction action,
                                @RequestParam(required = false) AuditStatus status,
                                @RequestParam(required = false) String query,
                                @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "15") int size,
                                Model model) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(50, Math.max(5, size)));
        Page<AuditLog> auditPage = auditService.getAuditLogs(action, status, query, pageable);

        User currentUser = securityUtils.getCurrentUser().orElseThrow();

        // Run chain verification for header status banner
        AuditVerificationReport report = auditService.verifyChainIntegrity();

        model.addAttribute("auditPage", auditPage);
        model.addAttribute("selectedAction", action);
        model.addAttribute("selectedStatus", status);
        model.addAttribute("query", query);
        model.addAttribute("actions", AuditAction.values());
        model.addAttribute("statuses", AuditStatus.values());
        model.addAttribute("chainReport", report);
        model.addAttribute("currentUser", currentUser);

        return "audit/list";
    }

    @PostMapping("/verify")
    public String verifyChain(HttpServletRequest request, RedirectAttributes redirectAttributes) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        AuditVerificationReport report = auditService.verifyChainIntegrity();

        auditService.recordEvent(
                currentUser.getUsername(),
                currentUser.getRole().name(),
                AuditAction.AUDIT_VERIFIED,
                "AUDIT_CHAIN",
                "CHAIN_ROOT",
                String.format("Cryptographic chain verification executed: valid=%b, total=%d records",
                        report.isValid(), report.getTotalRecords()),
                report.isValid() ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
                clientIp
        );

        if (report.isValid()) {
            redirectAttributes.addFlashAttribute("verificationSuccess",
                    String.format("Audit Chain Integrity Verified! All %d cryptographic hash links match and canonical data signatures are authentic.",
                            report.getTotalRecords()));
        } else {
            redirectAttributes.addFlashAttribute("verificationFailure",
                    String.format("TAMPERING DETECTED at Record ID %d (Chain index %d): %s",
                            report.getFailedAtRecordId(), report.getFailedAtIndex(), report.getFailureReason()));
        }

        return "redirect:/audit";
    }

    @PostMapping("/simulate-tamper")
    public String simulateTamper(RedirectAttributes redirectAttributes) {
        Long id = auditService.simulateTamperLatest();
        if (id != null) {
            redirectAttributes.addFlashAttribute("errorMessage",
                    "⚠️ Tamper Simulation Executed: Record #" + id + " details were directly altered in the database table! The SHA-256 hash was NOT updated. Click 'Verify Full Chain Integrity' now to observe the cryptographic breach detection!");
        }
        return "redirect:/audit";
    }

    @PostMapping("/repair-chain")
    public String repairChain(RedirectAttributes redirectAttributes) {
        auditService.recalculateAndRepairChain();
        redirectAttributes.addFlashAttribute("successMessage",
                "🛡️ Cryptographic audit chain successfully re-calculated and re-sealed! All blocks are now cryptographically valid.");
        return "redirect:/audit";
    }

    @GetMapping("/verify-json")
    @ResponseBody
    public AuditVerificationReport verifyChainJson() {
        return auditService.verifyChainIntegrity();
    }
}
