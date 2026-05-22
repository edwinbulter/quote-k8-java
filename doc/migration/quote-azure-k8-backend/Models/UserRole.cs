namespace quote_azure_k8_backend.Models
{
    public class UserRole
    {
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty; // "USER", "ADMIN", etc.
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string? UpdatedBy { get; set; }
    }
}
