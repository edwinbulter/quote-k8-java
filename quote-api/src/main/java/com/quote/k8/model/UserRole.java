package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "user_roles")
public class UserRole {
    
    @BsonId
    public ObjectId id;
    
    public String username;
    public String role;
    public LocalDateTime createdAt;
    public String createdBy;
    
    // Constructors
    public UserRole() {}
    
    public UserRole(String username, String role, String createdBy) {
        this.username = username;
        this.role = role;
        this.createdAt = LocalDateTime.now();
        this.createdBy = createdBy;
    }
}
