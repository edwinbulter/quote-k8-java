package com.quote.k8.dto;

import com.quote.k8.model.Quote;
import java.util.List;

public class QuotePageResponse {
    public List<Quote> quotes;
    public int totalCount;
    public int page;
    public int pageSize;
    public int totalPages;

    // Constructors
    public QuotePageResponse() {}

    public QuotePageResponse(List<Quote> quotes, int totalCount, int page, int pageSize, int totalPages) {
        this.quotes = quotes;
        this.totalCount = totalCount;
        this.page = page;
        this.pageSize = pageSize;
        this.totalPages = totalPages;
    }
}
