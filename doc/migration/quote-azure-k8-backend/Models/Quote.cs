namespace quote_azure_k8_backend.Models
{
    public class Quote
    {
        public int Id { get; set; }
        public string QuoteText { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public int LikeCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public string Source { get; set; } = "Local";
    }
}
