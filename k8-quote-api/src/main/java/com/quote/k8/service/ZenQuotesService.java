package com.quote.k8.service;

import com.quote.k8.model.Quote;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.jboss.logging.Logger;

import java.util.List;

@ApplicationScoped
public class ZenQuotesService {

    private static final Logger LOG = Logger.getLogger(ZenQuotesService.class);

    @Inject
    @org.eclipse.microprofile.rest.client.inject.RestClient
    ZenQuotesClient zenQuotesClient;

    public Quote getRandomQuote() {
        try {
            List<ZenQuoteResponse> responses = zenQuotesClient.getRandom();
            if (responses == null || responses.isEmpty()) {
                throw new IllegalStateException("No quotes returned from ZenQuotes API");
            }
            ZenQuoteResponse response = responses.get(0);
            return mapToQuote(response);
        } catch (Exception e) {
            LOG.error("Error fetching random quote from ZenQuotes", e);
            throw new RuntimeException("Failed to fetch quote from ZenQuotes", e);
        }
    }

    public List<Quote> getMultipleQuotes() {
        try {
            List<ZenQuoteResponse> responses = zenQuotesClient.getQuotes();
            if (responses == null || responses.isEmpty()) {
                LOG.warn("No quotes returned from ZenQuotes API");
                return List.of();
            }
            return responses.stream()
                    .map(this::mapToQuote)
                    .toList();
        } catch (Exception e) {
            LOG.error("Error fetching multiple quotes from ZenQuotes", e);
            throw new RuntimeException("Failed to fetch quotes from ZenQuotes", e);
        }
    }

    private Quote mapToQuote(ZenQuoteResponse response) {
        Quote quote = new Quote();
        quote.quoteText = response.q;
        quote.author = response.a;
        quote.likeCount = 0;
        quote.createdAt = java.time.LocalDateTime.now();
        quote.source = "ZenQuotes";
        return quote;
    }

    @RegisterRestClient(baseUri = "https://zenquotes.io/api")
    public interface ZenQuotesClient {
        @jakarta.ws.rs.GET
        @jakarta.ws.rs.Path("/random")
        @jakarta.ws.rs.Produces(jakarta.ws.rs.core.MediaType.APPLICATION_JSON)
        List<ZenQuoteResponse> getRandom();

        @jakarta.ws.rs.GET
        @jakarta.ws.rs.Path("/quotes")
        @jakarta.ws.rs.Produces(jakarta.ws.rs.core.MediaType.APPLICATION_JSON)
        List<ZenQuoteResponse> getQuotes();
    }

    public static class ZenQuoteResponse {
        public String q;  // quote text
        public String a;  // author
        public String h;  // HTML
    }
}
