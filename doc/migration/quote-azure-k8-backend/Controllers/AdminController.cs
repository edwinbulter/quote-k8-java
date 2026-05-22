using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Models.Auth;
using quote_azure_k8_backend.Services;
using quote_azure_k8_backend.Middleware;

namespace quote_azure_k8_backend.Controllers
{
    [ApiController]
    [Route("api/manage")]
    [Authorize(Roles = "ADMIN")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _adminService;
        private readonly IUserService _userService;
        private readonly JwtAuthenticationMiddleware _authMiddleware;

        public AdminController(IAdminService adminService, IUserService userService, JwtAuthenticationMiddleware authMiddleware)
        {
            _adminService = adminService;
            _userService = userService;
            _authMiddleware = authMiddleware;
        }

        /// <summary>
        /// Get all users (admin only)
        /// </summary>
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<Models.Admin.AdminUserInfo>>> GetAllUsers()
        {
            try
            {
                var adminId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var users = await _userService.GetAllUsersAsync(adminId);
                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while retrieving users");
            }
        }

        /// <summary>
        /// Get quotes with pagination (admin only)
        /// </summary>
        [HttpGet("quotes")]
        public async Task<ActionResult<QuotePageResponse>> GetQuotes(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? sortBy = "id",
            [FromQuery] string? sortOrder = "asc",
            [FromQuery] string? quoteText = null,
            [FromQuery] string? author = null)
        {
            try
            {
                var quotes = await _adminService.GetQuotesAsync(page, pageSize, quoteText, author, sortBy, sortOrder);
                return Ok(quotes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while retrieving quotes");
            }
        }

        /// <summary>
        /// Fetch quotes from external API (admin only)
        /// </summary>
        [HttpPost("quotes/fetch")]
        public async Task<ActionResult<QuoteAddResponse>> FetchQuotes()
        {
            var username = User.FindFirst("unique_name")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(username))
                return Unauthorized();

            try
            {
                var result = await _adminService.FetchAndAddNewQuotesAsync(username);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while fetching quotes");
            }
        }

        /// <summary>
        /// Get system statistics (admin only)
        /// </summary>
        [HttpGet("stats")]
        public async Task<ActionResult<object>> GetStats()
        {
            try
            {
                var totalLikes = await _adminService.GetTotalLikesAsync();
                return Ok(new { TotalLikes = totalLikes });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while retrieving statistics");
            }
        }

        /// <summary>
        /// Update user role (admin only)
        /// </summary>
        [HttpPut("users/role")]
        public async Task<ActionResult> UpdateUserRole([FromBody] UpdateRoleRequest request)
        {
            try
            {
                var result = await _userService.UpdateUserRoleAsync(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, request);
                if (result)
                    return Ok("User role updated successfully");
                else
                    return BadRequest("Failed to update user role");
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while updating user role");
            }
        }

        /// <summary>
        /// Remove user role (admin only)
        /// </summary>
        [HttpDelete("users/role")]
        public async Task<ActionResult> RemoveUserRole([FromBody] UpdateRoleRequest request)
        {
            try
            {
                var result = await _userService.RemoveUserRoleAsync(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, request);
                if (result)
                    return Ok("User role removed successfully");
                else
                    return BadRequest("Failed to remove user role");
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while removing user role");
            }
        }

        /// <summary>
        /// Delete user account (admin only)
        /// </summary>
        [HttpDelete("users/delete")]
        public async Task<ActionResult> DeleteUserAccount([FromBody] RemoveUserAccountRequest request)
        {
            try
            {
                var targetUser = await _userService.GetUserByUsernameAsync(request.Username);
                if (targetUser == null)
                    return NotFound("User not found");

                var result = await _userService.DeleteUserAsync(targetUser.Id);
                if (result)
                    return Ok("User account deleted successfully");
                else
                    return BadRequest("Failed to delete user account");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while deleting user account");
            }
        }
    }

    public class RemoveUserAccountRequest
    {
        public string Username { get; set; } = string.Empty;
    }
}
