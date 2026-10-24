package com.trustvault.service;

import com.trustvault.dto.PasswordChangeDto;
import com.trustvault.dto.ProfileUpdateDto;
import com.trustvault.dto.UserRegistrationDto;
import com.trustvault.model.AuditAction;
import com.trustvault.model.AuditStatus;
import com.trustvault.model.Role;
import com.trustvault.model.User;
import com.trustvault.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       AuditService auditService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional
    public User registerUser(UserRegistrationDto dto, String clientIp) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new IllegalArgumentException("An account with email " + dto.getEmail() + " already exists.");
        }
        if (userRepository.existsByUsername(dto.getUsername())) {
            throw new IllegalArgumentException("Username " + dto.getUsername() + " is already taken.");
        }

        Role assignedRole = dto.getRole() != null ? dto.getRole() : Role.ROLE_OWNER;
        // Never allow arbitrary self-registration as ADMIN
        if (assignedRole == Role.ROLE_ADMIN) {
            assignedRole = Role.ROLE_OWNER;
        }

        User user = new User();
        user.setFullName(dto.getFullName());
        user.setUsername(dto.getUsername().toLowerCase().trim());
        user.setEmail(dto.getEmail().toLowerCase().trim());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setRole(assignedRole);
        user.setEnabled(true);

        User saved = userRepository.save(user);

        auditService.recordEvent(
                saved.getUsername(),
                saved.getRole().name(),
                AuditAction.USER_REGISTER,
                "USER",
                saved.getId().toString(),
                "New user registered: " + saved.getEmail() + " (" + saved.getRole() + ")",
                AuditStatus.SUCCESS,
                clientIp
        );

        return saved;
    }

    @Transactional
    public User updateProfile(User user, ProfileUpdateDto dto, String clientIp) {
        User existing = userRepository.findById(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + user.getId()));

        String oldName = existing.getFullName();
        existing.setFullName(dto.getFullName().trim());
        User saved = userRepository.save(existing);

        auditService.recordEvent(
                saved.getUsername(),
                saved.getRole().name(),
                AuditAction.USER_UPDATE,
                "USER",
                saved.getId().toString(),
                String.format("Updated profile: full name changed from '%s' to '%s'", oldName, saved.getFullName()),
                AuditStatus.SUCCESS,
                clientIp
        );

        return saved;
    }

    @Transactional
    public void changePassword(User user, PasswordChangeDto dto, String clientIp) {
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new IllegalArgumentException("New password and confirmation password do not match.");
        }

        User existing = userRepository.findById(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + user.getId()));

        if (!passwordEncoder.matches(dto.getCurrentPassword(), existing.getPassword())) {
            auditService.recordEvent(
                    existing.getUsername(),
                    existing.getRole().name(),
                    AuditAction.ACCESS_DENIED,
                    "USER",
                    existing.getId().toString(),
                    "Failed password change attempt: Incorrect current password provided.",
                    AuditStatus.DENIED,
                    clientIp
            );
            throw new IllegalArgumentException("Current password provided is incorrect.");
        }

        if (passwordEncoder.matches(dto.getNewPassword(), existing.getPassword())) {
            throw new IllegalArgumentException("New password must be different from your existing password.");
        }

        existing.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(existing);

        auditService.recordEvent(
                existing.getUsername(),
                existing.getRole().name(),
                AuditAction.PASSWORD_CHANGE,
                "USER",
                existing.getId().toString(),
                "User successfully changed their password. Password re-hashed with BCrypt.",
                AuditStatus.SUCCESS,
                clientIp
        );
    }

    @Transactional
    public User toggleUserStatus(Long targetUserId, User adminUser, String clientIp) {
        if (adminUser.getRole() != Role.ROLE_ADMIN) {
            throw new SecurityException("Only administrators can toggle user status.");
        }

        if (adminUser.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("Administrators cannot disable their own account.");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found: " + targetUserId));

        boolean newStatus = !target.isEnabled();
        target.setEnabled(newStatus);
        User saved = userRepository.save(target);

        auditService.recordEvent(
                adminUser.getUsername(),
                adminUser.getRole().name(),
                AuditAction.USER_STATUS_CHANGE,
                "USER",
                target.getId().toString(),
                String.format("Administrator %s toggled status for %s to %s",
                        adminUser.getUsername(), target.getUsername(), newStatus ? "ENABLED" : "DISABLED"),
                AuditStatus.SUCCESS,
                clientIp
        );

        return saved;
    }

    @Transactional
    public User changeUserRole(Long targetUserId, Role newRole, User adminUser, String clientIp) {
        if (adminUser.getRole() != Role.ROLE_ADMIN) {
            throw new SecurityException("Only administrators can modify user roles.");
        }

        if (adminUser.getId().equals(targetUserId) && newRole != Role.ROLE_ADMIN) {
            throw new IllegalArgumentException("Administrators cannot remove their own admin privileges.");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found: " + targetUserId));

        Role oldRole = target.getRole();
        target.setRole(newRole);
        User saved = userRepository.save(target);

        auditService.recordEvent(
                adminUser.getUsername(),
                adminUser.getRole().name(),
                AuditAction.USER_ROLE_CHANGE,
                "USER",
                target.getId().toString(),
                String.format("Administrator %s changed role of %s from %s to %s",
                        adminUser.getUsername(), target.getUsername(), oldRole, newRole),
                AuditStatus.SUCCESS,
                clientIp
        );

        return saved;
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findByUsernameOrEmail(String identifier) {
        return userRepository.findByUsernameOrEmail(identifier, identifier);
    }

    public List<User> findAllUsers() {
        return userRepository.findAllByOrderByFullNameAsc();
    }

    public long getTotalUserCount() {
        return userRepository.count();
    }
}
