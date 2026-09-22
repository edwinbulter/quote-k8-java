# Implementation: GET /api/quote/viewed (Authenticated)

Migrate the C# `GET /api/quote/viewed` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Returns all quotes the user has viewed sequentially (from quote ID 1 up to their `lastQuoteId`)
- If the user has no progress or hasn't viewed any quotes, returns an empty list
- Skips any quote IDs that don't exist in the database (logs a warning)

---

## 1. Update `QuoteService`

Add the `getViewedQuotesForUser` method to `QuoteService.java`. This method:
1. Looks up the user's `UserProgress`
2. If no progress or `lastQuoteId <= 0`, returns empty list
3. Iterates from ID 1 to `lastQuoteId`, fetching each quote
4. Returns the list of all found quotes

```java
public List<Quote> getViewedQuotesForUser(String username) {
    LOG.info("Getting viewed quotes for user: " + username);

    Optional<UserProgress> progressOpt = userProgressRepository.findByUsername(username);
    if (progressOpt.isEmpty() || progressOpt.get().lastQuoteId <= 0) {
        LOG.info("User " + username + " has no progress or hasn't viewed any quotes");
        return List.of();
    }

    int lastQuoteId = progressOpt.get().lastQuoteId;
    List<Quote> viewedQuotes = new ArrayList<>();

    for (int i = 1; i <= lastQuoteId; i++) {
        Optional<Quote> quote = quoteRepository.findByQuoteId(i);
        if (quote.isPresent()) {
            viewedQuotes.add(quote.get());
        } else {
            LOG.warn("Quote with ID " + i + " not found while getting viewed quotes for user " + username);
        }
    }

    LOG.info("Retrieved " + viewedQuotes.size() + " viewed quotes for user " + username);
    return viewedQuotes;
}
```

Add the import for `ArrayList`:

```java
import java.util.ArrayList;
```

---

## 2. Update `QuoteResource`

Add the `GET /api/quote/viewed` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken`.

```java
@GET
@Path("/quote/viewed")
@Authenticated
public Response getViewHistory() {
    try {
        String username = jwt.getClaim("username");
        LOG.info("GET /api/quote/viewed - Fetching view history for user: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        List<Quote> viewedQuotes = quoteService.getViewedQuotesForUser(username);
        return Response.ok(viewedQuotes).build();
    } catch (Exception e) {
        LOG.error("Error fetching view history for authenticated user", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error fetching view history: " + e.getMessage())
                .build();
    }
}
```

---

## 3. Build and Deploy

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name single-node
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 4. Test the Endpoint

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
  http://localhost:8080/api/quote/viewed
```

### Expected success response (HTTP 200)

If the user has viewed 2 quotes:

```json
[
  {
    "id": "...",
    "quoteId": 1,
    "quoteText": "The person who never made a mistake never tried anything new.",
    "author": "Albert Einstein",
    "likeCount": 0,
    "createdAt": "...",
    "source": "ZenQuotes"
  },
  {
    "id": "...",
    "quoteId": 2,
    "quoteText": "If I cannot do great things. I can do small things in a great way.",
    "author": "Martin Luther King, Jr.",
    "likeCount": 0,
    "createdAt": "...",
    "source": "ZenQuotes"
  }
]
```

If the user has no progress:

```json
[]
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | (empty / JWT error) |
| Server error | `500 Internal Server Error` | `Error fetching view history: ...` |

---

## Summary of changed files

| File | Action |
|---|---|
| `service/QuoteService.java` | **Update** — add `getViewedQuotesForUser()`, add `ArrayList` import |
| `resource/QuoteResource.java` | **Update** — add `GET /api/quote/viewed` endpoint |
