package com.trustvault.controller;

import com.trustvault.dto.DocumentEditDto;
import com.trustvault.dto.DocumentUploadDto;
import com.trustvault.dto.SharePermissionDto;
import com.trustvault.model.Document;
import com.trustvault.model.PermissionType;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.DocumentService;
import com.trustvault.service.PermissionService;
import com.trustvault.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Controller
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final PermissionService permissionService;
    private final UserService userService;
    private final SecurityUtils securityUtils;

    public DocumentController(DocumentService documentService,
                              PermissionService permissionService,
                              UserService userService,
                              SecurityUtils securityUtils) {
        this.documentService = documentService;
        this.permissionService = permissionService;
        this.userService = userService;
        this.securityUtils = securityUtils;
    }

    @GetMapping
    public String listDocuments(@RequestParam(required = false) String category,
                                @RequestParam(required = false) String query,
                                Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        List<Document> documents = documentService.getAccessibleDocuments(currentUser, category, query);

        model.addAttribute("documents", documents);
        model.addAttribute("selectedCategory", category);
        model.addAttribute("query", query);
        model.addAttribute("currentUser", currentUser);
        model.addAttribute("permissionService", permissionService);

        return "documents/list";
    }

    @GetMapping("/{id}")
    public String viewDocument(@PathVariable Long id,
                               HttpServletRequest request,
                               Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        Document document = documentService.getDocumentForViewing(id, currentUser, clientIp);
        var permissions = permissionService.getPermissionsForDocument(document);

        boolean canEdit = permissionService.canEdit(document, currentUser);
        boolean canDelete = permissionService.canDelete(document, currentUser);
        boolean canShare = permissionService.canManagePermissions(document, currentUser);

        model.addAttribute("document", document);
        model.addAttribute("permissions", permissions);
        model.addAttribute("canEdit", canEdit);
        model.addAttribute("canDelete", canDelete);
        model.addAttribute("canShare", canShare);
        model.addAttribute("currentUser", currentUser);

        return "documents/view";
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    @GetMapping("/upload")
    public String uploadPage(Model model) {
        if (!model.containsAttribute("uploadDto")) {
            model.addAttribute("uploadDto", new DocumentUploadDto());
        }
        return "documents/upload";
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    @PostMapping("/upload")
    public String handleUpload(@Valid @ModelAttribute("uploadDto") DocumentUploadDto uploadDto,
                               BindingResult bindingResult,
                               HttpServletRequest request,
                               RedirectAttributes redirectAttributes) {
        if (uploadDto.getFile() == null || uploadDto.getFile().isEmpty()) {
            bindingResult.rejectValue("file", "error.uploadDto", "Please select a valid document file to upload.");
        }

        if (bindingResult.hasErrors()) {
            return "documents/upload";
        }

        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        try {
            Document doc = documentService.uploadDocument(uploadDto, currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Document '" + doc.getTitle() + "' uploaded successfully into secure vault!");
            return "redirect:/documents/" + doc.getId();
        } catch (SecurityException | IllegalArgumentException e) {
            bindingResult.rejectValue("file", "error.uploadDto", e.getMessage());
            return "documents/upload";
        } catch (IOException e) {
            bindingResult.rejectValue("file", "error.uploadDto", "Storage failure: " + e.getMessage());
            return "documents/upload";
        }
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> downloadDocument(@PathVariable Long id,
                                                     HttpServletRequest request) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        DocumentService.DownloadableDocument downloadable =
                documentService.getDocumentForDownload(id, currentUser, clientIp);

        String encodedFilename = URLEncoder.encode(downloadable.originalFilename(), StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(downloadable.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"; filename*=UTF-8''" + encodedFilename)
                .body(downloadable.resource());
    }

    @GetMapping("/{id}/edit")
    public String editPage(@PathVariable Long id,
                           HttpServletRequest request,
                           Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        Document document = documentService.getDocumentForViewing(id, currentUser, clientIp);
        if (!permissionService.canEdit(document, currentUser)) {
            throw new SecurityException("You do not have permission to edit this document.");
        }

        DocumentEditDto editDto = new DocumentEditDto();
        editDto.setId(document.getId());
        editDto.setTitle(document.getTitle());
        editDto.setDescription(document.getDescription());
        editDto.setCategory(document.getCategory());

        model.addAttribute("editDto", editDto);
        model.addAttribute("document", document);
        model.addAttribute("currentUser", currentUser);
        return "documents/edit";
    }

    @PostMapping("/{id}/edit")
    public String handleEdit(@PathVariable Long id,
                             @Valid @ModelAttribute("editDto") DocumentEditDto editDto,
                             BindingResult bindingResult,
                             HttpServletRequest request,
                             RedirectAttributes redirectAttributes,
                             Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        if (bindingResult.hasErrors()) {
            Document document = documentService.getDocumentForViewing(id, currentUser, clientIp);
            model.addAttribute("document", document);
            return "documents/edit";
        }

        try {
            editDto.setId(id);
            Document updated = documentService.editDocument(editDto, currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Document '" + updated.getTitle() + "' updated successfully.");
            return "redirect:/documents/" + id;
        } catch (SecurityException | IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
            return "redirect:/documents/" + id + "/edit";
        } catch (IOException e) {
            redirectAttributes.addFlashAttribute("errorMessage", "File storage error: " + e.getMessage());
            return "redirect:/documents/" + id + "/edit";
        }
    }

    @PostMapping("/{id}/delete")
    public String handleDelete(@PathVariable Long id,
                               HttpServletRequest request,
                               RedirectAttributes redirectAttributes) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        try {
            documentService.deleteDocument(id, currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage", "Document deleted permanently.");
            return "redirect:/documents";
        } catch (SecurityException | IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
            return "redirect:/documents/" + id;
        }
    }

    @GetMapping("/{id}/share")
    public String sharePage(@PathVariable Long id,
                            HttpServletRequest request,
                            Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        Document document = documentService.getDocumentForViewing(id, currentUser, clientIp);
        if (!permissionService.canManagePermissions(document, currentUser)) {
            throw new SecurityException("You do not have permission to manage sharing for this document.");
        }

        var permissions = permissionService.getPermissionsForDocument(document);
        var allUsers = userService.findAllUsers().stream()
                .filter(u -> !u.getId().equals(document.getOwner().getId()))
                .toList();

        SharePermissionDto shareDto = new SharePermissionDto();
        shareDto.setDocumentId(document.getId());

        model.addAttribute("document", document);
        model.addAttribute("permissions", permissions);
        model.addAttribute("availableUsers", allUsers);
        model.addAttribute("shareDto", shareDto);
        model.addAttribute("currentUser", currentUser);

        return "documents/share";
    }

    @PostMapping("/{id}/share")
    public String handleShare(@PathVariable Long id,
                              @Valid @ModelAttribute("shareDto") SharePermissionDto shareDto,
                              BindingResult bindingResult,
                              HttpServletRequest request,
                              RedirectAttributes redirectAttributes) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        Document document = documentService.getDocumentForViewing(id, currentUser, clientIp);

        User targetUser = userService.findByUsernameOrEmail(shareDto.getUserEmailOrUsername())
                .orElse(null);

        if (targetUser == null) {
            redirectAttributes.addFlashAttribute("errorMessage",
                    "User '" + shareDto.getUserEmailOrUsername() + "' does not exist in TrustVault.");
            return "redirect:/documents/" + id + "/share";
        }

        try {
            permissionService.grantOrUpdatePermission(document, targetUser, shareDto.getPermissionType(), currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Successfully granted " + shareDto.getPermissionType() + " permission to " + targetUser.getEmail() + "!");
        } catch (SecurityException | IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }

        return "redirect:/documents/" + id + "/share";
    }

    @PostMapping("/{id}/revoke")
    public String handleRevoke(@PathVariable Long id,
                               @RequestParam Long userId,
                               HttpServletRequest request,
                               RedirectAttributes redirectAttributes) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        Document document = documentService.getDocumentForViewing(id, currentUser, clientIp);
        User targetUser = userService.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found: " + userId));

        try {
            permissionService.revokePermission(document, targetUser, currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Access permission for " + targetUser.getEmail() + " revoked immediately.");
        } catch (SecurityException | IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }

        return "redirect:/documents/" + id + "/share";
    }
}
