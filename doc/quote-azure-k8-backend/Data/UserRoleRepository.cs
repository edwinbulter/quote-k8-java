using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Data
{
    public class UserRoleRepository : IUserRoleRepository
    {
        private readonly TableClient _tableClient;
        private readonly ILogger<UserRoleRepository> _logger;

        public UserRoleRepository(TableServiceClient tableServiceClient, ILogger<UserRoleRepository> logger)
        {
            _tableClient = tableServiceClient.GetTableClient("userroles");
            _logger = logger;
            
            // Create table asynchronously to avoid blocking startup
            Task.Run(async () => {
                try
                {
                    await _tableClient.CreateIfNotExistsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create userroles table");
                }
            });
        }

        public async Task<UserRole?> GetUserRoleAsync(string username)
        {
            try
            {
                // Try new format first (username_ADMIN)
                var sanitizedUsername = username.Replace("@", "-at-").Replace(".", "-dot-");
                var newRowKey = $"{sanitizedUsername}_ADMIN";
                
                _logger.LogInformation("GetUserRoleAsync: Looking for user {Username} with RowKey {RowKey}", username, newRowKey);
                
                try
                {
                    var response = await _tableClient.GetEntityAsync<TableEntity>("userroles", newRowKey);
                    _logger.LogInformation("GetUserRoleAsync: Found user role with new format");
                    var entity = response.Value;
                    
                    return new UserRole
                    {
                        Username = entity["Username"].ToString(),
                        Role = entity["Role"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = entity["UpdatedAt"] as DateTime?,
                        CreatedBy = entity["CreatedBy"].ToString(),
                        UpdatedBy = entity["UpdatedBy"]?.ToString()
                    };
                }
                catch (RequestFailedException ex) when (ex.Status == 404)
                {
                    _logger.LogInformation("GetUserRoleAsync: New format not found, trying old format with RowKey {Username}", username);
                    // Fall back to old format
                    var oldResponse = await _tableClient.GetEntityAsync<TableEntity>("userroles", username);
                    _logger.LogInformation("GetUserRoleAsync: Found user role with old format");
                    var entity = oldResponse.Value;
                    
                    return new UserRole
                    {
                        Username = entity["Username"].ToString(),
                        Role = entity["Role"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = entity["UpdatedAt"] as DateTime?,
                        CreatedBy = entity["CreatedBy"].ToString(),
                        UpdatedBy = entity["UpdatedBy"]?.ToString()
                    };
                }
                catch (RequestFailedException ex) when (ex.Status == 404)
                {
                    return null;
                }
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user role for user: {Username}", username);
                throw;
            }
        }

        public async Task<List<UserRole>> GetUserRolesAsync(string username)
        {
            try
            {
                var userRoles = new List<UserRole>();
                // Query for all roles for this username (both old and new formats)
                var query = _tableClient.QueryAsync<TableEntity>(filter: $"PartitionKey eq 'userroles' and (Username eq '{username}' or RowKey eq '{username}')");
                
                await foreach (var entity in query)
                {
                    var userRole = new UserRole
                    {
                        Username = entity["Username"].ToString(),
                        Role = entity["Role"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = entity["UpdatedAt"] as DateTime?,
                        CreatedBy = entity["CreatedBy"].ToString(),
                        UpdatedBy = entity["UpdatedBy"]?.ToString()
                    };
                    userRoles.Add(userRole);
                }
                
                return userRoles;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user roles for user: {Username}", username);
                throw;
            }
        }

        public async Task<List<UserRole>> GetAllUserRolesAsync()
        {
            try
            {
                var userRoles = new List<UserRole>();
                var query = _tableClient.QueryAsync<TableEntity>();
                
                await foreach (var entity in query)
                {
                    var userRole = new UserRole
                    {
                        Username = entity["Username"].ToString(),
                        Role = entity["Role"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = entity["UpdatedAt"] as DateTime?,
                        CreatedBy = entity["CreatedBy"].ToString(),
                        UpdatedBy = entity["UpdatedBy"]?.ToString()
                    };
                    userRoles.Add(userRole);
                }
                return userRoles;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all user roles");
                throw;
            }
        }

        public async Task<UserRole> CreateUserRoleAsync(UserRole userRole)
        {
            // Sanitize username for RowKey (replace invalid characters) - match original Function
                var sanitizedUsername = userRole.Username.Replace("@", "-at-").Replace(".", "-dot-");
                
                var entity = new TableEntity("userroles", $"{sanitizedUsername}_{userRole.Role.ToUpper()}")
            {
                ["Username"] = userRole.Username,
                ["Role"] = userRole.Role.ToUpper(),
                ["CreatedAt"] = DateTime.SpecifyKind(userRole.CreatedAt, DateTimeKind.Utc),
                ["UpdatedAt"] = DateTime.SpecifyKind(userRole.UpdatedAt ?? DateTime.UtcNow, DateTimeKind.Utc),
                ["CreatedBy"] = userRole.CreatedBy,
                ["UpdatedBy"] = userRole.UpdatedBy
            };

            try
            {
                await _tableClient.AddEntityAsync(entity);
                _logger.LogInformation("User role created successfully for user: {Username}", userRole.Username);
                return userRole;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Error creating user role for user: {Username}", userRole.Username);
                throw;
            }
        }

        public async Task<UserRole> UpdateUserRoleAsync(UserRole userRole)
        {
            var entity = new TableEntity("userroles", userRole.Username)
            {
                ["Username"] = userRole.Username,
                ["Role"] = userRole.Role,
                ["CreatedAt"] = DateTime.SpecifyKind(userRole.CreatedAt, DateTimeKind.Utc),
                ["UpdatedAt"] = DateTime.UtcNow,
                ["CreatedBy"] = userRole.CreatedBy,
                ["UpdatedBy"] = userRole.UpdatedBy
            };

            try
            {
                await _tableClient.UpdateEntityAsync(entity, ETag.All);
                userRole.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("User role updated successfully for user: {Username}", userRole.Username);
                return userRole;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Error updating user role for user: {Username}", userRole.Username);
                throw;
            }
        }

        public async Task<bool> DeleteUserRoleAsync(string username)
        {
            try
            {
                await _tableClient.DeleteEntityAsync("userroles", username);
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user role for user: {Username}", username);
                return false;
            }
        }

        public async Task<bool> UserHasRoleAsync(string username, string role)
        {
            try
            {
                // First try new format (username_ROLE)
                var sanitizedUsername = username.Replace("@", "-at-").Replace(".", "-dot-");
                var newRowKey = $"{sanitizedUsername}_{role.ToUpper()}";
                
                try
                {
                    var response = await _tableClient.GetEntityAsync<TableEntity>("userroles", newRowKey);
                    if (response != null)
                        return true;
                }
                catch (RequestFailedException ex) when (ex.Status == 404)
                {
                    // New format not found, try old format (username)
                }
                
                // Fall back to old format (single role per user)
                var oldResponse = await _tableClient.GetEntityAsync<TableEntity>("userroles", username);
                if (oldResponse != null)
                {
                    var storedRole = oldResponse.Value["Role"]?.ToString();
                    return storedRole?.Equals(role, StringComparison.OrdinalIgnoreCase) == true;
                }
                
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if user has role for user: {Username}, role: {Role}", username, role);
                return false;
            }
        }
    }
}
