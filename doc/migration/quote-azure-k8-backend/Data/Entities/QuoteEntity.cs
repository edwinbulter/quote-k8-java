using Azure;
using Azure.Data.Tables;

namespace quote_azure_k8_backend.Data.Entities
{
    public class QuoteEntity : ITableEntity
    {
        public string PartitionKey { get; set; } = "quotes";
        public string RowKey { get; set; } = string.Empty;
        public DateTimeOffset? Timestamp { get; set; }
        public ETag ETag { get; set; }

        public string QuoteText { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public int LikeCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public string Source { get; set; } = string.Empty;

        public QuoteEntity() { }

        public QuoteEntity(Models.Quote quote)
        {
            RowKey = quote.Id.ToString();
            QuoteText = quote.QuoteText;
            Author = quote.Author;
            LikeCount = quote.LikeCount;
            CreatedAt = quote.CreatedAt;
            Source = quote.Source;
        }

        public Models.Quote ToQuote()
        {
            return new Models.Quote
            {
                Id = int.Parse(RowKey),
                QuoteText = QuoteText,
                Author = Author,
                LikeCount = LikeCount,
                CreatedAt = CreatedAt,
                Source = Source
            };
        }
    }
}
