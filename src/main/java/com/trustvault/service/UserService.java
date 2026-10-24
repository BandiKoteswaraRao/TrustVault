package com.trustvault.service;

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
