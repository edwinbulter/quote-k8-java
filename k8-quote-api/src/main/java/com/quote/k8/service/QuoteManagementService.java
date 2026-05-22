package com.quote.k8.service;

import com.quote.k8.dto.QuotePageResponse;
import com.quote.k8.model.Quote;
import com.quote.k8.repository.QuoteRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class QuoteManagementService {

    private static final Logger LOG = Logger.getLogger(QuoteManagementService.class);

    @Inject
    QuoteRepository quoteRepository;

    public QuotePageResponse getQuotes(int page, int pageSize, String quoteText, String author, String sortBy, String sortOrder) {
        LOG.info("Getting quotes with pagination - page: " + page + ", pageSize: " + pageSize + 
                 ", sortBy: " + sortBy + ", sortOrder: " + sortOrder);

        List<Quote> allQuotes = quoteRepository.findAllQuotes();

        // Apply filters
        if (quoteText != null && !quoteText.isBlank()) {
            allQuotes = allQuotes.stream()
                    .filter(q -> q.quoteText != null && q.quoteText.toLowerCase().contains(quoteText.toLowerCase()))
                    .collect(Collectors.toList());
        }

        if (author != null && !author.isBlank()) {
            allQuotes = allQuotes.stream()
                    .filter(q -> q.author != null && q.author.toLowerCase().contains(author.toLowerCase()))
                    .collect(Collectors.toList());
        }

        // Apply sorting
        if (sortBy != null && !sortBy.isBlank()) {
            Comparator<Quote> comparator;
            boolean descending = sortOrder != null && sortOrder.equalsIgnoreCase("desc");

            switch (sortBy.toLowerCase()) {
                case "author":
                    comparator = Comparator.comparing(q -> q.author != null ? q.author.toLowerCase() : "");
                    break;
                case "created":
                    comparator = Comparator.comparing(q -> q.createdAt != null ? q.createdAt : java.time.LocalDateTime.MIN);
                    break;
                case "likes":
                    comparator = Comparator.comparing(q -> q.likeCount != null ? q.likeCount : 0);
                    break;
                case "id":
                default:
                    comparator = Comparator.comparing(q -> q.quoteId != null ? q.quoteId : 0);
                    break;
            }

            if (descending) {
                comparator = comparator.reversed();
            }

            allQuotes = allQuotes.stream()
                    .sorted(comparator)
                    .collect(Collectors.toList());
        } else {
            // Default sort by quoteId ascending
            allQuotes = allQuotes.stream()
                    .sorted(Comparator.comparing(q -> q.quoteId != null ? q.quoteId : 0))
                    .collect(Collectors.toList());
        }

        int totalCount = allQuotes.size();
        int totalPages = (int) Math.ceil((double) totalCount / pageSize);

        // Apply pagination
        int fromIndex = (page - 1) * pageSize;
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Quote> paginatedQuotes = allQuotes.subList(fromIndex, toIndex);

        LOG.info("Returning " + paginatedQuotes.size() + " quotes (total: " + totalCount + ", pages: " + totalPages + ")");

        return new QuotePageResponse(paginatedQuotes, totalCount, page, pageSize, totalPages);
    }
}
