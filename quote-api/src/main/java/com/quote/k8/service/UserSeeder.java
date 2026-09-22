package com.quote.k8.service;

import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserRepository;
import com.quote.k8.repository.UserRoleRepository;
import com.quote.k8.util.PasswordUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class UserSeeder {

    private static final Logger LOG = Logger.getLogger(UserSeeder.class);

    @Inject
    UserRepository userRepository;

    @Inject
    UserRoleRepository userRoleRepository;

    public void seedUsers() {
        try {
            LOG.info("Starting user seeding process");

            // Check if admin user already exists
            var existingAdmin = userRepository.findByUsername("admin");
            if (existingAdmin.isPresent()) {
                LOG.info("Admin user already exists, deleting and recreating");
                userRepository.deleteByUsername("admin");
                userRoleRepository.deleteAllByUsername("admin");
            }

            // Create admin user
            User adminUser = new User(
                "admin",
                "admin@quote-backend.local",
                PasswordUtil.hashPassword("Admin123!")
            );
            userRepository.persist(adminUser);
            LOG.info("Admin user created: " + adminUser.username);

            // Assign admin role
            UserRole adminRole = new UserRole("admin", "ADMIN", "System");
            userRoleRepository.persist(adminRole);
            LOG.info("Admin role assigned to user: " + adminUser.username);

            // Check if test user already exists
            var existingTestUser = userRepository.findByUsername("user-1");
            if (existingTestUser.isPresent()) {
                LOG.info("Test user already exists, skipping creation");
                return;
            }

            // Create test user
            User testUser = new User(
                "user-1",
                "user-1@outlook.com",
                PasswordUtil.hashPassword("Hello-user-1")
            );
            userRepository.persist(testUser);
            LOG.info("Test user created: " + testUser.username);

            // Assign user role
            UserRole userRole = new UserRole("user-1", "USER", "System");
            userRoleRepository.persist(userRole);
            LOG.info("User role assigned to user: " + testUser.username);

            LOG.info("User seeding completed successfully");
        } catch (Exception e) {
            LOG.error("Error during user seeding", e);
            throw new RuntimeException("Failed to seed users", e);
        }
    }
}
