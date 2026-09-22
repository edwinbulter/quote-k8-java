# Implementation: DELETE /api/quote/{quoteId}/unlike (Authenticated)

Migrate the C# `DELETE /api/quote/{quoteId}/unlike` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Removes the user's like record for the specified quote
- Returns HTTP 204 No Content on success
- If the like doesn't exist, still returns 204 (idempotent)
- If the quote doesn't exist, returns 404

---

## 1. Update `UserLikeRepository`

Add the `deleteByUsernameAndQuoteId` method to `UserLikeRepository.java` in `com.quote.k8.repository`:

```java
public boolean deleteByUsernameAndQuoteId(String username, Integer quoteId) {
    Optional<UserLike> likeOpt = findByUsernameAndQuoteId(username, quoteId);
    if (likeOpt.isEmpty()) {
        return false;
    }
    delete(likeOpt.get());
    return true;
}
```

---

## 2. Update `QuoteService`

Add the `unlikeQuote` method to `QuoteService.java`. This method:
1. Finds the quote by ID (to validate it exists)
2. Deletes the user's like record for this quote
3. Returns the quote (for consistency with the like endpoint)

```java
public Quote unlikeQuote(String username, Integer quoteId) {
    LOG.info("User " + username + " unliking quote ID: " + quoteId);

    Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(quoteId);
    if (quoteOpt.isEmpty()) {
        LOG.warn("Quote with ID " + quoteId + " not found");
        return null;
    }

    // Delete the like record (idempotent - no error if not found)
    boolean deleted = userLikeRepository.deleteByUsernameAndQuoteId(username, quoteId);
    if (deleted) {
        LOG.info("User " + username + " unliked quote " + quoteId);
    } else {
        LOG.info("User " + username + " had not liked quote " + quoteId + " (no-op)");
    }

    return quoteOpt.get();
}
```

---

## 3. Update `QuoteResource`

Add the `DELETE /api/quote/{quoteId}/unlike` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken`.

```java
@DELETE
@Path("/quote/{quoteId}/unlike")
@Authenticated
public Response unlikeQuote(@PathParam("quoteId") Integer quoteId) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("DELETE /api/quote/" + quoteId + "/unlike - User: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        Quote quote = quoteService.unlikeQuote(username, quoteId);
        if (quote == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Quote not found")
                    .build();
        }

        return Response.noContent().build();
    } catch (Exception e) {
        LOG.error("Error unliking quote", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error unliking quote: " + e.getMessage())
                .build();
    }
}
```

---

## 4. Build and Deploy

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name single-node
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 5. Test the Endpoint

### Login first to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-b","password":"Hello-user-b"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### First, like a quote (to have something to unlike)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/2/like
```

### Call the unlike endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/2/unlike
```

### Expected success response (HTTP 204 No Content)

The response body will be empty.

### Verify the like was removed from MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.userlikes.find().pretty()"
```

Expected output: No documents (or the like for quote 2 should be gone).

### Verify idempotency (calling unlike again)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/2/unlike
```

Expected: Still returns HTTP 204 No Content (no error even though the like doesn't exist).

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Quote not found | `404 Not Found` | `Quote not found` |
| Server error | `500 Internal Server Error` | `Error unliking quote: ...` |

---

## Summary of changed files

| File | Action |
|---|---|
| `repository/UserLikeRepository.java` | **Update** — add `deleteByUsernameAndQuoteId()` |
| `service/QuoteService.java` | **Update** — add `unlikeQuote()` |
| `resource/QuoteResource.java` | **Update** — add `DELETE /api/quote/{quoteId}/unlike` endpoint |

---

## C# to Java Mapping

| C# (Azure Table Storage) | Java (MongoDB with Panache) |
|---|---|
| `DeleteEntityAsync(userId, $"{userId}_{quoteId}")` | `deleteByUsernameAndQuoteId(username, quoteId)` |
| Returns `false` on 404 | Returns `false` if not found (but endpoint still returns 204) |
| Uses PartitionKey/RowKey | Uses MongoDB query with username and quoteId |
