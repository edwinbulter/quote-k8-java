package com.quote.k8.repository;

import com.quote.k8.model.User;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class UserRepository implements PanacheMongoRepository<User> {
    
    public Optional<User> findByUsername(String username) {
        return find("username", username).firstResultOptional();
    }
    
    public Optional<User> findByEmail(String email) {
        return find("email", email).firstResultOptional();
    }
    
    public boolean existsByUsername(String username) {
        return findByUsername(username).isPresent();
    }
    
    public boolean existsByEmail(String email) {
        return findByEmail(email).isPresent();
    }
}
