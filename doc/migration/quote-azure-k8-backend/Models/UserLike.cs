namespace quote_azure_k8_backend.Models
{
    public class UserLike
    {
        public string Username { get; set; } = string.Empty;
        public int QuoteId { get; set; }
        public int Order { get; set; }
        public DateTime LikedAt { get; set; }
    }
}
