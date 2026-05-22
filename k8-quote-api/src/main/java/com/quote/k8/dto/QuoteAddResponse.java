package com.quote.k8.dto;

public class QuoteAddResponse {
    public int quotesAdded;
    public int totalQuotes;
    public String message;

    // Constructors
    public QuoteAddResponse() {}

    public QuoteAddResponse(int quotesAdded, int totalQuotes, String message) {
        this.quotesAdded = quotesAdded;
        this.totalQuotes = totalQuotes;
        this.message = message;
    }
}
