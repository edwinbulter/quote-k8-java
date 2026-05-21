package com.quote.k8.service;

import com.quote.k8.dto.LoginRequest;
import com.quote.k8.dto.RegisterRequest;
import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserRepository;
import com.quote.k8.repository.UserRoleRepository;
import com.quote.k8.util.PasswordUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AuthService {

    private static final Logger LOG = Logger.getLogger(AuthService.class);

    @Inject
    UserRepository userRepository;

    @Inject
    UserRoleRepository userRoleRepository;

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
}
