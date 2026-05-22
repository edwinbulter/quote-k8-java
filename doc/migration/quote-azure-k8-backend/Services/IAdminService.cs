using quote_azure_k8_backend.Models.Admin;
using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Services
{
    public interface IAdminService
    {
        Task<List<AdminUserInfo>> ListAllUsersAsync();
        Task<QuotePageResponse> GetQuotesAsync(int page, int pageSize, string? quoteText, string? author, string? sortBy, string? sortOrder);
        Task<QuoteAddResponse> FetchAndAddNewQuotesAsync(string requestingUsername);
        Task<int> GetTotalLikesAsync();
        Task<bool> DeleteQuoteAsync(int id, string requestingUsername);
        Task<Quote?> UpdateQuoteAsync(int id, Quote quote, string requestingUsername);
    }
}
