using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Models.Auth;
using quote_azure_k8_backend.Data;
using Microsoft.AspNetCore.Identity;

namespace quote_azure_k8_backend.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;
        private readonly IUserRoleRepository _userRoleRepository;
        private readonly IJwtService _jwtService;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly ILogger<UserService> _logger;

        public UserService(
            IUserRepository userRepository,
            IUserRoleRepository userRoleRepository,
            IJwtService jwtService,
            IPasswordHasher<User> passwordHasher,
            ILogger<UserService> logger)
        {
            _userRepository = userRepository;
            _userRoleRepository = userRoleRepository;
            _jwtService = jwtService;
            _passwordHasher = passwordHasher;
            _logger = logger;
        }

        public async Task<User> RegisterAsync(RegisterRequest request)
        {
            try
            {
                // Check if user already exists
                if (await _userRepository.EmailExistsAsync(request.Email))
                    throw new ArgumentException("Email already exists");

                if (await _userRepository.UsernameExistsAsync(request.Username))
                    throw new ArgumentException("Username already exists");

                // Create new user
                var user = new User
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = request.Email,
                    Username = request.Username,
                    PasswordHash = _passwordHasher.HashPassword(null!, request.Password),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                var createdUser = await _userRepository.CreateAsync(user);

                // Assign USER role by default
                var userRole = new UserRole
                {
                    Username = createdUser.Username,
                    Role = "USER",
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = "System"
                };

                await _userRoleRepository.CreateUserRoleAsync(userRole);

                _logger.LogInformation("User registered successfully: {Username}", createdUser.Username);
                return createdUser;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering user");
                throw;
            }
        }

        public async Task<string> LoginAsync(LoginRequest request)
        {
            try
            {
                User? user = null;

                // Try to find user by email first, then by username
                if (request.LoginIdentifier.Contains("@"))
                {
                    user = await _userRepository.GetByEmailAsync(request.LoginIdentifier);
                }
                else
                {
                    user = await _userRepository.GetByUsernameAsync(request.LoginIdentifier);
                }

                if (user == null)
                    throw new UnauthorizedAccessException("User not found");

                // Verify password
                var verificationResult = _passwordHasher.VerifyHashedPassword(null!, user.PasswordHash, request.Password);
                if (verificationResult != PasswordVerificationResult.Success)
                    throw new UnauthorizedAccessException("Invalid password");

                if (!user.IsActive)
                    throw new UnauthorizedAccessException("User account is inactive");

                // Generate JWT token
                var token = _jwtService.GenerateToken(user);

                _logger.LogInformation("User logged in successfully: {Username}", user.Username);
                return token;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                throw;
            }
        }

        public async Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request)
        {
            try
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null)
                    return false;

                // Verify current password
                var verificationResult = _passwordHasher.VerifyHashedPassword(null!, user.PasswordHash, request.CurrentPassword);
                if (verificationResult != PasswordVerificationResult.Success)
                    throw new UnauthorizedAccessException("Current password is incorrect");

                // Update password
                user.PasswordHash = _passwordHasher.HashPassword(null!, request.NewPassword);
                user.UpdatedAt = DateTime.UtcNow;

                await _userRepository.UpdateAsync(user);

                _logger.LogInformation("Password changed successfully for user: {UserId}", userId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error changing password");
                throw;
            }
        }

        public async Task<bool> UpdateUserRoleAsync(string adminId, UpdateRoleRequest request)
        {
            try
            {
                var admin = await _userRepository.GetByIdAsync(adminId);
                if (admin == null)
                    throw new UnauthorizedAccessException("Admin user not found");

                var targetUser = await _userRepository.GetByUsernameAsync(request.username);
                if (targetUser == null)
                    return false;

                // Create new role assignment (supports multiple roles per user)
                var newRole = new UserRole
                {
                    Username = targetUser.Username,
                    Role = request.role.ToUpper(),
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = admin.Username
                };
                await _userRoleRepository.CreateUserRoleAsync(newRole);

                _logger.LogInformation("User role updated: {Username} -> {Role}", targetUser.Username, request.role);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user role");
                throw;
            }
        }

        public async Task<bool> RemoveUserRoleAsync(string adminId, UpdateRoleRequest request)
        {
            try
            {
                var targetUser = await _userRepository.GetByUsernameAsync(request.username);
                if (targetUser == null)
                    return false;

                await _userRoleRepository.DeleteUserRoleAsync(targetUser.Username);

                _logger.LogInformation("User role removed: {Username}", targetUser.Username);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing user role");
                throw;
            }
        }

        public async Task<User?> GetUserByIdAsync(string id)
        {
            return await _userRepository.GetByIdAsync(id);
        }

        public async Task<User?> GetUserByUsernameAsync(string username)
        {
            return await _userRepository.GetByUsernameAsync(username);
        }

        public async Task<IEnumerable<Models.Admin.AdminUserInfo>> GetAllUsersAsync(string adminId)
        {
            try
            {
                if (!await IsAdminAsync(adminId))
                    throw new UnauthorizedAccessException("Only admins can list all users");

                var users = await _userRepository.GetAllAsync();
                var userInfos = new List<Models.Admin.AdminUserInfo>();

                foreach (var user in users)
                {
                    // Get user roles
                    var userRoles = await _userRoleRepository.GetUserRolesAsync(user.Username);
                    var roles = userRoles.Select(r => string.IsNullOrEmpty(r.Role) ? string.Empty : r.Role.ToUpper()).ToArray();
                    
                    var userInfo = new Models.Admin.AdminUserInfo
                    {
                        Username = user.Username,
                        Email = user.Email,
                        Roles = roles,
                        Enabled = user.IsActive,
                        UserStatus = user.IsActive ? "ACTIVE" : "INACTIVE",
                        UserCreateDate = user.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                        UserLastModifiedDate = user.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ")
                    };
                    
                    userInfos.Add(userInfo);
                }

                return userInfos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all users");
                throw;
            }
        }

        public async Task<bool> IsUserInRoleAsync(string userId, string role)
        {
            try
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null)
                    return false;

                return await _userRoleRepository.UserHasRoleAsync(user.Username, role);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking user role");
                return false;
            }
        }

        public async Task<bool> IsAdminAsync(string userId)
        {
            return await IsUserInRoleAsync(userId, "ADMIN");
        }

        public async Task<bool> UnregisterAsync(string userId, string password)
        {
            try
            {
                var user = await _userRepository.GetByIdAsync(userId);
                if (user == null)
                    return false;

                // Verify password
                var verificationResult = _passwordHasher.VerifyHashedPassword(null!, user.PasswordHash, password);
                if (verificationResult != PasswordVerificationResult.Success)
                    throw new UnauthorizedAccessException("Invalid password");

                // Delete all user data
                await _userRepository.DeleteAsync(userId);
                // Note: In a real implementation, you would also delete related data (likes, progress, etc.)

                _logger.LogInformation("User unregistered successfully: {UserId}", userId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unregistering user");
                throw;
            }
        }

        public async Task<bool> DeleteUserAsync(string userId)
        {
            try
            {
                return await _userRepository.DeleteAsync(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user");
                return false;
            }
        }
    }
}
