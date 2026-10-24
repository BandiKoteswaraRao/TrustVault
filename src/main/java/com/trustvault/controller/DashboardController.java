package com.trustvault.controller;

import com.trustvault.dto.AuditVerificationReport;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.AuditService;
import com.trustvault.service.DocumentService;
import com.trustvault.service.UserService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    private final SecurityUtils securityUtils;
    private final DocumentService documentService;
    private final UserService userService;
    private final AuditService auditService;

    public DashboardController(SecurityUtils securityUtils,
                               DocumentService documentService,
                               UserService userService,
                               AuditService auditService) {
        this.securityUtils = securityUtils;
        this.documentService = documentService;
        this.userService = userService;
        this.auditService = auditService;
    }

    @GetMapping("/")
    public String root() {
        if (securityUtils.getCurrentUser().isPresent()) {
            return "redirect:/dashboard";
        }
        return "redirect:/login";
    }

    @GetMapping("/dashboard")
    public String dashboard(Model model) {
        User currentUser = securityUtils.getCurrentUser()
                .orElseThrow(() -> new IllegalStateException("Unauthenticated user accessing dashboard"));

        model.addAttribute("currentUser", currentUser);

        // Common metrics
        var accessibleDocs = documentService.getAccessibleDocuments(currentUser, null, null);
        model.addAttribute("accessibleDocs", accessibleDocs);
        model.addAttribute("accessibleDocsCount", accessibleDocs.size());

        if (currentUser.getRole() == Role.ROLE_ADMIN) {
            model.addAttribute("totalUsers", userService.getTotalUserCount());
            model.addAttribute("totalDocuments", documentService.getTotalDocumentCount());
            model.addAttribute("totalAudits", auditService.getTotalAuditCount());
            model.addAttribute("securityViolations", auditService.getSecurityViolationsCount());
            model.addAttribute("recentLogs", auditService.getRecentLogs());

            // Real-time audit chain verification check
            AuditVerificationReport report = auditService.verifyChainIntegrity();
            model.addAttribute("chainReport", report);
        }

        return "dashboard/index";
    }
}
