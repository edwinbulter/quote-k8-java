using quote_azure_k8_backend.Models;
using System.Security.Claims;

namespace quote_azure_k8_backend.Services
{
    public interface IJwtService
    {
        string GenerateToken(User user);
        string GenerateRefreshToken(User user);
        ClaimsPrincipal? ValidateToken(string token);
        string? GetUserIdFromToken(string token);
    }
}
