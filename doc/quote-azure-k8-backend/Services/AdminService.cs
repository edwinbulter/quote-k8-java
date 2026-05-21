using Microsoft.Extensions.Logging;
using quote_azure_k8_backend.Models.Admin;
using quote_azure_k8_backend.Models;
using quote_azure_k8_backend.Data;

namespace quote_azure_k8_backend.Services
{
    public class AdminService : IAdminService
    {
        private readonly IUserRepository _userRepository;
        private readonly IQuoteRepository _quoteRepository;
        private readonly IUserActivityRepository _userActivityRepository;
        private readonly IUserRoleRepository _userRoleRepository;
        private readonly IQuoteManagementService _quoteManagementService;
        private readonly ILogger<AdminService> _logger;

        public AdminService(
            IUserRepository userRepository,
            IQuoteRepository quoteRepository,
            IUserActivityRepository userActivityRepository,
            IUserRoleRepository userRoleRepository,
            IQuoteManagementService quoteManagementService,
            ILogger<AdminService> logger)
        {
            _userRepository = userRepository;
            _quoteRepository = quoteRepository;
            _userActivityRepository = userActivityRepository;
            _userRoleRepository = userRoleRepository;
            _quoteManagementService = quoteManagementService;
            _logger = logger;
        }

        public async Task<List<AdminUserInfo>> ListAllUsersAsync()
        {
            try
            {
                var users = await _userRepository.GetAllAsync();
                var allRoles = await _userRoleRepository.GetAllUserRolesAsync();
                var rolesByUser = allRoles.GroupBy(r => r.Username)
                                         .ToDictionary(g => g.Key, g => g.Select(r => r.Role).ToArray());

                var userInfos = new List<AdminUserInfo>();

                foreach (var user in users)
                {
                    var roleList = rolesByUser.TryGetValue(user.Username, out var roles) 
                                  ? roles 
                                  : new[] { "USER" };

                    userInfos.Add(new AdminUserInfo
                    {
                        Username = user.Username,
                        Email = user.Email,
                        Roles = roleList,
                        Enabled = user.IsActive,
                        UserStatus = user.IsActive ? "Active" : "Inactive",
                        UserCreateDate = user.CreatedAt.ToString("yyyy-MM-dd"),
                        UserLastModifiedDate = user.UpdatedAt.ToString("yyyy-MM-dd")
                    });
                }

                return userInfos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing all users");
                throw;
            }
        }

        public async Task<QuotePageResponse> GetQuotesAsync(int page, int pageSize, string? quoteText, string? author, string? sortBy, string? sortOrder)
        {
            return await _quoteManagementService.GetQuotesAsync(page, pageSize, quoteText, author, sortBy, sortOrder);
        }

        public async Task<QuoteAddResponse> FetchAndAddNewQuotesAsync(string requestingUsername)
        {
            return await _quoteManagementService.FetchAndAddNewQuotesAsync(requestingUsername);
        }

        public async Task<int> GetTotalLikesAsync()
        {
            return await _userActivityRepository.GetTotalLikesCountAsync();
        }

        public async Task<bool> DeleteQuoteAsync(int id, string requestingUsername)
        {
            return await _quoteManagementService.DeleteQuoteAsync(id, requestingUsername);
        }

        public async Task<Quote?> UpdateQuoteAsync(int id, Quote quote, string requestingUsername)
        {
            return await _quoteManagementService.UpdateQuoteAsync(id, quote, requestingUsername);
        }
    }
}
