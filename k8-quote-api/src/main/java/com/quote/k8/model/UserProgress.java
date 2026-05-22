package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "userprogress")
public class UserProgress {

    @BsonId
    public ObjectId id;

    public String username;
    public int lastQuoteId;
    public LocalDateTime updatedAt;

    public UserProgress() {}

    public UserProgress(String username, int lastQuoteId) {
        this.username = username;
        this.lastQuoteId = lastQuoteId;
        this.updatedAt = LocalDateTime.now();
    }
}
