# Implementation: GET /api/manage/stats (Admin Only)

Migrate the C# `GET /api/manage/stats` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Extracts the `username` from the JWT
- Returns the total number of likes across all quotes in the system
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpGet("stats")]
[Authorize(Roles = "ADMIN")]
public async Task<ActionResult<object>> GetStats()
{
    try
    {
        var totalLikes = await _adminService.GetTotalLikesAsync();
        return Ok(new { TotalLikes = totalLikes });
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while retrieving statistics");
    }
}
```

### Service: AdminService.cs

```csharp
public async Task<int> GetTotalLikesAsync()
{
    return await _userActivityRepository.GetTotalLikesCountAsync();
}
```

### Repository: UserActivityRepository.cs

```csharp
public async Task<int> GetTotalLikesCountAsync()
{
    try
    {
        var count = 0;
        await foreach (var entity in _userLikeTable.QueryAsync<UserLikeEntity>())
        {
            count++;
        }
        return count;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error getting total likes count");
        throw;
    }
}
```

---

## Java Migration

### 1. Update `UserLikeRepository`

Add a method to count all likes in the `userlikes` collection. Add this method to `UserLikeRepository.java` in `com.quote.k8.repository`:

```java
public long countAll() {
    return count();
}
```

This method uses the Panache MongoDB `count()` method to get the total number of documents in the `userlikes` collection.

---

### 2. Update `QuoteManagementService`

Add the `getTotalLikes` method to `QuoteManagementService.java`. This method:
1. Calls the repository to get the total count of likes
2. Returns the count as a long value

```java
public long getTotalLikes() {
    LOG.info("Getting total likes count");
    long totalLikes = userLikeRepository.countAll();
    LOG.info("Total likes: " + totalLikes);
    return totalLikes;
}
```

Add the necessary import at the top of `QuoteManagementService.java`:

```java
import com.quote.k8.repository.UserLikeRepository;
```

And inject the repository:

```java
@Inject
UserLikeRepository userLikeRepository;
```

---

### 3. Update `AdminResource`

Add the `GET /api/manage/stats` endpoint to `AdminResource.java`. It extracts the username from the injected JWT `JsonWebToken` and returns the total likes count.

```java
@GET
@Path("/stats")
@RolesAllowed("ADMIN")
public Response getStats() {
    try {
        String username = jwt.getClaim("username");
        LOG.info("GET /api/manage/stats - Fetching stats for admin: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        long totalLikes = quoteManagementService.getTotalLikes();
        return Response.ok(new StatsResponse(totalLikes)).build();
    } catch (Exception e) {
        LOG.error("Error fetching stats", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while retrieving statistics")
                .build();
    }
}
```

Add a static inner class for the response:

```java
public static class StatsResponse {
    public long totalLikes;

    public StatsResponse(long totalLikes) {
        this.totalLikes = totalLikes;
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

### Login as admin to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"admin","password":"Admin123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Call the stats endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/stats
```

### Expected success response (HTTP 200)

```json
{
  "totalLikes": 15
}
```

### Test with non-admin user (should fail)

```bash
# Login as regular user
USER_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access admin endpoint
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:8080/api/manage/stats
```

Expected response: `403 Forbidden`

### Verify likes in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.userlikes.countDocuments()"
```

Expected output: The count should match the `totalLikes` value returned by the API.

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Non-admin user | `403 Forbidden` | (Quarkus default forbidden response) |
| Server error | `500 Internal Server Error` | `An error occurred while retrieving statistics` |

---

## Summary of changed files

| File | Action |
|---|---|
| `repository/UserLikeRepository.java` | **Update** — add `countAll()` method |
| `service/QuoteManagementService.java` | **Update** — add `getTotalLikes()` method and inject `UserLikeRepository` |
| `resource/AdminResource.java` | **Update** — add `GET /api/manage/stats` endpoint and `StatsResponse` inner class |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- The `countAll()` method in `UserLikeRepository` uses Panache MongoDB's built-in `count()` method
- The response uses a simple `StatsResponse` class with a `totalLikes` field to match the C# response format
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
- This endpoint is part of the admin management API under `/api/manage` path
- The count includes all like records in the `userlikes` collection, regardless of which user created them
