using Microsoft.AspNetCore.Mvc;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Models.Auth;
using quote_azure_k8_backend.Services;

namespace quote_azure_k8_backend.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IUserService _userService;

        public AuthController(IUserService userService)
        {
            _userService = userService;
        }

        /// <summary>
        /// Register a new user
        /// </summary>
        [HttpPost("register")]
        public async Task<ActionResult<User>> Register([FromBody] RegisterRequest request)
        {
            try
            {
                var user = await _userService.RegisterAsync(request);
                return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while registering the user");
            }
        }

        /// <summary>
        /// Login user and return JWT token
        /// </summary>
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            try
            {
                var token = await _userService.LoginAsync(request);
                return Ok(new LoginResponse { Token = token });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized("Invalid credentials");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred during login");
            }
        }

        /// <summary>
        /// Change password (authenticated)
        /// </summary>
        [HttpPost("change-password")]
        public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            try
            {
                var result = await _userService.ChangePasswordAsync(userId, request);
                if (result)
                    return Ok("Password changed successfully");
                else
                    return BadRequest("Failed to change password");
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized("Current password is incorrect");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while changing password");
            }
        }

        /// <summary>
        /// Unregister user (delete account and all data)
        /// </summary>
        [HttpDelete("unregister")]
        public async Task<ActionResult> Unregister([FromBody] UnregisterRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            try
            {
                var result = await _userService.UnregisterAsync(userId, request.Password);
                if (result)
                    return Ok("Account deleted successfully");
                else
                    return BadRequest("Failed to delete account");
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized("Invalid password");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while deleting account");
            }
        }

        /// <summary>
        /// Get user by ID (helper method)
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(string id)
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
                return NotFound();
            
            return Ok(user);
        }
    }

    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
    }
}
