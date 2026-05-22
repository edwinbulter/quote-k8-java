package com.quote.k8.repository;

import com.quote.k8.model.UserLike;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class UserLikeRepository implements PanacheMongoRepository<UserLike> {

    public Optional<UserLike> findByUsernameAndQuoteId(String username, Integer quoteId) {
        return find("username = ?1 and quoteId = ?2", username, quoteId).firstResultOptional();
    }

    public List<UserLike> findByUsernameOrderByOrder(String username) {
        return find("username", username).stream()
                .sorted((a, b) -> Integer.compare(a.order != null ? a.order : 0, b.order != null ? b.order : 0))
                .toList();
    }

    public Integer getMaxOrderForUser(String username) {
        List<UserLike> likes = findByUsernameOrderByOrder(username);
        return likes.stream()
                .mapToInt(l -> l.order != null ? l.order : 0)
                .max()
                .orElse(0);
    }

    public boolean deleteByUsernameAndQuoteId(String username, Integer quoteId) {
        Optional<UserLike> likeOpt = findByUsernameAndQuoteId(username, quoteId);
        if (likeOpt.isEmpty()) {
            return false;
        }
        delete(likeOpt.get());
        return true;
    }

    public boolean updateOrder(String username, Integer quoteId, Integer newOrder) {
        Optional<UserLike> likeOpt = findByUsernameAndQuoteId(username, quoteId);
        if (likeOpt.isEmpty()) {
            return false;
        }
        UserLike like = likeOpt.get();
        like.order = newOrder;
        update(like);
        return true;
    }
}
