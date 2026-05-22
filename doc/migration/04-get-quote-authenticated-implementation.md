# Implementation: GET /api/quote (Authenticated)

Migrate the C# `GET /api/quote` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Returns the next sequential quote for that user (starting from quote ID 1 for new users)
- After returning, updates `UserProgress.lastQuoteId` in the database
- When the user has seen all quotes, fetches more from ZenQuotes and continues

---

## 1. New Model: `UserProgress`

Create `UserProgress.java` in `com.quote.k8.model`:

```java
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
```

---

## 2. New Repository: `UserProgressRepository`

Create `UserProgressRepository.java` in `com.quote.k8.repository`:

```java
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
}
```

---

## 3. Update `QuoteService`

Add the authenticated quote method to `QuoteService.java`. This method:
1. Looks up the user's `UserProgress`
2. Determines the `nextQuoteId` (1 for new users, `lastQuoteId + 1` for existing)
3. Fetches more quotes from ZenQuotes if `nextQuoteId` exceeds the max in the DB
4. Returns the quote and updates `lastQuoteId`

```java
@Inject
UserProgressRepository userProgressRepository;

public Quote getNextQuoteForUser(String username) {
    LOG.info("Getting next sequential quote for user: " + username);

    Optional<UserProgress> progressOpt = userProgressRepository.findByUsername(username);
    int nextQuoteId;

    if (progressOpt.isEmpty()) {
        nextQuoteId = 1;
        LOG.info("New user " + username + " starting with quote ID: " + nextQuoteId);
    } else {
        nextQuoteId = progressOpt.get().lastQuoteId + 1;
        LOG.info("User " + username + " progress: lastQuoteId=" + progressOpt.get().lastQuoteId + ", nextQuoteId=" + nextQuoteId);
    }

    // Fetch more quotes if needed
    int maxId = quoteRepository.getMaxQuoteId();
    if (nextQuoteId > maxId) {
        LOG.info("Next quote ID " + nextQuoteId + " exceeds max ID " + maxId + ", fetching more quotes");
        fetchMoreQuotesIfNeeded();
        maxId = quoteRepository.getMaxQuoteId();
    }

    // Get the quote by ID, find next available if missing
    Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(nextQuoteId);
    Quote quote = quoteOpt.orElseGet(() -> findNextAvailableQuote(nextQuoteId));

    if (quote == null) {
        LOG.warn("No quote found starting from ID: " + nextQuoteId);
        throw new IllegalStateException("No quotes available");
    }

    // Update user progress
    updateUserProgress(username, quote.quoteId, progressOpt.orElse(null));
    LOG.info("Updated user " + username + " progress to lastQuoteId=" + quote.quoteId);

    return quote;
}

private Quote findNextAvailableQuote(int startId) {
    int maxId = quoteRepository.getMaxQuoteId();
    for (int id = startId; id <= maxId; id++) {
        Optional<Quote> quote = quoteRepository.findByQuoteId(id);
        if (quote.isPresent()) {
            return quote.get();
        }
    }
    return null;
}

private void updateUserProgress(String username, int quoteId, UserProgress existing) {
    if (existing == null) {
        userProgressRepository.persist(new UserProgress(username, quoteId));
    } else {
        existing.lastQuoteId = quoteId;
        existing.updatedAt = java.time.LocalDateTime.now();
        userProgressRepository.update(existing);
    }
}
```

> The `fetchMoreQuotesIfNeeded()` method already exists in `QuoteService` — no change needed there.

---

## 4. Update `QuoteResource`

Add the `GET /api/quote` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken`.

### Add imports

```java
import com.quote.k8.service.QuoteService;
import io.quarkus.security.Authenticated;
import org.eclipse.microprofile.jwt.JsonWebToken;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
```

### Add JWT injection and endpoint

```java
@Inject
JsonWebToken jwt;

@GET
@Path("/quote")
@Authenticated
public Response getQuote() {
    try {
        String username = jwt.getClaim("username");
        LOG.info("GET /api/quote - Login for user: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        Quote quote = quoteService.getNextQuoteForUser(username);
        if (quote == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("No quotes available").build();
        }
        return Response.ok(quote).build();
    } catch (Exception e) {
        LOG.error("Error fetching quote for authenticated user", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error fetching quote: " + e.getMessage())
                .build();
    }
}
```

---

## 5. Add `quarkus-smallrye-jwt` dependency (already present)

The `quarkus-smallrye-jwt` dependency was added for the login endpoint and enables both JWT signing and `@Authenticated` / `JsonWebToken` injection. No additional dependency is needed.

Verify `pom.xml` contains:

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-smallrye-jwt</artifactId>
</dependency>
```

---

## 6. Build and Deploy

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name multi-node-cluster
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 7. Test the Endpoint

### Login first to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-b","password":"Hello-user-b"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Call the authenticated endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote
```

### Expected success response (HTTP 200)

```json
{
  "quoteId": 1,
  "quoteText": "...",
  "author": "...",
  "likeCount": 0,
  "createdAt": "...",
  "source": "ZenQuotes"
}
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | (empty / JWT error) |
| No quotes in DB and ZenQuotes unavailable | `500 Internal Server Error` | `Error fetching quote: ...` |

---

## Summary of new/changed files

| File | Action |
|---|---|
| `model/UserProgress.java` | **Create** |
| `repository/UserProgressRepository.java` | **Create** |
| `service/QuoteService.java` | **Update** — add `getNextQuoteForUser()`, `findNextAvailableQuote()`, `updateUserProgress()`, inject `UserProgressRepository` |
| `resource/QuoteResource.java` | **Update** — add `GET /api/quote` endpoint, inject `JsonWebToken` |
