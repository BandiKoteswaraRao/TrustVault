package com.trustvault.controller;

import com.trustvault.dto.PasswordChangeDto;
import com.trustvault.dto.ProfileUpdateDto;
import com.trustvault.model.AuditAction;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.AuditLogRepository;
import com.trustvault.repository.UserRepository;
import com.trustvault.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrlPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class UserManagementAndProfileSecurityTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User adminUser;
    private User normalUser;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        adminUser = userRepository.save(new User(
                "admin@vault.test", "admin_test", "Admin Tester",
                passwordEncoder.encode("AdminPass123!"), Role.ROLE_ADMIN
        ));

        normalUser = userRepository.save(new User(
                "user@vault.test", "user_test", "Normal Tester",
                passwordEncoder.encode("UserPass123!"), Role.ROLE_OWNER
        ));
    }

    @Test
    @DisplayName("Health Check: /health returns HTTP 200 UP for unauthenticated probe")
    void testHealthCheckEndpoint() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("TrustVault"));
    }

    @Test
    @DisplayName("Profile: User can update full name with audit trail event")
    void testUpdateProfile() {
        ProfileUpdateDto dto = new ProfileUpdateDto("Updated Tester Name");
        User updated = userService.updateProfile(normalUser, dto, "127.0.0.1");

        assertThat(updated.getFullName()).isEqualTo("Updated Tester Name");

        boolean auditRecorded = auditLogRepository.findAll().stream()
                .anyMatch(a -> a.getAction() == AuditAction.USER_UPDATE && a.getTargetId().equals(normalUser.getId().toString()));
        assertThat(auditRecorded).isTrue();
    }

    @Test
    @DisplayName("Password Change: Successful change with valid current password")
    void testSuccessfulPasswordChange() {
        PasswordChangeDto dto = new PasswordChangeDto();
        dto.setCurrentPassword("UserPass123!");
        dto.setNewPassword("BrandNewSecurePass2026!");
        dto.setConfirmPassword("BrandNewSecurePass2026!");

        userService.changePassword(normalUser, dto, "127.0.0.1");

        User reloaded = userRepository.findById(normalUser.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("BrandNewSecurePass2026!", reloaded.getPassword())).isTrue();

        boolean auditRecorded = auditLogRepository.findAll().stream()
                .anyMatch(a -> a.getAction() == AuditAction.PASSWORD_CHANGE && a.getTargetId().equals(normalUser.getId().toString()));
        assertThat(auditRecorded).isTrue();
    }

    @Test
    @DisplayName("Password Change: Rejected when current password is wrong")
    void testPasswordChangeFailsOnWrongCurrentPassword() {
        PasswordChangeDto dto = new PasswordChangeDto();
        dto.setCurrentPassword("IncorrectOldPassword!");
        dto.setNewPassword("BrandNewSecurePass2026!");
        dto.setConfirmPassword("BrandNewSecurePass2026!");

        assertThatThrownBy(() -> userService.changePassword(normalUser, dto, "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Current password provided is incorrect");
    }

    @Test
    @DisplayName("Password Change: Rejected when confirmation password mismatches")
    void testPasswordChangeFailsOnMismatch() {
        PasswordChangeDto dto = new PasswordChangeDto();
        dto.setCurrentPassword("UserPass123!");
        dto.setNewPassword("BrandNewSecurePass2026!");
        dto.setConfirmPassword("MismatchPass2026!");

        assertThatThrownBy(() -> userService.changePassword(normalUser, dto, "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("do not match");
    }

    @Test
    @DisplayName("Admin User Management: Admin can toggle account suspension")
    void testAdminToggleUserStatus() {
        assertThat(normalUser.isEnabled()).isTrue();

        User suspended = userService.toggleUserStatus(normalUser.getId(), adminUser, "127.0.0.1");
        assertThat(suspended.isEnabled()).isFalse();

        User reactivated = userService.toggleUserStatus(normalUser.getId(), adminUser, "127.0.0.1");
        assertThat(reactivated.isEnabled()).isTrue();
    }

    @Test
    @DisplayName("Admin User Management: Admin cannot suspend their own account")
    void testAdminCannotDisableSelf() {
        assertThatThrownBy(() -> userService.toggleUserStatus(adminUser.getId(), adminUser, "127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot disable their own account");
    }

    @Test
    @DisplayName("Admin User Management: Non-admin is blocked from toggling account status")
    void testNonAdminCannotToggleStatus() {
        assertThatThrownBy(() -> userService.toggleUserStatus(normalUser.getId(), normalUser, "127.0.0.1"))
                .isInstanceOf(SecurityException.class);
    }

    @Test
    @WithMockUser(username = "normal_user", roles = {"OWNER"})
    @DisplayName("Admin User Management Endpoint: Non-admin is blocked and redirected to access-denied")
    void testNonAdminBlockedFromAdminUsersPage() throws Exception {
        mockMvc.perform(get("/admin/users"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("/access-denied*"));
    }
}
