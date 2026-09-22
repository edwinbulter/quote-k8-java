package com.quote.k8.service;

import com.quote.k8.dto.AdminUserInfo;
import com.quote.k8.dto.ChangePasswordRequest;
import com.quote.k8.dto.LoginRequest;
import com.quote.k8.dto.RegisterRequest;
import com.quote.k8.dto.RemoveUserAccountRequest;
import com.quote.k8.dto.UnregisterRequest;
import com.quote.k8.dto.UpdateRoleRequest;
import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserLikeRepository;
import com.quote.k8.repository.UserProgressRepository;
import com.quote.k8.repository.UserRepository;
import com.quote.k8.repository.UserRoleRepository;
import com.quote.k8.util.PasswordUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class AuthService {

    private static final Logger LOG = Logger.getLogger(AuthService.class);

    @Inject
    UserRepository userRepository;

    @Inject
    UserRoleRepository userRoleRepository;

    @Inject
    UserLikeRepository userLikeRepository;

    @Inject
    UserProgressRepository userProgressRepository;

    @Inject
    JwtService jwtService;

    public User register(RegisterRequest request) {
        // Validate password match
        if (!request.isPasswordMatch()) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        // Check if email already exists
        if (userRepository.existsByEmail(request.email)) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Check if username already exists
        if (userRepository.existsByUsername(request.username)) {
            throw new IllegalArgumentException("Username already exists");
        }

        // Create new user
        User user = new User(
            request.username,
            request.email,
            PasswordUtil.hashPassword(request.password)
        );
        userRepository.persist(user);
        LOG.info("User registered successfully: " + user.username);

        // Assign USER role by default
        UserRole userRole = new UserRole(user.username, "USER", "System");
        userRoleRepository.persist(userRole);
        LOG.info("USER role assigned to: " + user.username);

        return user;
    }

    public String login(LoginRequest request) {
        User user = null;

        // Try to find user by email first, then by username
        if (request.loginIdentifier.contains("@")) {
            user = userRepository.findByEmail(request.loginIdentifier)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
        } else {
            user = userRepository.findByUsername(request.loginIdentifier)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
        }

        // Verify password
        if (!PasswordUtil.verifyPassword(request.password, user.passwordHash)) {
            throw new IllegalArgumentException("Invalid password");
        }

        if (!user.isActive) {
            throw new IllegalArgumentException("User account is inactive");
        }

        // Generate JWT token
        String token = jwtService.generateToken(user);
        LOG.info("User logged in successfully: " + user.username);

        return token;
    }

    public List<AdminUserInfo> getAllUsers(String adminUsername) {
        LOG.info("Getting all users for admin: " + adminUsername);

        // Verify admin role
        if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
            throw new SecurityException("Only admins can list all users");
        }

        List<User> users = userRepository.findAllUsers();
        List<AdminUserInfo> userInfos = new ArrayList<>();

        for (User user : users) {
            // Get user roles
            List<UserRole> userRoles = userRoleRepository.findAllByUsername(user.username);
            List<String> roles = userRoles.stream()
                    .map(ur -> ur.role != null ? ur.role.toUpperCase() : "")
                    .filter(r -> !r.isEmpty())
                    .distinct()
                    .collect(Collectors.toList());

            // Default to USER role if no roles found
            if (roles.isEmpty()) {
                roles.add("USER");
            }

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");
            String createDate = user.createdAt != null ? user.createdAt.format(formatter) : null;
            String lastModifiedDate = user.updatedAt != null ? user.updatedAt.format(formatter) : null;

            AdminUserInfo userInfo = new AdminUserInfo(
                user.username,
                user.email,
                roles,
                user.isActive,
                user.isActive ? "ACTIVE" : "INACTIVE",
                createDate,
                lastModifiedDate
            );

            userInfos.add(userInfo);
        }

        LOG.info("Retrieved " + userInfos.size() + " users");
        return userInfos;
    }

    public boolean updateUserRole(String adminUsername, UpdateRoleRequest request) {
        LOG.info("Updating user role for: " + request.username + " to: " + request.role + " by admin: " + adminUsername);

        // Verify admin role
        if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
            throw new SecurityException("Only admins can update user roles");
        }

        // Find target user
        User targetUser = userRepository.findByUsername(request.username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.username));

        // Check if user already has this role
        String roleUpper = request.role.toUpperCase();
        if (userRoleRepository.userHasRole(targetUser.username, roleUpper)) {
            LOG.info("User " + targetUser.username + " already has role: " + roleUpper);
            return false;
        }

        // Create new role assignment (supports multiple roles per user)
        UserRole userRole = new UserRole(
            targetUser.username,
            roleUpper,
            adminUsername
        );
        userRoleRepository.persist(userRole);

        LOG.info("User role updated successfully: " + targetUser.username + " -> " + roleUpper);
        return true;
    }

    public boolean removeUserRole(String adminUsername, UpdateRoleRequest request) {
        LOG.info("Removing user role for: " + request.username + " role: " + request.role + " by admin: " + adminUsername);

        // Verify admin role
        if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
            throw new SecurityException("Only admins can remove user roles");
        }

        // Find target user
        User targetUser = userRepository.findByUsername(request.username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.username));

        // Check if user has this role
        String roleUpper = request.role.toUpperCase();
        if (!userRoleRepository.userHasRole(targetUser.username, roleUpper)) {
            LOG.info("User " + targetUser.username + " does not have role: " + roleUpper);
            return false;
        }

        // Delete the role assignment
        userRoleRepository.deleteByUsernameAndRole(targetUser.username, roleUpper);

        LOG.info("User role removed successfully: " + targetUser.username + " -> " + roleUpper);
        return true;
    }

    public boolean deleteUserAccount(String adminUsername, RemoveUserAccountRequest request) {
        LOG.info("Deleting user account: " + request.username + " by admin: " + adminUsername);

        // Verify admin role
        if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
            throw new SecurityException("Only admins can delete user accounts");
        }

        // Find target user
        User targetUser = userRepository.findByUsername(request.username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.username));

        // Prevent deleting the admin's own account
        if (targetUser.username.equals(adminUsername)) {
            throw new IllegalArgumentException("Cannot delete your own account");
        }

        // Delete all user data in the correct order
        // 1. Delete user likes
        userLikeRepository.deleteAllByUsername(targetUser.username);
        LOG.info("Deleted all likes for user: " + targetUser.username);

        // 2. Delete user progress
        userProgressRepository.deleteByUsername(targetUser.username);
        LOG.info("Deleted user progress for: " + targetUser.username);

        // 3. Delete user roles
        userRoleRepository.deleteAllByUsername(targetUser.username);
        LOG.info("Deleted all roles for user: " + targetUser.username);

        // 4. Delete user record
        userRepository.deleteByUsername(targetUser.username);
        LOG.info("Deleted user account: " + targetUser.username);

        return true;
    }

    public boolean changePassword(String username, ChangePasswordRequest request) {
        LOG.info("Changing password for user: " + username);

        // Validate password match
        if (!request.isPasswordMatch()) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        // Find user
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        // Verify current password
        if (!PasswordUtil.verifyPassword(request.currentPassword, user.passwordHash)) {
            throw new SecurityException("Current password is incorrect");
        }

        // Update password
        user.passwordHash = PasswordUtil.hashPassword(request.newPassword);
        user.updatedAt = java.time.LocalDateTime.now();
        userRepository.update(user);

        LOG.info("Password changed successfully for user: " + username);
        return true;
    }

    public boolean unregister(String username, UnregisterRequest request) {
        LOG.info("Unregistering user account: " + username);

        // Find user
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        // Verify password
        if (!PasswordUtil.verifyPassword(request.password, user.passwordHash)) {
            throw new SecurityException("Invalid password");
        }

        // Delete all user data in the correct order
        // 1. Delete user likes
        userLikeRepository.deleteAllByUsername(user.username);
        LOG.info("Deleted all likes for user: " + user.username);

        // 2. Delete user progress
        userProgressRepository.deleteByUsername(user.username);
        LOG.info("Deleted user progress for: " + user.username);

        // 3. Delete user roles
        userRoleRepository.deleteAllByUsername(user.username);
        LOG.info("Deleted all roles for user: " + user.username);

        // 4. Delete user record
        userRepository.deleteByUsername(user.username);
        LOG.info("Deleted user account: " + user.username);

        return true;
    }
}
