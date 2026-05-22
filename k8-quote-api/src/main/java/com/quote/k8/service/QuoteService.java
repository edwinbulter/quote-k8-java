package com.quote.k8.service;

import com.quote.k8.model.Quote;
import com.quote.k8.model.UserLike;
import com.quote.k8.model.UserProgress;
import com.quote.k8.repository.QuoteRepository;
import com.quote.k8.repository.UserLikeRepository;
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

    @Inject
    UserLikeRepository userLikeRepository;

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

    public Optional<UserProgress> getUserProgress(String username) {
        LOG.info("Getting user progress for: " + username);

        Optional<UserProgress> progress = userProgressRepository.findByUsername(username);

        if (progress.isPresent()) {
            LOG.info("User " + username + " progress: lastQuoteId=" + progress.get().lastQuoteId);
        } else {
            LOG.info("User " + username + " has no progress record");
        }

        return progress;
    }

    public Quote likeQuote(String username, Integer quoteId) {
        LOG.info("User " + username + " liking quote ID: " + quoteId);

        Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(quoteId);
        if (quoteOpt.isEmpty()) {
            LOG.warn("Quote with ID " + quoteId + " not found");
            return null;
        }

        // Check if user already liked this quote (optional - remove if allowing duplicates)
        Optional<UserLike> existingLike = userLikeRepository.findByUsernameAndQuoteId(username, quoteId);
        if (existingLike.isPresent()) {
            LOG.info("User " + username + " already liked quote " + quoteId);
            return quoteOpt.get();
        }

        // Get current max order for this user
        Integer maxOrder = userLikeRepository.getMaxOrderForUser(username);
        Integer newOrder = maxOrder + 1;

        // Create and persist the like
        UserLike userLike = new UserLike(username, quoteId, newOrder);
        userLikeRepository.persist(userLike);

        LOG.info("User " + username + " liked quote " + quoteId + " with order " + newOrder);

        return quoteOpt.get();
    }

    public Quote unlikeQuote(String username, Integer quoteId) {
        LOG.info("User " + username + " unliking quote ID: " + quoteId);

        Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(quoteId);
        if (quoteOpt.isEmpty()) {
            LOG.warn("Quote with ID " + quoteId + " not found");
            return null;
        }

        // Delete the like record (idempotent - no error if not found)
        boolean deleted = userLikeRepository.deleteByUsernameAndQuoteId(username, quoteId);
        if (deleted) {
            LOG.info("User " + username + " unliked quote " + quoteId);
        } else {
            LOG.info("User " + username + " had not liked quote " + quoteId + " (no-op)");
        }

        return quoteOpt.get();
    }

    public List<Quote> getLikedQuotesForUser(String username) {
        LOG.info("Getting liked quotes for user: " + username);

        List<UserLike> userLikes = userLikeRepository.findByUsernameOrderByOrder(username);
        List<Quote> likedQuotes = new ArrayList<>();

        for (UserLike like : userLikes) {
            Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(like.quoteId);
            if (quoteOpt.isPresent()) {
                likedQuotes.add(quoteOpt.get());
            } else {
                LOG.warn("Quote with ID " + like.quoteId + " not found for user " + username + " like record");
            }
        }

        LOG.info("Retrieved " + likedQuotes.size() + " liked quotes for user " + username);
        return likedQuotes;
    }
}
