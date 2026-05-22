package com.quote.k8.repository;

import com.quote.k8.model.User;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
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
    
    public List<User> findAllUsers() {
        return findAll().list();
    }
    
    public boolean deleteByUsername(String username) {
        Optional<User> userOpt = findByUsername(username);
        if (userOpt.isEmpty()) {
            return false;
        }
        delete(userOpt.get());
        return true;
    }
}
