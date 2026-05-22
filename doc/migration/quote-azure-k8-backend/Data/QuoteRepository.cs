using Azure;
using Azure.Data.Tables;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data.Entities;

namespace quote_azure_k8_backend.Data
{
    public class QuoteRepository : IQuoteRepository
    {
        private readonly TableClient _tableClient;
        private readonly ILogger<QuoteRepository> _logger;

        public QuoteRepository(TableServiceClient tableServiceClient, ILogger<QuoteRepository> logger)
        {
            _tableClient = tableServiceClient.GetTableClient("quotes");
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            
            // Create table asynchronously to avoid blocking startup
            Task.Run(async () => {
                try
                {
                    await _tableClient.CreateIfNotExistsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create quotes table");
                }
            });
        }

        public async Task<Quote?> GetQuoteByIdAsync(int id)
        {
            try
            {
                var response = await _tableClient.GetEntityAsync<QuoteEntity>("quotes", id.ToString());
                return response.Value?.ToQuote();
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting quote by ID: {Id}", id);
                throw;
            }
        }

        public async Task<List<Quote>> GetAllQuotesAsync()
        {
            try
            {
                var quotes = new List<Quote>();
                await foreach (var entity in _tableClient.QueryAsync<QuoteEntity>())
                {
                    quotes.Add(entity.ToQuote());
                }
                return quotes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all quotes");
                throw;
            }
        }

        public async Task<Quote> AddQuoteAsync(Quote quote)
        {
            try
            {
                var entity = new QuoteEntity(quote);
                await _tableClient.AddEntityAsync(entity);
                return entity.ToQuote();
            }
            catch (RequestFailedException ex) when (ex.Status == 409)
            {
                // Quote already exists, return the existing quote
                _logger.LogWarning("Quote with ID {QuoteId} already exists", quote.Id);
                var existingQuote = await GetQuoteByIdAsync(quote.Id);
                return existingQuote ?? quote;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding quote");
                throw;
            }
        }

        public async Task<bool> DeleteQuoteAsync(int id)
        {
            try
            {
                await _tableClient.DeleteEntityAsync("quotes", id.ToString());
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting quote: {Id}", id);
                throw;
            }
        }

        public async Task<bool> UpdateQuoteAsync(Quote quote)
        {
            try
            {
                var entity = new QuoteEntity(quote);
                await _tableClient.UpdateEntityAsync(entity, ETag.All);
                return true;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating quote: {Id}", quote.Id);
                throw;
            }
        }
    }
}
