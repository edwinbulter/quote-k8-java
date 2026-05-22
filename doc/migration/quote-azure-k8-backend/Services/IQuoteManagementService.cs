using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Services
{
    public interface IQuoteManagementService
    {
        Task<QuotePageResponse> GetQuotesAsync(int page, int pageSize, string? quoteText, string? author, string? sortBy, string? sortOrder);
        Task<QuoteAddResponse> FetchAndAddNewQuotesAsync(string requestingUsername);
        Task<int> GetTotalQuotesCountAsync(string? quoteText = null, string? author = null);
        Task<int> GetTotalLikesAsync();
        Task<Quote?> GetQuoteByIdAsync(int id);
        Task<bool> DeleteQuoteAsync(int id, string requestingUsername);
        Task<Quote?> UpdateQuoteAsync(int id, Quote quote, string requestingUsername);
    }
}
