package com.trustvault.controller;

import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.security.SecurityUtils;
import com.trustvault.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;

@Controller
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final UserService userService;
    private final SecurityUtils securityUtils;

    public AdminUserController(UserService userService, SecurityUtils securityUtils) {
        this.userService = userService;
        this.securityUtils = securityUtils;
    }

    @GetMapping
    public String listUsers(Model model) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        List<User> users = userService.findAllUsers();

        model.addAttribute("users", users);
        model.addAttribute("roles", Role.values());
        model.addAttribute("currentUser", currentUser);
        return "admin/users";
    }

    @PostMapping("/{id}/toggle-status")
    public String toggleStatus(@PathVariable Long id,
                               HttpServletRequest request,
                               RedirectAttributes redirectAttributes) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        try {
            User updated = userService.toggleUserStatus(id, currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    String.format("Account for %s is now %s.", updated.getEmail(), updated.isEnabled() ? "Active" : "Disabled"));
        } catch (IllegalArgumentException | SecurityException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }

        return "redirect:/admin/users";
    }

    @PostMapping("/{id}/role")
    public String changeRole(@PathVariable Long id,
                             @RequestParam Role role,
                             HttpServletRequest request,
                             RedirectAttributes redirectAttributes) {
        User currentUser = securityUtils.getCurrentUser().orElseThrow();
        String clientIp = SecurityUtils.getClientIp(request);

        try {
            User updated = userService.changeUserRole(id, role, currentUser, clientIp);
            redirectAttributes.addFlashAttribute("successMessage",
                    String.format("Role for %s updated to %s successfully.", updated.getEmail(), updated.getRole().name()));
        } catch (IllegalArgumentException | SecurityException e) {
            redirectAttributes.addFlashAttribute("errorMessage", e.getMessage());
        }

        return "redirect:/admin/users";
    }
}
