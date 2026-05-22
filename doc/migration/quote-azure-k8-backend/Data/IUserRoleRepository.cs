using quote_azure_k8_backend.Models;

namespace quote_azure_k8_backend.Data
{
    public interface IUserRoleRepository
    {
        Task<UserRole?> GetUserRoleAsync(string username);
        Task<List<UserRole>> GetUserRolesAsync(string username);
        Task<List<UserRole>> GetAllUserRolesAsync();
        Task<UserRole> CreateUserRoleAsync(UserRole userRole);
        Task<UserRole> UpdateUserRoleAsync(UserRole userRole);
        Task<bool> DeleteUserRoleAsync(string username);
        Task<bool> UserHasRoleAsync(string username, string role);
    }
}
