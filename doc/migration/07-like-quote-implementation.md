# Implementation: POST /api/quote/{quoteId}/like (Authenticated)

Migrate the C# `POST /api/quote/{quoteId}/like` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Records that the user has liked the specified quote
- Assigns an order to the like (for reordering functionality)
- Returns the liked quote
- If the quote doesn't exist, returns 404

---

## 1. New Model: `UserLike`

Create `UserLike.java` in `com.quote.k8.model`:

```java
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
```

---

## 2. New Repository: `UserLikeRepository`

Create `UserLikeRepository.java` in `com.quote.k8.repository`:

```java
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
        return find("username", username).list();
    }

    public Integer getMaxOrderForUser(String username) {
        List<UserLike> likes = findByUsernameOrderByOrder(username);
        return likes.stream()
                .mapToInt(l -> l.order != null ? l.order : 0)
                .max()
                .orElse(0);
    }
}
```

---

## 3. Update `QuoteService`

Add the `likeQuote` method to `QuoteService.java`. This method:
1. Finds the quote by ID
2. Checks if the user has already liked this quote (optional - can allow multiple likes)
3. Gets the current max order for the user
4. Creates a new UserLike with order = maxOrder + 1
5. Persists the like
6. Returns the quote

```java
@Inject
UserLikeRepository userLikeRepository;

public Quote likeQuote(String username, Integer quoteId) {
    LOG.info("User " + username + " liking quote ID: " + quoteId);

    Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(quoteId);
    if (quoteOpt.isEmpty()) {
        LOG.warn("Quote with ID " + quoteId + " not found");
        return null;
    }

    // Check if user already liked this quote (optional - remove if allowing duplicates)
    Optional<UserLike> existingLike = userLikeRepository.findByUsernameAndQuoteId(username, quoteId);
    if (existingLike.isPresent()) {
        LOG.info("User " + username + " already liked quote " + quoteId);
        return quoteOpt.get();
    }

    // Get current max order for this user
    Integer maxOrder = userLikeRepository.getMaxOrderForUser(username);
    Integer newOrder = maxOrder + 1;

    // Create and persist the like
    UserLike userLike = new UserLike(username, quoteId, newOrder);
    userLikeRepository.persist(userLike);

    LOG.info("User " + username + " liked quote " + quoteId + " with order " + newOrder);

    return quoteOpt.get();
}
```

---

## 4. Update `QuoteResource`

Add the `POST /api/quote/{quoteId}/like` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken`.

```java
@POST
@Path("/quote/{quoteId}/like")
@Authenticated
public Response likeQuote(@PathParam("quoteId") Integer quoteId) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("POST /api/quote/" + quoteId + "/like - User: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        Quote quote = quoteService.likeQuote(username, quoteId);
        if (quote == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Quote not found")
                    .build();
        }

        return Response.ok(quote).build();
    } catch (Exception e) {
        LOG.error("Error liking quote", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error liking quote: " + e.getMessage())
                .build();
    }
}
```

---

## 5. Build and Deploy

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name single-node
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 6. Test the Endpoint

### Login first to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-b","password":"Hello-user-b"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Call the like endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/2/like
```

### Expected success response (HTTP 200)

```json
{
  "id": "...",
  "quoteId": 2,
  "quoteText": "If I cannot do great things. I can do small things in a great way.",
  "author": "Martin Luther King, Jr.",
  "likeCount": 0,
  "createdAt": "...",
  "source": "ZenQuotes"
}
```

### Verify the like was stored in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.userlikes.find().pretty()"
```

Expected output:

```json
{
  "_id": ObjectId("..."),
  "username": "user-b",
  "quoteId": 2,
  "order": 1,
  "likedAt": ISODate("2026-05-22T09:59:00.000Z")
}
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Quote not found | `404 Not Found` | `Quote not found` |
| Server error | `500 Internal Server Error` | `Error liking quote: ...` |

---

## Summary of new/changed files

| File | Action |
|---|---|
| `model/UserLike.java` | **Create** |
| `repository/UserLikeRepository.java` | **Create** |
| `service/QuoteService.java` | **Update** — add `likeQuote()`, inject `UserLikeRepository` |
| `resource/QuoteResource.java` | **Update** — add `POST /api/quote/{quoteId}/like` endpoint |
