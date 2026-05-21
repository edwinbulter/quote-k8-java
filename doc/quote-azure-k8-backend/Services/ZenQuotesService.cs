using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data;
using System.Net.Http.Json;
using System.Text.Json;

namespace quote_azure_k8_backend.Services
{
    public class ZenQuotesService : IZenQuotesService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<ZenQuotesService> _logger;
        private readonly IQuoteRepository _quoteRepository;

        public ZenQuotesService(HttpClient httpClient, ILogger<ZenQuotesService> logger, IQuoteRepository quoteRepository)
        {
            _httpClient = httpClient;
            _logger = logger;
            _quoteRepository = quoteRepository;
            _httpClient.BaseAddress = new Uri("https://zenquotes.io/api/");
        }

        public async Task<Quote> GetRandomQuoteAsync()
        {
            try
            {
                var response = await _httpClient.GetFromJsonAsync<ZenQuoteResponse[]>("random");
                if (response == null || response.Length == 0)
                {
                    _logger.LogWarning("No quotes returned from ZenQuotes API");
                    throw new InvalidOperationException("No quotes available from external API");
                }

                var zenQuote = response[0];
                return new Quote
                {
                    QuoteText = zenQuote.q,
                    Author = zenQuote.a,
                    LikeCount = 0,
                    CreatedAt = DateTime.UtcNow,
                    Source = "ZenQuotes"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching random quote from ZenQuotes API");
                throw;
            }
        }

        public async Task<List<Quote>> GetMultipleQuotesAsync()
        {
            try
            {
                var response = await _httpClient.GetFromJsonAsync<ZenQuoteResponse[]>("quotes");
                if (response == null || response.Length == 0)
                {
                    _logger.LogWarning("No quotes returned from ZenQuotes API");
                    return new List<Quote>();
                }

                var quotes = new List<Quote>();
                foreach (var zenQuote in response)
                {
                    quotes.Add(new Quote
                    {
                        QuoteText = zenQuote.q,
                        Author = zenQuote.a,
                        LikeCount = 0,
                        CreatedAt = DateTime.UtcNow,
                        Source = "ZenQuotes"
                    });
                }

                return quotes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching multiple quotes from ZenQuotes API");
                throw;
            }
        }
    }

    public class ZenQuoteResponse
    {
        public string q { get; set; } = string.Empty; // quote text
        public string a { get; set; } = string.Empty; // author
        public string h { get; set; } = string.Empty; // HTML
    }
}
