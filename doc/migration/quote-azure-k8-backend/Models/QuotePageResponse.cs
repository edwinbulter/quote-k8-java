namespace quote_azure_k8_backend.Models
{
    public class QuotePageResponse
    {
        public List<Quote> Quotes { get; set; } = new List<Quote>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
}
