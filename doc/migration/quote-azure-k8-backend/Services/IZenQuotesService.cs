using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Services
{
    public interface IZenQuotesService
    {
        Task<Quote> GetRandomQuoteAsync();
        Task<List<Quote>> GetMultipleQuotesAsync();
    }
}
