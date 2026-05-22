using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Services
{
    public interface IQuoteService
    {
        Task<Quote?> GetQuoteAsync(string? username, HashSet<int> idsToExclude);
        Task<Quote?> GetQuoteByIdAsync(string? username, int quoteId);
        Task<Quote?> LikeQuoteAsync(string username, int quoteId);
        Task UnlikeQuoteAsync(string username, int quoteId);
        Task<List<Quote>> GetLikedQuotesByUserAsync(string username);
        Task<List<Quote>> GetViewedQuotesAsync(string username);
        Task ReorderLikedQuoteAsync(string username, int quoteId, int newOrder);
        Task<UserProgress?> GetUserProgressAsync(string username);
    }
}
