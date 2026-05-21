package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "users")
public class User {
    
    @BsonId
    public ObjectId id;
    
    public String username;
    public String email;
    public String passwordHash;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public boolean isActive;
    
    // Constructors
    public User() {}
    
    public User(String username, String email, String passwordHash) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.isActive = true;
    }
}
