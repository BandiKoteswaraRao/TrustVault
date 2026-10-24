package com.trustvault.controller;

import com.trustvault.dto.PasswordChangeDto;
import com.trustvault.dto.ProfileUpdateDto;
import com.trustvault.model.User;
import com.trustvault.repository.DocumentPermissionRepository;
import com.trustvault.repository.DocumentRepository;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/profile")
public class ProfileController {

    private final UserService userService;
    private final SecurityUtils securityUtils;
    private final DocumentRepository documentRepository;
    private final DocumentPermissionRepository permissionRepository;

    public ProfileController(UserService userService,
                             SecurityUtils securityUtils,
                             DocumentRepository documentRepository,
                             DocumentPermissionRepository permissionRepository) {
        this.userService = userService;
        this.securityUtils = securityUtils;
        this.documentRepository = documentRepository;
        this.permissionRepository = permissionRepository;
    }

    @GetMapping
    public String viewProfile(Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        // Refresh latest entity state from DB
        User user = userService.findById(currentUser.getId()).orElse(currentUser);

        long ownedDocsCount = documentRepository.countByOwner(user);
        long sharedDocsCount = permissionRepository.countByUser(user);

        model.addAttribute("user", user);
        model.addAttribute("profileDto", new ProfileUpdateDto(user.getFullName()));
        model.addAttribute("ownedDocsCount", ownedDocsCount);
        model.addAttribute("sharedDocsCount", sharedDocsCount);
        return "profile/index";
    }

    @PostMapping
    public String updateProfile(@Valid @ModelAttribute("profileDto") ProfileUpdateDto profileDto,
                                BindingResult bindingResult,
                                HttpServletRequest request,
                                RedirectAttributes redirectAttributes,
                                Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();

        if (bindingResult.hasErrors()) {
            User user = userService.findById(currentUser.getId()).orElse(currentUser);
            model.addAttribute("user", user);
            model.addAttribute("ownedDocsCount", documentRepository.countByOwner(user));
            model.addAttribute("sharedDocsCount", permissionRepository.countByUser(user));
            return "profile/index";
        }

        try {
            String clientIp = SecurityUtils.getClientIp(request);
            userService.updateProfile(currentUser, profileDto, clientIp);
            redirectAttributes.addFlashAttribute("successMessage", "Profile information updated successfully!");
        } catch (IllegalArgumentException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }

        return "redirect:/profile";
    }

    @GetMapping("/password")
    public String passwordPage(Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        model.addAttribute("user", currentUser);
        if (!model.containsAttribute("passwordDto")) {
            model.addAttribute("passwordDto", new PasswordChangeDto());
        }
        return "profile/password";
    }

    @PostMapping("/password")
    public String handlePasswordChange(@Valid @ModelAttribute("passwordDto") PasswordChangeDto passwordDto,
                                       BindingResult bindingResult,
                                       HttpServletRequest request,
                                       RedirectAttributes redirectAttributes,
                                       Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();

        if (bindingResult.hasErrors()) {
            model.addAttribute("user", currentUser);
            return "profile/password";
        }

        try {
            String clientIp = SecurityUtils.getClientIp(request);
            userService.changePassword(currentUser, passwordDto, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Password changed successfully! Next time you sign in, please use your new password.");
            return "redirect:/profile";
        } catch (IllegalArgumentException e) {
            bindingResult.rejectValue("currentPassword", "error.passwordDto", e.getMessage());
            model.addAttribute("user", currentUser);
            return "profile/password";
        }
    }
}
