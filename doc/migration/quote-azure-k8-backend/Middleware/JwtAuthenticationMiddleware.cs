using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Models.Auth;
using quote_azure_k8_backend.Services;
using System.Security.Claims;

namespace quote_azure_k8_backend.Middleware
{
    public class JwtAuthenticationMiddleware
    {
        private readonly IJwtService _jwtService;
        private readonly ILogger<JwtAuthenticationMiddleware> _logger;

        public JwtAuthenticationMiddleware(IJwtService jwtService, ILogger<JwtAuthenticationMiddleware> logger)
        {
            _jwtService = jwtService;
            _logger = logger;
        }

        public string? GetUserIdFromTokenAsync(HttpRequest request)
        {
            try
            {
                var authHeader = request.Headers["Authorization"].FirstOrDefault();
                
                if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
                {
                    _logger.LogWarning("No valid Authorization header found");
                    return null;
                }

                var token = authHeader.Substring("Bearer ".Length).Trim();
                var userId = _jwtService.GetUserIdFromToken(token);
                
                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("Token validation failed");
                    return null;
                }

                return userId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during authentication");
                return null;
            }
        }

        public string? GetUsernameFromTokenAsync(HttpRequest request)
        {
            try
            {
                var authHeader = request.Headers["Authorization"].FirstOrDefault();
                
                if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
                {
                    return null;
                }

                var token = authHeader.Substring("Bearer ".Length).Trim();
                var principal = _jwtService.ValidateToken(token);
                
                if (principal == null)
                {
                    return null;
                }

                return principal.FindFirst(ClaimTypes.Name)?.Value;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting username from token");
                return null;
            }
        }

        public bool IsUserAdmin(HttpRequest request)
        {
            try
            {
                var authHeader = request.Headers["Authorization"].FirstOrDefault();
                
                if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
                {
                    return false;
                }

                var token = authHeader.Substring("Bearer ".Length).Trim();
                var principal = _jwtService.ValidateToken(token);
                
                if (principal == null)
                {
                    return false;
                }

                var roles = principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
                return roles.Contains("ADMIN");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking admin role");
                return false;
            }
        }
    }
}
