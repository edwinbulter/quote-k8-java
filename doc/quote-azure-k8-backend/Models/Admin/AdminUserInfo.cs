namespace quote_azure_k8_backend.Models.Admin
{
    public class AdminUserInfo
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string[] Roles { get; set; } = new string[0];
        public bool Enabled { get; set; }
        public string UserStatus { get; set; } = string.Empty;
        public string? UserCreateDate { get; set; }
        public string? UserLastModifiedDate { get; set; }
    }
}
