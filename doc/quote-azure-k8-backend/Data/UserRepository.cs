using Azure;
using Azure.Data.Tables;
using quote_azure_k8_backend.Models;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace quote_azure_k8_backend.Data
{
    public class UserRepository : IUserRepository
    {
        private readonly TableClient _tableClient;
        private readonly ILogger<UserRepository> _logger;

        public UserRepository(TableServiceClient tableServiceClient, ILogger<UserRepository> logger)
        {
            _tableClient = tableServiceClient.GetTableClient("users");
            _logger = logger;
            
            // Create table asynchronously to avoid blocking startup
            Task.Run(async () => {
                try
                {
                    await _tableClient.CreateIfNotExistsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create users table");
                }
            });
        }

        public async Task<User> CreateAsync(User user)
        {
            var entity = new TableEntity(user.Id, user.Username)
            {
                ["Email"] = user.Email,
                ["PasswordHash"] = user.PasswordHash,
                ["CreatedAt"] = user.CreatedAt,
                ["UpdatedAt"] = user.UpdatedAt,
                ["IsActive"] = user.IsActive,
                ["PasswordResetToken"] = user.PasswordResetToken,
                ["PasswordResetExpires"] = user.PasswordResetExpires
            };

            try
            {
                await _tableClient.AddEntityAsync(entity);
                _logger.LogInformation("User created successfully with ID: {UserId}", user.Id);
                return user;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Error creating user with email: {Email}", user.Email);
                throw;
            }
        }

        public async Task<bool> DeleteAsync(string id)
        {
            try
            {
                // First get the entity to find the RowKey
                var entity = await _tableClient.GetEntityAsync<TableEntity>("users", id);
                await _tableClient.DeleteEntityAsync(entity.Value.PartitionKey, entity.Value.RowKey);
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user with ID: {UserId}", id);
                throw;
            }
        }

        public async Task<bool> EmailExistsAsync(string email)
        {
            try
            {
                var query = _tableClient.QueryAsync<TableEntity>(filter: $"Email eq '{email}'");
                await foreach (var entity in query)
                {
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if email exists: {Email}", email);
                throw;
            }
        }

        public async Task<IEnumerable<User>> GetAllAsync()
        {
            try
            {
                var users = new List<User>();
                var query = _tableClient.QueryAsync<TableEntity>();
                
                await foreach (var entity in query)
                {
                    var user = new User
                    {
                        Id = entity.PartitionKey,
                        Email = entity["Email"].ToString(),
                        Username = entity.RowKey,
                        PasswordHash = entity["PasswordHash"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = ((DateTimeOffset)entity["UpdatedAt"]).DateTime,
                        IsActive = (bool)entity["IsActive"],
                        PasswordResetToken = entity["PasswordResetToken"]?.ToString(),
                        PasswordResetExpires = entity["PasswordResetExpires"] as DateTime?
                    };
                    users.Add(user);
                }
                return users;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all users");
                throw;
            }
        }

        public async Task<User?> GetByIdAsync(string id)
        {
            try
            {
                // Look for user by PartitionKey (user ID) since that's how we store it
                var query = _tableClient.QueryAsync<TableEntity>(filter: $"PartitionKey eq '{id}'");
                
                await foreach (var entity in query)
                {
                    return new User
                    {
                        Id = entity.PartitionKey,
                        Email = entity["Email"].ToString(),
                        Username = entity.RowKey,
                        PasswordHash = entity["PasswordHash"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = ((DateTimeOffset)entity["UpdatedAt"]).DateTime,
                        IsActive = (bool)entity["IsActive"],
                        PasswordResetToken = entity["PasswordResetToken"]?.ToString(),
                        PasswordResetExpires = entity["PasswordResetExpires"] as DateTime?
                    };
                }
                
                return null;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user by ID: {UserId}", id);
                throw;
            }
        }

        public async Task<User?> GetByEmailAsync(string email)
        {
            try
            {
                var query = _tableClient.QueryAsync<TableEntity>(filter: $"Email eq '{email}'");
                await foreach (var entity in query)
                {
                    return new User
                    {
                        Id = entity.PartitionKey,
                        Email = entity["Email"].ToString(),
                        Username = entity.RowKey,
                        PasswordHash = entity["PasswordHash"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = ((DateTimeOffset)entity["UpdatedAt"]).DateTime,
                        IsActive = (bool)entity["IsActive"],
                        PasswordResetToken = entity["PasswordResetToken"]?.ToString(),
                        PasswordResetExpires = entity["PasswordResetExpires"] as DateTime?
                    };
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user by email: {Email}", email);
                throw;
            }
        }

        public async Task<User?> GetByUsernameAsync(string username)
        {
            try
            {
                var query = _tableClient.QueryAsync<TableEntity>(filter: $"RowKey eq '{username}'");
                await foreach (var entity in query)
                {
                    return new User
                    {
                        Id = entity.PartitionKey,
                        Email = entity["Email"].ToString(),
                        Username = entity.RowKey,
                        PasswordHash = entity["PasswordHash"].ToString(),
                        CreatedAt = ((DateTimeOffset)entity["CreatedAt"]).DateTime,
                        UpdatedAt = ((DateTimeOffset)entity["UpdatedAt"]).DateTime,
                        IsActive = (bool)entity["IsActive"],
                        PasswordResetToken = entity["PasswordResetToken"]?.ToString(),
                        PasswordResetExpires = entity["PasswordResetExpires"] as DateTime?
                    };
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user by username: {Username}", username);
                throw;
            }
        }

        public async Task<User> UpdateAsync(User user)
        {
            var entity = new TableEntity(user.Id, user.Username)
            {
                ["Email"] = user.Email,
                ["PasswordHash"] = user.PasswordHash,
                ["CreatedAt"] = user.CreatedAt,
                ["UpdatedAt"] = DateTime.UtcNow,
                ["IsActive"] = user.IsActive,
                ["PasswordResetToken"] = user.PasswordResetToken,
                ["PasswordResetExpires"] = user.PasswordResetExpires
            };

            try
            {
                await _tableClient.UpdateEntityAsync(entity, ETag.All);
                user.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("User updated successfully with ID: {UserId}", user.Id);
                return user;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Error updating user with ID: {UserId}", user.Id);
                throw;
            }
        }

        public async Task<bool> UsernameExistsAsync(string username)
        {
            try
            {
                var query = _tableClient.QueryAsync<TableEntity>(filter: $"RowKey eq '{username}'");
                await foreach (var entity in query)
                {
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if username exists: {Username}", username);
                throw;
            }
        }
    }
}
