package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "userlikes")
public class UserLike {

    @BsonId
    public ObjectId id;

    public String username;
    public Integer quoteId;
    public Integer order;
    public LocalDateTime likedAt;

    public UserLike() {
        this.likedAt = LocalDateTime.now();
    }

    public UserLike(String username, Integer quoteId, Integer order) {
        this();
        this.username = username;
        this.quoteId = quoteId;
        this.order = order;
    }
}
