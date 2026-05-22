package com.quote.k8.service;

import com.quote.k8.model.Quote;
import com.quote.k8.model.UserProgress;
import com.quote.k8.repository.QuoteRepository;
import com.quote.k8.repository.UserProgressRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

@ApplicationScoped
public class QuoteService {

    private static final Logger LOG = Logger.getLogger(QuoteService.class);

    @Inject
    QuoteRepository quoteRepository;

    @Inject
    ZenQuotesService zenQuotesService;

    @Inject
    UserProgressRepository userProgressRepository;

    public Quote getRandomQuote() {
        return getRandomQuote(new HashSet<>());
    }

    public Quote getRandomQuote(Set<Integer> idsToExclude) {
        LOG.info("Getting random quote, excluding " + idsToExclude.size() + " IDs");
        
        int maxId = quoteRepository.getMaxQuoteId();
        LOG.info("Max quote ID in database: " + maxId);
        
        // Fetch more quotes if database is empty or has too few quotes
        if (maxId < 5 || maxId <= idsToExclude.size()) {
            LOG.info("Need to fetch more quotes (maxId=" + maxId + ", excludeCount=" + idsToExclude.size() + ")");
            fetchMoreQuotesIfNeeded();
            maxId = quoteRepository.getMaxQuoteId();
            LOG.info("After fetching, new max ID: " + maxId);
        }
        
        // Try to find a random quote not in exclusion list
        Random random = new Random();
        int maxAttempts = Math.min(100, maxId);
        Set<Integer> attemptedIds = new HashSet<>();
        
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            int candidateId = random.nextInt(maxId) + 1;
            if (idsToExclude.contains(candidateId) || attemptedIds.contains(candidateId)) {
                continue;
            }
            
            attemptedIds.add(candidateId);
            var quote = quoteRepository.findByQuoteId(candidateId);
            if (quote.isPresent()) {
                return quote.get();
            }
        }
        
        // Fallback: get all quotes and filter
        List<Quote> allQuotes = quoteRepository.findAllOrderByQuoteId();
        List<Quote> filteredQuotes = allQuotes.stream()
                .filter(q -> !idsToExclude.contains(q.quoteId))
                .toList();
        
        if (filteredQuotes.isEmpty()) {
            LOG.warn("No available quotes after excluding " + idsToExclude.size() + " IDs");
            throw new IllegalStateException("No quotes available");
        }
        
        return filteredQuotes.get(random.nextInt(filteredQuotes.size()));
    }

    public Quote getNextQuoteForUser(String username) {
        LOG.info("Getting next sequential quote for user: " + username);

        Optional<UserProgress> progressOpt = userProgressRepository.findByUsername(username);
        int nextQuoteId;

        if (progressOpt.isEmpty()) {
            nextQuoteId = 1;
            LOG.info("New user " + username + " starting with quote ID: " + nextQuoteId);
        } else {
            nextQuoteId = progressOpt.get().lastQuoteId + 1;
            LOG.info("User " + username + " progress: lastQuoteId=" + progressOpt.get().lastQuoteId + ", nextQuoteId=" + nextQuoteId);
        }

        // Fetch more quotes if needed
        int maxId = quoteRepository.getMaxQuoteId();
        if (nextQuoteId > maxId) {
            LOG.info("Next quote ID " + nextQuoteId + " exceeds max ID " + maxId + ", fetching more quotes");
            fetchMoreQuotesIfNeeded();
            maxId = quoteRepository.getMaxQuoteId();
        }

        // Get the quote by ID, find next available if missing
        Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(nextQuoteId);
        Quote quote = quoteOpt.orElseGet(() -> findNextAvailableQuote(nextQuoteId));

        if (quote == null) {
            LOG.warn("No quote found starting from ID: " + nextQuoteId);
            throw new IllegalStateException("No quotes available");
        }

        // Update user progress
        updateUserProgress(username, quote.quoteId, progressOpt.orElse(null));
        LOG.info("Updated user " + username + " progress to lastQuoteId=" + quote.quoteId);

        return quote;
    }

    private Quote findNextAvailableQuote(int startId) {
        int maxId = quoteRepository.getMaxQuoteId();
        for (int id = startId; id <= maxId; id++) {
            Optional<Quote> quote = quoteRepository.findByQuoteId(id);
            if (quote.isPresent()) {
                return quote.get();
            }
        }
        return null;
    }

    private void updateUserProgress(String username, int quoteId, UserProgress existing) {
        if (existing == null) {
            userProgressRepository.persist(new UserProgress(username, quoteId));
        } else {
            existing.lastQuoteId = quoteId;
            existing.updatedAt = LocalDateTime.now();
            userProgressRepository.update(existing);
        }
    }

    private void fetchMoreQuotesIfNeeded() {
        try {
            LOG.info("Fetching quotes from ZenQuotes API");
            List<Quote> fetchedQuotes = zenQuotesService.getMultipleQuotes();
            LOG.info("Fetched " + (fetchedQuotes != null ? fetchedQuotes.size() : 0) + " quotes from ZenQuotes");
            
            List<Quote> currentDatabaseQuotes = quoteRepository.findAllOrderByQuoteId();
            LOG.info("Current database has " + currentDatabaseQuotes.size() + " quotes");
            
            Set<String> existingTexts = new HashSet<>();
            currentDatabaseQuotes.forEach(q -> existingTexts.add(q.quoteText));
            
            int nextId = quoteRepository.getMaxQuoteId() + 1;
            int addedCount = 0;
            
            if (fetchedQuotes != null) {
                for (Quote quote : fetchedQuotes) {
                    if (!existingTexts.contains(quote.quoteText)) {
                        quote.quoteId = nextId++;
                        LOG.info("Assigning new ID: " + quote.quoteId + " to quote");
                        quoteRepository.persist(quote);
                        existingTexts.add(quote.quoteText);
                        addedCount++;
                    }
                }
            }
            
            LOG.info("Added " + addedCount + " new quotes to database");
        } catch (Exception e) {
            LOG.error("Failed to fetch quotes from ZenQuotes", e);
        }
    }

    public List<Quote> getViewedQuotesForUser(String username) {
        LOG.info("Getting viewed quotes for user: " + username);

        Optional<UserProgress> progressOpt = userProgressRepository.findByUsername(username);
        if (progressOpt.isEmpty() || progressOpt.get().lastQuoteId <= 0) {
            LOG.info("User " + username + " has no progress or hasn't viewed any quotes");
            return List.of();
        }

        int lastQuoteId = progressOpt.get().lastQuoteId;
        List<Quote> viewedQuotes = new ArrayList<>();

        for (int i = 1; i <= lastQuoteId; i++) {
            Optional<Quote> quote = quoteRepository.findByQuoteId(i);
            if (quote.isPresent()) {
                viewedQuotes.add(quote.get());
            } else {
                LOG.warn("Quote with ID " + i + " not found while getting viewed quotes for user " + username);
            }
        }

        LOG.info("Retrieved " + viewedQuotes.size() + " viewed quotes for user " + username);
        return viewedQuotes;
    }
}
