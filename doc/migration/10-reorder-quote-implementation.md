# Implementation: PUT /api/quote/{quoteId}/reorder (Authenticated)

Migrate the C# `PUT /api/quote/{quoteId}/reorder` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Updates the order (position) of a liked quote for the authenticated user
- Returns HTTP 204 No Content on success
- If the user hasn't liked the quote, returns 400 Bad Request
- If the quote doesn't exist, returns 404 Not Found

---

## 1. New DTO: `ReorderRequest`

Create `ReorderRequest.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

public class ReorderRequest {
    public Integer newPosition;

    public ReorderRequest() {
    }

    public ReorderRequest(Integer newPosition) {
        this.newPosition = newPosition;
    }
}
```

---

## 2. Update `UserLikeRepository`

Add the `updateOrder` method to `UserLikeRepository.java` in `com.quote.k8.repository`:

```java
public boolean updateOrder(String username, Integer quoteId, Integer newOrder) {
    Optional<UserLike> likeOpt = findByUsernameAndQuoteId(username, quoteId);
    if (likeOpt.isEmpty()) {
        return false;
    }
    UserLike like = likeOpt.get();
    like.order = newOrder;
    update(like);
    return true;
}
```

---

## 3. Update `QuoteService`

Add the `reorderLikedQuote` method to `QuoteService.java`. This method:
1. Finds the user's like record for the specified quote
2. Updates the order field to the new position
3. Throws an exception if the user hasn't liked the quote

```java
public void reorderLikedQuote(String username, Integer quoteId, Integer newOrder) {
    LOG.info("User " + username + " reordering quote " + quoteId + " to position " + newOrder);

    boolean updated = userLikeRepository.updateOrder(username, quoteId, newOrder);
    if (!updated) {
        LOG.warn("User " + username + " has not liked quote " + quoteId + " - cannot reorder");
        throw new IllegalStateException("User has not liked this quote");
    }

    LOG.info("User " + username + " reordered quote " + quoteId + " to position " + newOrder);
}
```

---

## 4. Update `QuoteResource`

Add the `PUT /api/quote/{quoteId}/reorder` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken` and accepts a `ReorderRequest` body.

First, add the import:

```java
import com.quote.k8.dto.ReorderRequest;
```

Then add the endpoint:

```java
@PUT
@Path("/quote/{quoteId}/reorder")
@Authenticated
public Response reorderLikedQuote(@PathParam("quoteId") Integer quoteId, ReorderRequest request) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("PUT /api/quote/" + quoteId + "/reorder - User: " + username + ", newPosition: " + request.newPosition);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        if (request.newPosition == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("newPosition is required")
                    .build();
        }

        quoteService.reorderLikedQuote(username, quoteId, request.newPosition);
        return Response.noContent().build();
    } catch (IllegalStateException e) {
        LOG.error("Error reordering liked quote", e);
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(e.getMessage())
                .build();
    } catch (Exception e) {
        LOG.error("Error reordering liked quote", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error reordering liked quote: " + e.getMessage())
                .build();
    }
}
```

---

## 5. Build and Deploy

```bash
cd quote-api
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

### First, like multiple quotes to have something to reorder

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/1/like

kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/2/like

kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/3/like
```

### Verify the initial order of liked quotes

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/liked
```

Expected response (quotes in order 1, 2, 3):

```json
[
  {
    "id": "...",
    "quoteId": 1,
    "quoteText": "...",
    "author": "...",
    ...
  },
  {
    "id": "...",
    "quoteId": 2,
    "quoteText": "...",
    "author": "...",
    ...
  },
  {
    "id": "...",
    "quoteId": 3,
    "quoteText": "...",
    "author": "...",
    ...
  }
]
```

### Call the reorder endpoint to move quote ID 3 to position 1

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPosition": 1}' \
  http://localhost:8080/api/quote/3/reorder
```

### Expected success response (HTTP 204 No Content)

The response body will be empty.

### Verify the order changed in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.userlikes.find({username: 'user-b'}).sort({order: 1}).pretty()"
```

Expected output (quote 3 now has order 1):

```json
[
  {
    "_id": ObjectId("..."),
    "username": "user-b",
    "quoteId": 3,
    "order": 1,
    "likedAt": ISODate("...")
  },
  {
    "_id": ObjectId("..."),
    "username": "user-b",
    "quoteId": 1,
    "order": 2,
    "likedAt": ISODate("...")
  },
  {
    "_id": ObjectId("..."),
    "username": "user-b",
    "quoteId": 2,
    "order": 3,
    "likedAt": ISODate("...")
  }
]
```

### Verify the order changed via the API

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/liked
```

Expected response (quote 3 is now first):

```json
[
  {
    "id": "...",
    "quoteId": 3,
    "quoteText": "...",
    "author": "...",
    ...
  },
  {
    "id": "...",
    "quoteId": 1,
    "quoteText": "...",
    "author": "...",
    ...
  },
  {
    "id": "...",
    "quoteId": 2,
    "quoteText": "...",
    "author": "...",
    ...
  }
]
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| newPosition is null | `400 Bad Request` | `newPosition is required` |
| User hasn't liked the quote | `400 Bad Request` | `User has not liked this quote` |
| Server error | `500 Internal Server Error` | `Error reordering liked quote: ...` |

---

## Summary of new/changed files

| File | Action |
|---|---|
| `dto/ReorderRequest.java` | **Create** |
| `repository/UserLikeRepository.java` | **Update** — add `updateOrder()` |
| `service/QuoteService.java` | **Update** — add `reorderLikedQuote()` |
| `resource/QuoteResource.java` | **Update** — add `PUT /api/quote/{quoteId}/reorder` endpoint, import `ReorderRequest` |

---

## C# to Java Mapping

| C# (Azure Table Storage) | Java (MongoDB with Panache) |
|---|---|
| `UpdateEntityAsync(likeEntity, ETag.All)` | `update(like)` |
| `GetEntityAsync<UserLikeEntity>(userId, $"{userId}_{quoteId}")` | `findByUsernameAndQuoteId(username, quoteId)` |
| Returns `false` on 404 | Returns `false` if not found (throws `IllegalStateException`) |
| Returns `NoContent()` | Returns `Response.noContent().build()` |
| `ReorderRequest` class with `NewPosition` property | `ReorderRequest` class with `newPosition` field |
