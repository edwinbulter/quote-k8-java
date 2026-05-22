using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Data
{
    public interface IQuoteRepository
    {
        Task<Quote?> GetQuoteByIdAsync(int id);
        Task<List<Quote>> GetAllQuotesAsync();
        Task<Quote> AddQuoteAsync(Quote quote);
        Task<bool> DeleteQuoteAsync(int id);
        Task<bool> UpdateQuoteAsync(Quote quote);
    }
}
