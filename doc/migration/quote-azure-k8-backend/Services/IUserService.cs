using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Models.Auth;

namespace quote_azure_k8_backend.Services
{
    public interface IUserService
    {
        Task<User> RegisterAsync(RegisterRequest request);
        Task<string> LoginAsync(LoginRequest request);
        Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request);
        Task<bool> UpdateUserRoleAsync(string adminId, UpdateRoleRequest request);
        Task<bool> RemoveUserRoleAsync(string adminId, UpdateRoleRequest request);
        Task<User?> GetUserByIdAsync(string id);
        Task<User?> GetUserByUsernameAsync(string username);
        Task<IEnumerable<Models.Admin.AdminUserInfo>> GetAllUsersAsync(string adminId);
        Task<bool> IsUserInRoleAsync(string userId, string role);
        Task<bool> IsAdminAsync(string userId);
        Task<bool> UnregisterAsync(string userId, string password);
        Task<bool> DeleteUserAsync(string userId);
    }
}
