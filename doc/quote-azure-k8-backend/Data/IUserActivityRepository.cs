using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data.Entities;

namespace quote_azure_k8_backend.Data
{
    public interface IUserActivityRepository
    {
        Task<bool> UpdateUserPreferencesAsync(UserProgress preferences);
        
        Task<UserProgress?> GetUserProgressAsync(string userId);
        Task<bool> UpdateLastQuoteIdAsync(string userId, int quoteId);
        
        Task<bool> AddUserLikeAsync(string userId, int quoteId);
        Task<bool> RemoveUserLikeAsync(string userId, int quoteId);
        Task<List<int>> GetUserLikedQuoteIdsAsync(string userId);
        Task<List<UserLikeEntity>> GetAllUserLikesAsync(string userId);
        Task<bool> UpdateUserLikeOrderAsync(string userId, int quoteId, int newOrder);
        Task<int> GetTotalLikesCountAsync();
        Task<int> GetLikeCountForQuoteAsync(int quoteId);
        Task<bool> RemoveAllUserLikesAsync(string userId);
        Task<bool> RemoveUserProgressAsync(string userId);
    }
}
