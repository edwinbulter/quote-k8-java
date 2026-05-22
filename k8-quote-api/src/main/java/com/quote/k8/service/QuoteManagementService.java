package com.quote.k8.service;

import com.quote.k8.dto.QuoteAddResponse;
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

    @Inject
    ZenQuotesService zenQuotesService;

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

    public QuoteAddResponse fetchAndAddNewQuotes(String requestingUsername) {
        LOG.info("Fetching and adding new quotes for user: " + requestingUsername);

        try {
            List<Quote> newQuotes = zenQuotesService.getMultipleQuotes();
            int addedCount = 0;

            List<Quote> existingQuotes = quoteRepository.findAllQuotes();

            for (Quote quote : newQuotes) {
                // Check if quote already exists (by text and author, case-insensitive)
                boolean exists = existingQuotes.stream()
                        .anyMatch(q -> q.quoteText != null && q.quoteText.equalsIgnoreCase(quote.quoteText)
                                && q.author != null && q.author.equalsIgnoreCase(quote.author));

                if (!exists) {
                    // Assign new ID
                    int maxId = existingQuotes.stream()
                            .mapToInt(q -> q.quoteId != null ? q.quoteId : 0)
                            .max()
                            .orElse(0);
                    quote.quoteId = maxId + 1;

                    quoteRepository.persist(quote);
                    addedCount++;
                    existingQuotes.add(quote); // Add to list to avoid duplicates in same batch
                }
            }

            int totalQuotes = quoteRepository.findAllQuotes().size();

            LOG.info("Added " + addedCount + " new quotes by " + requestingUsername);

            return new QuoteAddResponse(
                    addedCount,
                    totalQuotes,
                    "Successfully added " + addedCount + " new quotes"
            );
        } catch (Exception e) {
            LOG.error("Error fetching and adding new quotes", e);
            throw new RuntimeException("Failed to fetch and add quotes", e);
        }
    }
}
