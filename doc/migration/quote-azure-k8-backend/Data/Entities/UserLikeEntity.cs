using Azure;
using Azure.Data.Tables;

namespace quote_azure_k8_backend.Data.Entities
{
    public class UserLikeEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = string.Empty;
        public string RowKey { get; set; } = string.Empty;
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }

        public string Username { get; set; } = string.Empty;
        public int QuoteId { get; set; }
        public int Order { get; set; }
        public DateTime LikedAt { get; set; }

        public UserLikeEntity() { }

        public UserLikeEntity(string username, int quoteId)
        {
            PartitionKey = username;
            RowKey = $"{username}_{quoteId}";
            Username = username;
            QuoteId = quoteId;
            LikedAt = DateTime.UtcNow;
        }
    }
}
