package com.quote.k8.repository;

import com.quote.k8.model.UserRole;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class UserRoleRepository implements PanacheMongoRepository<UserRole> {
    
    public Optional<UserRole> findByUsername(String username) {
        return find("username", username).firstResultOptional();
    }
    
    public boolean userHasRole(String username, String role) {
        return find("username = ?1 and role = ?2", username, role).firstResultOptional().isPresent();
    }
    
    public List<UserRole> findAllByUsername(String username) {
        return find("username", username).list();
    }
    
    public void deleteByUsernameAndRole(String username, String role) {
        delete("username = ?1 and role = ?2", username, role);
    }
}
