# Implementation: GET /api/quote/progress (Authenticated)

Migrate the C# `GET /api/quote/progress` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token
- Extracts the `username` from the JWT
- Returns the user's progress information (username, lastQuoteId, updatedAt)
- If the user has no progress record, returns 404 Not Found

---

## C# Implementation Reference

### Controller: QuoteController.cs

```csharp
[HttpGet("quote/progress")]
[Authorize]
public async Task<ActionResult<UserProgress>> GetProgress()
{
    var username = _authMiddleware.GetUsernameFromTokenAsync(Request);
    if (string.IsNullOrEmpty(username))
        return Unauthorized();

    var progress = await _quoteService.GetUserProgressAsync(username);
    if (progress == null)
        return NotFound();
    
    return Ok(progress);
}
```

### Model: UserProgress.cs

```csharp
public class UserProgress
{
    public string Username { get; set; } = string.Empty;
    public int LastQuoteId { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

### Service: QuoteService.cs

```csharp
public async Task<UserProgress?> GetUserProgressAsync(string username)
{
    try
    {
        return await _userActivityRepository.GetUserProgressAsync(username);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error getting user progress for user: {Username}", username);
        throw;
    }
}
```

---

## Java Migration

### 1. Update `QuoteService`

Add the `getUserProgress` method to `QuoteService.java`. This method:
1. Looks up the user's `UserProgress` by username
2. Returns the progress if found
3. Returns empty if not found

```java
public Optional<UserProgress> getUserProgress(String username) {
    LOG.info("Getting user progress for: " + username);
    
    Optional<UserProgress> progress = userProgressRepository.findByUsername(username);
    
    if (progress.isPresent()) {
        LOG.info("User " + username + " progress: lastQuoteId=" + progress.get().lastQuoteId);
    } else {
        LOG.info("User " + username + " has no progress record");
    }
    
    return progress;
}
```

---

### 2. Update `QuoteResource`

Add the `GET /api/quote/progress` endpoint to `QuoteResource.java`. It extracts the username from the injected JWT `JsonWebToken`.

```java
@GET
@Path("/quote/progress")
@Authenticated
public Response getProgress() {
    try {
        String username = jwt.getClaim("username");
        LOG.info("GET /api/quote/progress - Fetching progress for user: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        Optional<UserProgress> progress = quoteService.getUserProgress(username);
        if (progress.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("User progress not found")
                    .build();
        }

        return Response.ok(progress.get()).build();
    } catch (Exception e) {
        LOG.error("Error fetching user progress for authenticated user", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error fetching user progress: " + e.getMessage())
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
kind load docker-image quote-api:latest-jvm --name multi-node-cluster
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
  http://localhost:8080/api/quote/progress
```

### Expected success response (HTTP 200)

If the user has viewed 5 quotes:

```json
{
  "id": "...",
  "username": "user-b",
  "lastQuoteId": 5,
  "updatedAt": "2026-05-22T09:30:00"
}
```

### Expected 404 response (HTTP 404)

If the user has no progress record:

```json
User progress not found
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| No progress record | `404 Not Found` | `User progress not found` |
| Server error | `500 Internal Server Error` | `Error fetching user progress: ...` |

---

## Summary of changed files

| File | Action |
|---|---|
| `service/QuoteService.java` | **Update** — add `getUserProgress()` method |
| `resource/QuoteResource.java` | **Update** — add `GET /api/quote/progress` endpoint |

---

## Notes

- The `UserProgress` model and `UserProgressRepository` were already created for the GET /api/quote (authenticated) endpoint
- This endpoint is a simple read operation that returns the user's current progress
- The endpoint returns 404 if the user has no progress record (e.g., new user who hasn't viewed any quotes yet)
- The `updatedAt` field in the response shows when the progress was last updated
