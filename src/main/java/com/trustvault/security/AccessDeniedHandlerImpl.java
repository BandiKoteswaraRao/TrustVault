package com.trustvault.security;

import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditStatus;
import com.trustvault.service.AuditService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class AccessDeniedHandlerImpl implements AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(AccessDeniedHandlerImpl.class);
    private final AuditService auditService;

    public AccessDeniedHandlerImpl(AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException, ServletException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = (auth != null) ? auth.getName() : "anonymousUser";
        String role = (auth != null && !auth.getAuthorities().isEmpty()) ?
                auth.getAuthorities().iterator().next().getAuthority() : "ROLE_ANONYMOUS";
        String targetUri = request.getRequestURI();
        String clientIp = SecurityUtils.getClientIp(request);

        log.warn("Access Denied: user='{}', role='{}', uri='{}', ip='{}'", username, role, targetUri, clientIp);

        // Record security violation event into cryptographic audit trail
        auditService.recordEvent(
                username,
                role,
                AuditAction.ACCESS_DENIED,
                "ENDPOINT",
                targetUri,
                "Forbidden access attempt intercepted by Spring Security: " + accessDeniedException.getMessage(),
                AuditStatus.DENIED,
                clientIp
        );

        response.sendRedirect(request.getContextPath() + "/access-denied?uri=" + java.net.URLEncoder.encode(targetUri, java.nio.charset.StandardCharsets.UTF_8));
    }
}
