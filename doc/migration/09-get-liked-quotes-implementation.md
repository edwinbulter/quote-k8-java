# Implementation: GET /api/quote/liked (Authenticated)

Migrate the C# `GET /api/quote/liked` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Returns all quotes that the user has liked, ordered by the `order` field
- Returns an empty list if the user has not liked any quotes

---

## C# Implementation Reference

### Controller: QuoteController.cs

```csharp
[HttpGet("quote/liked")]
[Authorize]
public async Task<ActionResult<List<Quote>>> GetLikedQuotes()
{
    var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
    if (string.IsNullOrEmpty(username))
        return Unauthorized();

    var likedQuotes = await _quoteService.GetLikedQuotesByUserAsync(username);
    return Ok(likedQuotes);
}
```

### Service: QuoteService.cs

```csharp
public async Task<List<Quote>> GetLikedQuotesByUserAsync(string username)
{
    var allLikes = await _userActivityRepository.GetAllUserLikesAsync(username);
    var likedQuotes = new List<Quote>();
    foreach (var like in allLikes.OrderBy(l => l.Order))
    {
        var quote = await _quoteRepository.GetQuoteByIdAsync(like.QuoteId);
        if (quote != null)
            likedQuotes.Add(quote);
    }
    return likedQuotes;
}
```

---

## Java Migration

### 1. Update `UserLikeRepository`

Add a method to get all likes for a user ordered by the `order` field. This method should already exist from the like-quote implementation, but let's verify it:

```java
public List<UserLike> findByUsernameOrderByOrder(String username) {
    return find("username", username).list();
}
```

If this method doesn't exist, add it to `UserLikeRepository.java` in `com.quote.k8.repository`.

---

### 2. Update `QuoteService`

Add the `getLikedQuotesForUser` method to `QuoteService.java`. This method:
1. Gets all UserLike records for the user, ordered by the `order` field
2. For each like, fetches the corresponding Quote from the repository
3. Returns a list of Quote objects in the order specified by the UserLike records

```java
public List<Quote> getLikedQuotesForUser(String username) {
    LOG.info("Getting liked quotes for user: " + username);

    List<UserLike> userLikes = userLikeRepository.findByUsernameOrderByOrder(username);
    List<Quote> likedQuotes = new ArrayList<>();

    for (UserLike like : userLikes) {
        Optional<Quote> quoteOpt = quoteRepository.findByQuoteId(like.quoteId);
        if (quoteOpt.isPresent()) {
            likedQuotes.add(quoteOpt.get());
        } else {
            LOG.warn("Quote with ID " + like.quoteId + " not found for user " + username + " like record");
        }
    }

    LOG.info("Retrieved " + likedQuotes.size() + " liked quotes for user " + username);
    return likedQuotes;
}
```

---

### 3. Update `QuoteResource`

Add the `GET /api/quote/liked` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken`.

```java
@GET
@Path("/quote/liked")
@Authenticated
public Response getLikedQuotes() {
    try {
        String username = jwt.getClaim("username");
        LOG.info("GET /api/quote/liked - Fetching liked quotes for user: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        List<Quote> likedQuotes = quoteService.getLikedQuotesForUser(username);
        return Response.ok(likedQuotes).build();
    } catch (Exception e) {
        LOG.error("Error fetching liked quotes for authenticated user", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error fetching liked quotes: " + e.getMessage())
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
kind load docker-image quote-api:latest-jvm --name multi-node-cluster
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

### Like some quotes first (if not already liked)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/2/like

kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/5/like
```

### Call the liked quotes endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/quote/liked
```

### Expected success response (HTTP 200)

If the user has liked quotes 2 and 5 (in that order):

```json
[
  {
    "id": "...",
    "quoteId": 2,
    "quoteText": "If I cannot do great things. I can do small things in a great way.",
    "author": "Martin Luther King, Jr.",
    "likeCount": 0,
    "createdAt": "...",
    "source": "ZenQuotes"
  },
  {
    "id": "...",
    "quoteId": 5,
    "quoteText": "The only way to do great work is to love what you do.",
    "author": "Steve Jobs",
    "likeCount": 0,
    "createdAt": "...",
    "source": "ZenQuotes"
  }
]
```

### Expected empty response (HTTP 200)

If the user has not liked any quotes:

```json
[]
```

### Verify the likes in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.userlikes.find({username: 'user-b'}).sort({order: 1}).pretty()"
```

Expected output:

```json
[
  {
    "_id": ObjectId("..."),
    "username": "user-b",
    "quoteId": 2,
    "order": 1,
    "likedAt": ISODate("2026-05-22T10:00:00.000Z")
  },
  {
    "_id": ObjectId("..."),
    "username": "user-b",
    "quoteId": 5,
    "order": 2,
    "likedAt": ISODate("2026-05-22T10:01:00.000Z")
  }
]
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Server error | `500 Internal Server Error` | `Error fetching liked quotes: ...` |

---

## Summary of changed files

| File | Action |
|---|---|
| `repository/UserLikeRepository.java` | **Verify** — ensure `findByUsernameOrderByOrder()` exists |
| `service/QuoteService.java` | **Update** — add `getLikedQuotesForUser()` method |
| `resource/QuoteResource.java` | **Update** — add `GET /api/quote/liked` endpoint |

---

## Notes

- The `UserLike` model and `UserLikeRepository` were already created for the POST /api/quote/{quoteId}/like endpoint
- The `findByUsernameOrderByOrder()` method should already exist in `UserLikeRepository` from the like-quote implementation
- This endpoint returns quotes in the order specified by the `order` field in the UserLike records, allowing users to reorder their liked quotes
- The endpoint returns an empty array (HTTP 200) if the user has not liked any quotes, not a 404
- If a quote referenced in a UserLike record no longer exists in the quotes collection, it is silently skipped (with a warning log)
