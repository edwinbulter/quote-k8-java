using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data;

namespace quote_azure_k8_backend.Services
{
    public class QuoteService : IQuoteService
    {
        private readonly IQuoteRepository _quoteRepository;
        private readonly IUserActivityRepository _userActivityRepository;
        private readonly IZenQuotesService _zenQuotesService;
        private readonly ILogger<QuoteService> _logger;

        public QuoteService(
            IQuoteRepository quoteRepository,
            IUserActivityRepository userActivityRepository,
            IZenQuotesService zenQuotesService,
            ILogger<QuoteService> logger)
        {
            _quoteRepository = quoteRepository;
            _userActivityRepository = userActivityRepository;
            _zenQuotesService = zenQuotesService;
            _logger = logger;
        }

        public async Task<Quote?> GetQuoteAsync(string? username, HashSet<int> idsToExclude)
        {
            if (!string.IsNullOrEmpty(username))
            {
                return await GetNextSequentialQuoteAsync(username);
            }
            return await GetRandomQuoteForUnauthenticatedUserAsync(idsToExclude);
        }

        private async Task<Quote?> GetNextSequentialQuoteAsync(string username)
        {
            _logger.LogInformation("Getting next sequential quote for user: {Username}", username);
            
            // Get user's current progress (matching Java implementation)
            var userProgress = await _userActivityRepository.GetUserProgressAsync(username);
            int nextQuoteId;
            
            if (userProgress == null)
            {
                // New user - start with quote ID 1
                nextQuoteId = 1;
                _logger.LogInformation("New user {Username} starting with quote ID: {NextQuoteId}", username, nextQuoteId);
            }
            else
            {
                // Existing user - get next quote
                nextQuoteId = userProgress.LastQuoteId + 1;
                _logger.LogInformation("User {Username} progress: lastQuoteId={LastQuoteId}, nextQuoteId={NextQuoteId}", 
                    username, userProgress.LastQuoteId, nextQuoteId);
            }
            
            // Check if we need to fetch more quotes
            var allQuotes = await _quoteRepository.GetAllQuotesAsync();
            int maxId = allQuotes.Any() ? allQuotes.Max(q => q.Id) : 0;
            
            if (nextQuoteId > maxId)
            {
                _logger.LogInformation("Next quote ID {NextQuoteId} exceeds max ID {MaxId}, fetching more quotes", 
                    nextQuoteId, maxId);
                await FetchMoreQuotesIfNeededAsync();
                allQuotes = await _quoteRepository.GetAllQuotesAsync();
                maxId = allQuotes.Any() ? allQuotes.Max(q => q.Id) : 0;
            }
            
            // Get the quote
            var quote = await _quoteRepository.GetQuoteByIdAsync(nextQuoteId);
            if (quote == null)
            {
                _logger.LogWarning("Quote with ID {NextQuoteId} not found, finding next available quote", nextQuoteId);
                quote = await FindNextAvailableQuoteAsync(nextQuoteId);
            }
            
            if (quote != null)
            {
                // Update user progress (matching Java implementation)
                await _userActivityRepository.UpdateLastQuoteIdAsync(username, quote.Id);
                _logger.LogInformation("Updated user {Username} progress to lastQuoteId={LastQuoteId}", 
                    username, quote.Id);
            }
            
            return quote;
        }

        private async Task<Quote?> GetRandomQuoteForUnauthenticatedUserAsync(HashSet<int> idsToExclude)
        {
            _logger.LogInformation("Getting random quote for unauthenticated user, excluding {Count} IDs", idsToExclude.Count);
            
            var allQuotes = await _quoteRepository.GetAllQuotesAsync();
            int maxId = allQuotes.Any() ? allQuotes.Max(q => q.Id) : 0;
            _logger.LogInformation("Max quote ID in database: {MaxId}", maxId);
            
            if (maxId < 5 || maxId <= idsToExclude.Count)
            {
                _logger.LogInformation("Need to fetch more quotes (maxId={MaxId}, excludeCount={ExcludeCount})", maxId, idsToExclude.Count);
                await FetchMoreQuotesIfNeededAsync();
                allQuotes = await _quoteRepository.GetAllQuotesAsync();
                maxId = allQuotes.Any() ? allQuotes.Max(q => q.Id) : 0;
                _logger.LogInformation("After fetching, new max ID: {MaxId}", maxId);
            }
            
            var random = new Random();
            int maxAttempts = Math.Min(100, maxId);
            var attemptedIds = new HashSet<int>();
            
            for (int attempt = 0; attempt < maxAttempts; attempt++)
            {
                int candidateId = random.Next(maxId) + 1;
                if (idsToExclude.Contains(candidateId) || attemptedIds.Contains(candidateId))
                    continue;
                
                attemptedIds.Add(candidateId);
                var quote = await _quoteRepository.GetQuoteByIdAsync(candidateId);
                if (quote != null)
                    return quote;
            }
            
            var filteredQuotes = allQuotes.Where(q => !idsToExclude.Contains(q.Id)).ToList();
            if (!filteredQuotes.Any())
            {
                _logger.LogWarning("No available quotes after excluding {Count} IDs", idsToExclude.Count);
                return null;
            }
            
            return filteredQuotes[random.Next(filteredQuotes.Count)];
        }

        private async Task FetchMoreQuotesIfNeededAsync()
        {
            try
            {
                _logger.LogInformation("Fetching quotes from ZenQuotes API");
                var fetchedQuotes = await _zenQuotesService.GetMultipleQuotesAsync();
                _logger.LogInformation("Fetched {Count} quotes from ZenQuotes", fetchedQuotes?.Count ?? 0);
                
                var currentDatabaseQuotes = await _quoteRepository.GetAllQuotesAsync();
                _logger.LogInformation("Current database has {Count} quotes", currentDatabaseQuotes.Count);
                
                var existingTexts = new HashSet<string>(currentDatabaseQuotes.Select(q => q.QuoteText));
                int nextId = currentDatabaseQuotes.Any() ? currentDatabaseQuotes.Max(q => q.Id) + 1 : 1;
                
                int addedCount = 0;
                if (fetchedQuotes != null)
                {
                    foreach (var quote in fetchedQuotes)
                    {
                        if (!existingTexts.Contains(quote.QuoteText))
                        {
                            var originalId = quote.Id;
                            quote.Id = nextId++;
                            _logger.LogInformation("Assigning new ID: {NewId} to quote (original ID: {OriginalId})", quote.Id, originalId);
                            await _quoteRepository.AddQuoteAsync(quote);
                            existingTexts.Add(quote.QuoteText);
                            addedCount++;
                        }
                    }
                }
                
                _logger.LogInformation("Added {Count} new quotes to database", addedCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch quotes from ZenQuotes");
            }
        }

        private async Task<Quote?> FindNextAvailableQuoteAsync(int startId)
        {
            var allQuotes = await _quoteRepository.GetAllQuotesAsync();
            int maxId = allQuotes.Any() ? allQuotes.Max(q => q.Id) : 0;
            
            for (int id = startId; id <= maxId; id++)
            {
                var quote = await _quoteRepository.GetQuoteByIdAsync(id);
                if (quote != null)
                    return quote;
            }
            return null;
        }

        public async Task<Quote?> GetQuoteByIdAsync(string? username, int quoteId)
        {
            return await _quoteRepository.GetQuoteByIdAsync(quoteId);
        }

        public async Task<Quote?> LikeQuoteAsync(string username, int quoteId)
        {
            var quote = await _quoteRepository.GetQuoteByIdAsync(quoteId);
            if (quote != null)
            {
                await _userActivityRepository.AddUserLikeAsync(username, quoteId);
            }
            return quote;
        }

        public async Task UnlikeQuoteAsync(string username, int quoteId)
        {
            await _userActivityRepository.RemoveUserLikeAsync(username, quoteId);
        }

        public async Task<List<Quote>> GetLikedQuotesByUserAsync(string username)
        {
            var allLikes = await _userActivityRepository.GetAllUserLikesAsync(username);
            var likedQuotes = new List<Quote>();
            foreach (var like in allLikes.OrderBy(l => l.Order))
            {
                var quote = await _quoteRepository.GetQuoteByIdAsync(like.QuoteId);
                if (quote != null)
                    likedQuotes.Add(quote);
            }
            return likedQuotes;
        }

        public async Task<List<Quote>> GetViewedQuotesAsync(string username)
        {
            // Return quotes 1 to lastQuoteId using the sequential system (matching Java implementation)
            _logger.LogInformation("Getting viewed quotes for user: {Username}", username);
            
            if (string.IsNullOrEmpty(username))
            {
                return new List<Quote>();
            }
            
            var progress = await _userActivityRepository.GetUserProgressAsync(username);
            if (progress == null || progress.LastQuoteId <= 0)
            {
                _logger.LogInformation("User {Username} has no progress or hasn't viewed any quotes", username);
                return new List<Quote>();
            }
            
            var viewedQuotes = new List<Quote>();
            for (int i = 1; i <= progress.LastQuoteId; i++)
            {
                var quote = await _quoteRepository.GetQuoteByIdAsync(i);
                if (quote != null)
                {
                    viewedQuotes.Add(quote);
                }
                else
                {
                    _logger.LogWarning("Quote with ID {QuoteId} not found while getting viewed quotes for user {Username}", i, username);
                }
            }
            
            _logger.LogInformation("Retrieved {Count} viewed quotes for user {Username}", viewedQuotes.Count, username);
            return viewedQuotes;
        }

        public async Task ReorderLikedQuoteAsync(string username, int quoteId, int newOrder)
        {
            try
            {
                await _userActivityRepository.UpdateUserLikeOrderAsync(username, quoteId, newOrder);
                _logger.LogInformation("User {Username} reordered quote {QuoteId} to position {NewOrder}", username, quoteId, newOrder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reordering liked quote for user: {Username}, quote: {QuoteId}", username, quoteId);
                throw;
            }
        }

        public async Task<UserProgress?> GetUserProgressAsync(string username)
        {
            try
            {
                return await _userActivityRepository.GetUserProgressAsync(username);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user progress for user: {Username}", username);
                throw;
            }
        }

        private void RecordQuoteViewAsync(string username, int quoteId)
        {
            // Quote views are tracked via UserProgress.LastQuoteId, not separate view records
            _logger.LogDebug("Recording quote view for user: {Username}, quote: {QuoteId}", username, quoteId);
        }

        private async Task UpdateLastQuoteIdAsync(string username, int quoteId)
        {
            await _userActivityRepository.UpdateLastQuoteIdAsync(username, quoteId);
        }
    }
}
