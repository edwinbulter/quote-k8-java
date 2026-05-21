using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data.Entities;

namespace quote_azure_k8_backend.Data
{
    public class UserActivityRepository : IUserActivityRepository
    {
        private readonly TableClient _userProgressTable;
        private readonly TableClient _userLikeTable;
        private readonly ILogger<UserActivityRepository> _logger;

        public UserActivityRepository(TableServiceClient tableServiceClient, ILogger<UserActivityRepository> logger)
        {
            _userProgressTable = tableServiceClient.GetTableClient("userprogress");
            _userLikeTable = tableServiceClient.GetTableClient("userlikes");
            
            _logger = logger;
            
            // Create tables asynchronously to avoid blocking startup
            Task.Run(async () => {
                try
                {
                    await _userProgressTable.CreateIfNotExistsAsync();
                    await _userLikeTable.CreateIfNotExistsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create user activity tables");
                }
            });
        }

        public async Task<bool> UpdateUserPreferencesAsync(UserProgress preferences)
        {
            try
            {
                var entity = new UserProgressEntity(preferences.Username, preferences.LastQuoteId);
                await _userProgressTable.UpsertEntityAsync(entity);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user preferences for user: {Username}", preferences.Username);
                return false;
            }
        }

        public async Task<UserProgress?> GetUserProgressAsync(string userId)
        {
            try
            {
                var response = await _userProgressTable.GetEntityAsync<UserProgressEntity>("userprogress", userId);
                var entity = response.Value;
                
                return new UserProgress
                {
                    Username = entity.Username,
                    LastQuoteId = entity.LastQuoteId,
                    UpdatedAt = entity.UpdatedAt
                };
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user progress for user: {UserId}", userId);
                throw;
            }
        }

        public async Task<bool> UpdateLastQuoteIdAsync(string userId, int quoteId)
        {
            try
            {
                var entity = new UserProgressEntity(userId, quoteId);
                await _userProgressTable.UpsertEntityAsync(entity);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating last quote ID for user: {UserId}", userId);
                return false;
            }
        }

        public async Task<bool> AddUserLikeAsync(string userId, int quoteId)
        {
            try
            {
                // Get current max order for this user
                var maxOrder = 0;
                var query = _userLikeTable.QueryAsync<UserLikeEntity>(filter: $"PartitionKey eq '{userId}'");
                await foreach (var existingEntity in query)
                {
                    if (existingEntity.Order > maxOrder)
                        maxOrder = existingEntity.Order;
                }

                var entity = new UserLikeEntity(userId, quoteId)
                {
                    Order = maxOrder + 1
                };
                
                await _userLikeTable.AddEntityAsync(entity);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding user like for user: {UserId}, quote: {QuoteId}", userId, quoteId);
                return false;
            }
        }

        public async Task<bool> RemoveUserLikeAsync(string userId, int quoteId)
        {
            try
            {
                await _userLikeTable.DeleteEntityAsync(userId, $"{userId}_{quoteId}");
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing user like for user: {UserId}, quote: {QuoteId}", userId, quoteId);
                return false;
            }
        }

        public async Task<List<int>> GetUserLikedQuoteIdsAsync(string userId)
        {
            try
            {
                var likedIds = new List<int>();
                var query = _userLikeTable.QueryAsync<UserLikeEntity>(filter: $"PartitionKey eq '{userId}'");
                
                await foreach (var entity in query)
                {
                    likedIds.Add(entity.QuoteId);
                }
                
                return likedIds.OrderBy(id => id).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting liked quote IDs for user: {UserId}", userId);
                throw;
            }
        }

        public async Task<List<UserLikeEntity>> GetAllUserLikesAsync(string userId)
        {
            try
            {
                var likes = new List<UserLikeEntity>();
                var query = _userLikeTable.QueryAsync<UserLikeEntity>(filter: $"PartitionKey eq '{userId}'");
                
                await foreach (var entity in query)
                {
                    likes.Add(entity);
                }
                
                return likes.OrderBy(l => l.Order).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all user likes for user: {UserId}", userId);
                throw;
            }
        }

        public async Task<bool> UpdateUserLikeOrderAsync(string userId, int quoteId, int newOrder)
        {
            try
            {
                var response = await _userLikeTable.GetEntityAsync<UserLikeEntity>(userId, $"{userId}_{quoteId}");
                var likeEntity = response.Value;
                likeEntity.Order = newOrder;
                
                await _userLikeTable.UpdateEntityAsync(likeEntity, ETag.All);
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user like order for user: {UserId}, quote: {QuoteId}", userId, quoteId);
                return false;
            }
        }

        public async Task<int> GetTotalLikesCountAsync()
        {
            try
            {
                var count = 0;
                await foreach (var entity in _userLikeTable.QueryAsync<UserLikeEntity>())
                {
                    count++;
                }
                return count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting total likes count");
                throw;
            }
        }

        public async Task<int> GetLikeCountForQuoteAsync(int quoteId)
        {
            try
            {
                var count = 0;
                var query = _userLikeTable.QueryAsync<UserLikeEntity>(filter: $"QuoteId eq {quoteId}");
                
                await foreach (var entity in query)
                {
                    count++;
                }
                
                return count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting like count for quote: {QuoteId}", quoteId);
                throw;
            }
        }

        public async Task<bool> RemoveAllUserLikesAsync(string userId)
        {
            try
            {
                var query = _userLikeTable.QueryAsync<UserLikeEntity>(filter: $"PartitionKey eq '{userId}'");
                
                await foreach (var entity in query)
                {
                    await _userLikeTable.DeleteEntityAsync(entity.PartitionKey, entity.RowKey);
                }
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing all user likes for user: {UserId}", userId);
                return false;
            }
        }

        public async Task<bool> RemoveUserProgressAsync(string userId)
        {
            try
            {
                await _userProgressTable.DeleteEntityAsync("userprogress", userId);
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing user progress for user: {UserId}", userId);
                return false;
            }
        }
    }
}
