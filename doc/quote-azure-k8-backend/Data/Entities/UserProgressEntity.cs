using Azure;
using Azure.Data.Tables;

namespace quote_azure_k8_backend.Data.Entities
{
    public class UserProgressEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = "userprogress";
        public string RowKey { get; set; } = string.Empty;
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }

        public string Username { get; set; } = string.Empty;
        public int LastQuoteId { get; set; }
        public DateTime UpdatedAt { get; set; }

        public UserProgressEntity() { }

        public UserProgressEntity(string username, int lastQuoteId)
        {
            PartitionKey = "userprogress";
            RowKey = username;
            Username = username;
            LastQuoteId = lastQuoteId;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
