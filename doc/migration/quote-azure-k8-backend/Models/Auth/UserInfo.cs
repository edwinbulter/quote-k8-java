namespace quote_azure_k8_backend.Models.Auth
{
    public class UserInfo
    {
        public string ObjectId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public List<string> Groups { get; set; } = new List<string>();
        public bool IsAuthenticated { get; set; }
    }
}
