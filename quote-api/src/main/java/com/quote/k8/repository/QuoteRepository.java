package com.quote.k8.repository;

import com.quote.k8.model.Quote;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class QuoteRepository implements PanacheMongoRepository<Quote> {

    public Optional<Quote> findByQuoteId(Integer quoteId) {
        return find("quoteId", quoteId).firstResultOptional();
    }

    public List<Quote> findAllOrderByQuoteId() {
        return listAll();
    }

    public Integer getMaxQuoteId() {
        List<Quote> quotes = findAllOrderByQuoteId();
        if (quotes.isEmpty()) {
            return 0;
        }
        return quotes.stream()
                .mapToInt(q -> q.quoteId != null ? q.quoteId : 0)
                .max()
                .orElse(0);
    }

    public boolean existsByText(String quoteText) {
        return count("quoteText", quoteText) > 0;
    }

    public List<Quote> findAllQuotes() {
        return findAll().list();
    }

    public List<Quote> findByQuoteTextContainingIgnoreCase(String quoteText) {
        return find("quoteText like ?1", "%" + quoteText + "%").list();
    }

    public List<Quote> findByAuthorContainingIgnoreCase(String author) {
        return find("author like ?1", "%" + author + "%").list();
    }
}
