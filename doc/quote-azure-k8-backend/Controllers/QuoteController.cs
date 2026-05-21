using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Services;
using quote_azure_k8_backend.Middleware;

namespace quote_azure_k8_backend.Controllers
{
    [ApiController]
    [Route("api")]
    public class QuoteController : ControllerBase
    {
        private readonly IQuoteService _quoteService;
        private readonly JwtAuthenticationMiddleware _authMiddleware;

        public QuoteController(IQuoteService quoteService, JwtAuthenticationMiddleware authMiddleware)
        {
            _quoteService = quoteService;
            _authMiddleware = authMiddleware;
        }

        /// <summary>
        /// Get random quote (unauthenticated - no view recording)
        /// </summary>
        [HttpGet("quotes/random")]
        public async Task<ActionResult<Quote>> GetRandomQuote()
        {
            var quote = await _quoteService.GetQuoteAsync(null, new HashSet<int>());
            if (quote == null)
                return NotFound();
            
            return Ok(quote);
        }

        /// <summary>
        /// Get next sequential quote for authenticated user (stores LastQuoteId in userprogress)
        /// </summary>
        [HttpGet("quote")]
        [Authorize]
        public async Task<ActionResult<Quote>> GetQuote()
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            var quote = await _quoteService.GetQuoteAsync(username, new HashSet<int>());
            
            if (quote == null)
                return NotFound();
            
            return Ok(quote);
        }

        /// <summary>
        /// Get random quote with exclusions (unauthenticated)
        /// </summary>
        [HttpPost("quote")]
        public async Task<ActionResult<Quote>> GetQuoteWithExclusions([FromBody] List<int> excludedIds)
        {
            var quote = await _quoteService.GetQuoteAsync(null, new HashSet<int>(excludedIds ?? new List<int>()));
            if (quote == null)
                return NotFound();
            
            return Ok(quote);
        }

        /// <summary>
        /// Get random quote (authenticated - stores LastQuoteId in userprogress)
        /// </summary>
        [HttpGet("quote/authenticated")]
        [Authorize]
        public async Task<ActionResult<Quote>> GetRandomQuoteAuthenticated()
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            var quote = await _quoteService.GetQuoteAsync(username, new HashSet<int>());
            
            if (quote == null)
                return NotFound();
            
            return Ok(quote);
        }

        /// <summary>
        /// Get view history (authenticated)
        /// </summary>
        [HttpGet("quote/viewed")]
        [Authorize]
        public async Task<ActionResult<List<Quote>>> GetViewHistory()
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            var viewedQuotes = await _quoteService.GetViewedQuotesAsync(username);
            return Ok(viewedQuotes);
        }

        /// <summary>
        /// Get progress (authenticated)
        /// </summary>
        [HttpGet("quote/progress")]
        [Authorize]
        public async Task<ActionResult<UserProgress>> GetProgress()
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            var progress = await _quoteService.GetUserProgressAsync(username);
            if (progress == null)
                return NotFound();
            
            return Ok(progress);
        }

        /// <summary>
        /// Get all liked quotes (authenticated)
        /// </summary>
        [HttpGet("quote/liked")]
        [Authorize]
        public async Task<ActionResult<List<Quote>>> GetLikedQuotes()
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            var likedQuotes = await _quoteService.GetLikedQuotesByUserAsync(username);
            return Ok(likedQuotes);
        }

        /// <summary>
        /// Like quote (authenticated)
        /// </summary>
        [HttpPost("quote/{quoteId}/like")]
        [Authorize]
        public async Task<ActionResult<Quote>> LikeQuote(int quoteId)
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            var quote = await _quoteService.LikeQuoteAsync(username, quoteId);
            if (quote == null)
                return NotFound();
            
            return Ok(quote);
        }

        /// <summary>
        /// Unlike quote (authenticated)
        /// </summary>
        [HttpDelete("quote/{quoteId}/unlike")]
        [Authorize]
        public async Task<ActionResult> UnlikeQuote(int quoteId)
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            await _quoteService.UnlikeQuoteAsync(username, quoteId);
            return NoContent();
        }

        /// <summary>
        /// Reorder liked quote (authenticated)
        /// </summary>
        [HttpPut("quote/{quoteId}/reorder")]
        [Authorize]
        public async Task<ActionResult> ReorderLikedQuote(int quoteId, [FromBody] ReorderRequest request)
        {
            var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            await _quoteService.ReorderLikedQuoteAsync(username, quoteId, request.NewPosition);
            return NoContent();
        }
    }

    public class ReorderRequest
    {
        public int NewPosition { get; set; }
    }
}
