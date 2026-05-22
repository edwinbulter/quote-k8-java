package com.quote.k8.repository;

import com.quote.k8.model.UserProgress;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class UserProgressRepository implements PanacheMongoRepository<UserProgress> {

    public Optional<UserProgress> findByUsername(String username) {
        return find("username", username).firstResultOptional();
    }

    public boolean deleteByUsername(String username) {
        Optional<UserProgress> progressOpt = findByUsername(username);
        if (progressOpt.isEmpty()) {
            return false;
        }
        delete(progressOpt.get());
        return true;
    }
}
