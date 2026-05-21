using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data;
using Microsoft.AspNetCore.Identity;
using Azure;

namespace quote_azure_k8_backend.Services
{
    public class AdminUserSeeder
    {
        private readonly IUserRepository _userRepository;
        private readonly IUserRoleRepository _userRoleRepository;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly ILogger<AdminUserSeeder> _logger;

        public AdminUserSeeder(
            IUserRepository userRepository,
            IUserRoleRepository userRoleRepository,
            IPasswordHasher<User> passwordHasher,
            ILogger<AdminUserSeeder> logger)
        {
            _userRepository = userRepository;
            _userRoleRepository = userRoleRepository;
            _passwordHasher = passwordHasher;
            _logger = logger;
        }

        public async Task SeedAdminUsersAsync()
        {
            try
            {
                _logger.LogInformation("Starting admin user seeding process");
            _logger.LogInformation("=== DEBUG LOG: CHANGES APPLIED - VERSION 3.0 ===");
            _logger.LogInformation("=== IF YOU SEE THIS, DOCKER BUILD IS WORKING ===");

                // Wait a bit for tables to be created asynchronously
                await Task.Delay(2000);

                // Check if admin user already exists with retry logic
                User? existingAdmin = null;
                var maxRetries = 3;
                var retryCount = 0;
                
                while (retryCount < maxRetries)
                {
                    existingAdmin = await _userRepository.GetByUsernameAsync("admin");
                    if (existingAdmin != null)
                        break;
                        
                    retryCount++;
                    if (retryCount < maxRetries)
                    {
                        _logger.LogInformation("Admin user not found, retrying in 2 seconds... ({RetryCount}/{MaxRetries})", retryCount, maxRetries);
                        await Task.Delay(2000);
                    }
                }

                if (existingAdmin != null)
                {
                    _logger.LogInformation("Admin user already exists, updating ID and checking admin role assignment...");
                    
                    // Update the admin user to have the correct ID that matches JWT tokens
                    if (existingAdmin.Id != "98d9a7e2-2657-4c37-b784-2eee61ddb3b8")
                    {
                        existingAdmin.Id = "98d9a7e2-2657-4c37-b784-2eee61ddb3b8";
                        await _userRepository.UpdateAsync(existingAdmin);
                        _logger.LogInformation("Updated admin user ID to match JWT token");
                    }
                    
                    // Check if admin role is assigned
                    _logger.LogInformation("About to call GetUserRoleAsync for admin user");
                    var existingRole = await _userRoleRepository.GetUserRoleAsync("admin");
                    _logger.LogInformation("GetUserRoleAsync returned: {ExistingRole}", existingRole?.ToString() ?? "null");
                    
                    if (existingRole != null && existingRole.Role == "ADMIN")
                    {
                        _logger.LogInformation("Admin role already assigned, seeding complete");
                        return;
                    }
                    else
                    {
                        _logger.LogInformation("Admin role not found or incorrect, assigning ADMIN role...");
                        
                        // Check if admin role already exists
                        _logger.LogInformation("Checking if admin role exists for user: admin");
                        var roleExists = await _userRoleRepository.UserHasRoleAsync("admin", "ADMIN");
                        _logger.LogInformation("UserHasRoleAsync result: {RoleExists}", roleExists);
                        
                        if (roleExists)
                        {
                            _logger.LogInformation("Admin role already exists for admin user");
                        }
                        else
                        {
                            _logger.LogInformation("Admin role does not exist, creating new role...");
                            // Assign admin role
                            var adminRoleAssignment = new UserRole
                            {
                                Username = "admin",
                                Role = "ADMIN",
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = "System"
                            };

                            await _userRoleRepository.CreateUserRoleAsync(adminRoleAssignment);
                            _logger.LogInformation("Admin role assigned to existing admin user");
                        }
                        return;
                    }
                }

                // Create admin user
                var adminUser = new User
                {
                    Id = "98d9a7e2-2657-4c37-b784-2eee61ddb3b8", // Fixed ID to match JWT tokens
                    Username = "admin",
                    Email = "admin@quote-backend.local",
                    PasswordHash = _passwordHasher.HashPassword(null!, "Admin123!"),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                var createdUser = await _userRepository.CreateAsync(adminUser);
                _logger.LogInformation("Admin user created: {Username}", createdUser.Username);

                // Assign admin role
                var adminRole = new UserRole
                {
                    Username = createdUser.Username,
                    Role = "ADMIN",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "System"
                };

                try
                {
                    await _userRoleRepository.CreateUserRoleAsync(adminRole);
                    _logger.LogInformation("Admin role assigned to user: {Username}", createdUser.Username);
                }
                catch (Azure.RequestFailedException ex) when (ex.Status == 409)
                {
                    _logger.LogInformation("Admin role already exists for user: {Username}", createdUser.Username);
                }

                // Create test user
                var existingTestUser = await _userRepository.GetByUsernameAsync("user-1");
                if (existingTestUser != null)
                {
                    _logger.LogInformation("Test user already exists, skipping creation");
                    return;
                }

                var testUser = new User
                {
                    Id = Guid.NewGuid().ToString(),
                    Username = "user-1",
                    Email = "user-1@outlook.com",
                    PasswordHash = _passwordHasher.HashPassword(null!, "Hello-user-1"),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                var createdTestUser = await _userRepository.CreateAsync(testUser);
                _logger.LogInformation("Test user created: {Username}", createdTestUser.Username);

                // Assign user role
                var userRole = new UserRole
                {
                    Username = createdTestUser.Username,
                    Role = "USER",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "System"
                };

                await _userRoleRepository.CreateUserRoleAsync(userRole);
                _logger.LogInformation("User role assigned to user: {Username}", createdTestUser.Username);

                _logger.LogInformation("Admin user seeding completed successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during admin user seeding");
                throw;
            }
        }
    }
}
