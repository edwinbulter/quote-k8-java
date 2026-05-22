using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data;

namespace quote_azure_k8_backend.Services
{
    public class QuoteManagementService : IQuoteManagementService
    {
        private readonly IQuoteRepository _quoteRepository;
        private readonly IUserActivityRepository _userActivityRepository;
        private readonly IZenQuotesService _zenQuotesService;
        private readonly ILogger<QuoteManagementService> _logger;

        public QuoteManagementService(
            IQuoteRepository quoteRepository,
            IUserActivityRepository userActivityRepository,
            IZenQuotesService zenQuotesService,
            ILogger<QuoteManagementService> logger)
        {
            _quoteRepository = quoteRepository;
            _userActivityRepository = userActivityRepository;
            _zenQuotesService = zenQuotesService;
            _logger = logger;
        }

        public async Task<QuotePageResponse> GetQuotesAsync(int page, int pageSize, string? quoteText, string? author, string? sortBy, string? sortOrder)
        {
            try
            {
                var allQuotes = await _quoteRepository.GetAllQuotesAsync();
                
                // Apply filters
                if (!string.IsNullOrEmpty(quoteText))
                {
                    allQuotes = allQuotes.Where(q => q.QuoteText.Contains(quoteText, StringComparison.OrdinalIgnoreCase)).ToList();
                }
                
                if (!string.IsNullOrEmpty(author))
                {
                    allQuotes = allQuotes.Where(q => q.Author.Contains(author, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                // Apply sorting
                if (!string.IsNullOrEmpty(sortBy))
                {
                    switch (sortBy.ToLower())
                    {
                        case "author":
                            allQuotes = sortOrder?.ToLower() == "desc" 
                                ? allQuotes.OrderByDescending(q => q.Author).ToList()
                                : allQuotes.OrderBy(q => q.Author).ToList();
                            break;
                        case "created":
                            allQuotes = sortOrder?.ToLower() == "desc"
                                ? allQuotes.OrderByDescending(q => q.CreatedAt).ToList()
                                : allQuotes.OrderBy(q => q.CreatedAt).ToList();
                            break;
                        case "likes":
                            allQuotes = sortOrder?.ToLower() == "desc"
                                ? allQuotes.OrderByDescending(q => q.LikeCount).ToList()
                                : allQuotes.OrderBy(q => q.LikeCount).ToList();
                            break;
                        default:
                            allQuotes = sortOrder?.ToLower() == "desc"
                                ? allQuotes.OrderByDescending(q => q.Id).ToList()
                                : allQuotes.OrderBy(q => q.Id).ToList();
                            break;
                    }
                }
                else
                {
                    allQuotes = allQuotes.OrderBy(q => q.Id).ToList();
                }

                var totalCount = allQuotes.Count;
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
                var quotes = allQuotes.Skip((page - 1) * pageSize).Take(pageSize).ToList();

                return new QuotePageResponse
                {
                    Quotes = quotes,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = totalPages
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting quotes with pagination");
                throw;
            }
        }

        public async Task<QuoteAddResponse> FetchAndAddNewQuotesAsync(string requestingUsername)
        {
            try
            {
                var newQuotes = await _zenQuotesService.GetMultipleQuotesAsync();
                var addedCount = 0;

                foreach (var quote in newQuotes)
                {
                    // Check if quote already exists (by text and author)
                    var existingQuotes = await _quoteRepository.GetAllQuotesAsync();
                    var exists = existingQuotes.Any(q => 
                        q.QuoteText.Equals(quote.QuoteText, StringComparison.OrdinalIgnoreCase) && 
                        q.Author.Equals(quote.Author, StringComparison.OrdinalIgnoreCase));

                    if (!exists)
                    {
                        // Assign new ID
                        var maxId = existingQuotes.Any() ? existingQuotes.Max(q => q.Id) : 0;
                        quote.Id = maxId + 1;
                        
                        await _quoteRepository.AddQuoteAsync(quote);
                        addedCount++;
                    }
                }

                var totalQuotes = (await _quoteRepository.GetAllQuotesAsync()).Count;

                _logger.LogInformation("Added {AddedCount} new quotes by {Username}", addedCount, requestingUsername);

                return new QuoteAddResponse
                {
                    QuotesAdded = addedCount,
                    TotalQuotes = totalQuotes,
                    Message = $"Successfully added {addedCount} new quotes"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching and adding new quotes");
                throw;
            }
        }

        public async Task<int> GetTotalQuotesCountAsync(string? quoteText = null, string? author = null)
        {
            try
            {
                var allQuotes = await _quoteRepository.GetAllQuotesAsync();
                
                if (!string.IsNullOrEmpty(quoteText))
                {
                    allQuotes = allQuotes.Where(q => q.QuoteText.Contains(quoteText, StringComparison.OrdinalIgnoreCase)).ToList();
                }
                
                if (!string.IsNullOrEmpty(author))
                {
                    allQuotes = allQuotes.Where(q => q.Author.Contains(author, StringComparison.OrdinalIgnoreCase)).ToList();
                }

                return allQuotes.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting total quotes count");
                throw;
            }
        }

        public async Task<int> GetTotalLikesAsync()
        {
            try
            {
                return await _userActivityRepository.GetTotalLikesCountAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting total likes count");
                throw;
            }
        }

        public async Task<Quote?> GetQuoteByIdAsync(int id)
        {
            try
            {
                return await _quoteRepository.GetQuoteByIdAsync(id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting quote by ID: {QuoteId}", id);
                throw;
            }
        }

        public async Task<bool> DeleteQuoteAsync(int id, string requestingUsername)
        {
            try
            {
                var result = await _quoteRepository.DeleteQuoteAsync(id);
                
                if (result)
                {
                    _logger.LogInformation("Quote {QuoteId} deleted by {Username}", id, requestingUsername);
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting quote: {QuoteId}", id);
                throw;
            }
        }

        public async Task<Quote?> UpdateQuoteAsync(int id, Quote quote, string requestingUsername)
        {
            try
            {
                var existingQuote = await _quoteRepository.GetQuoteByIdAsync(id);
                if (existingQuote == null)
                    return null;

                existingQuote.QuoteText = quote.QuoteText;
                existingQuote.Author = quote.Author;
                existingQuote.Source = quote.Source;

                var updatedQuote = await _quoteRepository.UpdateQuoteAsync(existingQuote) ? existingQuote : null;
                
                if (updatedQuote != null)
                {
                    _logger.LogInformation("Quote {QuoteId} updated by {Username}", id, requestingUsername);
                }

                return updatedQuote;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating quote: {QuoteId}", id);
                throw;
            }
        }
    }
}
