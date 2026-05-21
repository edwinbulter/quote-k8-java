package com.quote.k8.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "quotes")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Quote {

    @BsonId
    public ObjectId id;
    
    public Integer quoteId;  // Sequential ID for API compatibility
    public String quoteText;
    public String author;
    public Integer likeCount;
    public LocalDateTime createdAt;
    public String source;

    public Quote() {
        this.likeCount = 0;
        this.createdAt = LocalDateTime.now();
        this.source = "Local";
    }

    public Quote(Integer quoteId, String quoteText, String author) {
        this();
        this.quoteId = quoteId;
        this.quoteText = quoteText;
        this.author = author;
    }
}
