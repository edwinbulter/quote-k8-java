# Implementation: GET /api/manage/quotes (Admin Only)

Migrate the C# `GET /api/manage/quotes` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Returns quotes with pagination support
- Supports filtering by `quoteText` and `author` (case-insensitive partial match)
- Supports sorting by `id`, `author`, `created`, or `likes` with `asc` or `desc` order
- Returns paginated response with quotes, total count, page info, and total pages
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpGet("quotes")]
public async Task<ActionResult<QuotePageResponse>> GetQuotes(
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 50,
    [FromQuery] string? sortBy = "id",
    [FromQuery] string? sortOrder = "asc",
    [FromQuery] string? quoteText = null,
    [FromQuery] string? author = null)
{
    try
    {
        var quotes = await _adminService.GetQuotesAsync(page, pageSize, quoteText, author, sortBy, sortOrder);
        return Ok(quotes);
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while retrieving quotes");
    }
}
```

### Service: QuoteManagementService.cs

```csharp
public async Task<QuotePageResponse> GetQuotesAsync(int page, int pageSize, string? quoteText, string? author, string? sortBy, string? sortOrder)
{
    try
    {
        var allQuotes = await _quoteRepository.GetAllQuotesAsync();
        
        // Apply filters
        if (!string.IsNullOrEmpty(quoteText))
        {
            allQuotes = allQuotes.Where(q => q.QuoteText.Contains(quoteText, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        
        if (!string.IsNullOrEmpty(author))
        {
            allQuotes = allQuotes.Where(q => q.Author.Contains(author, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        // Apply sorting
        if (!string.IsNullOrEmpty(sortBy))
        {
            switch (sortBy.ToLower())
            {
                case "author":
                    allQuotes = sortOrder?.ToLower() == "desc" 
                        ? allQuotes.OrderByDescending(q => q.Author).ToList()
                        : allQuotes.OrderBy(q => q.Author).ToList();
                    break;
                case "created":
                    allQuotes = sortOrder?.ToLower() == "desc"
                        ? allQuotes.OrderByDescending(q => q.CreatedAt).ToList()
                        : allQuotes.OrderBy(q => q.CreatedAt).ToList();
                    break;
                case "likes":
                    allQuotes = sortOrder?.ToLower() == "desc"
                        ? allQuotes.OrderByDescending(q => q.LikeCount).ToList()
                        : allQuotes.OrderBy(q => q.LikeCount).ToList();
                    break;
                default:
                    allQuotes = sortOrder?.ToLower() == "desc"
                        ? allQuotes.OrderByDescending(q => q.Id).ToList()
                        : allQuotes.OrderBy(q => q.Id).ToList();
                    break;
            }
        }
        else
        {
            allQuotes = allQuotes.OrderBy(q => q.Id).ToList();
        }

        var totalCount = allQuotes.Count;
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
        var quotes = allQuotes.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return new QuotePageResponse
        {
            Quotes = quotes,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error getting quotes with pagination");
        throw;
    }
}
```

### Model: QuotePageResponse.cs

```csharp
namespace quote_azure_k8_backend.Models
{
    public class QuotePageResponse
    {
        public List<Quote> Quotes { get; set; } = new List<Quote>();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }
}
```

---

## Java Migration

### 1. Create QuotePageResponse DTO

Create `QuotePageResponse.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

import com.quote.k8.model.Quote;
import java.util.List;

public class QuotePageResponse {
    public List<Quote> quotes;
    public int totalCount;
    public int page;
    public int pageSize;
    public int totalPages;

    // Constructors
    public QuotePageResponse() {}

    public QuotePageResponse(List<Quote> quotes, int totalCount, int page, int pageSize, int totalPages) {
        this.quotes = quotes;
        this.totalCount = totalCount;
        this.page = page;
        this.pageSize = pageSize;
        this.totalPages = totalPages;
    }
}
```

---

### 2. Update QuoteRepository

Add methods to support filtering and sorting in `QuoteRepository.java`:

```java
public List<Quote> findAllQuotes() {
    return findAll().list();
}

public List<Quote> findByQuoteTextContainingIgnoreCase(String quoteText) {
    return find("quoteText like ?1", "%" + quoteText + "%").list();
}

public List<Quote> findByAuthorContainingIgnoreCase(String author) {
    return find("author like ?1", "%" + author + "%").list();
}
```

---

### 3. Create QuoteManagementService

Create `QuoteManagementService.java` in `com.quote.k8.service`:

```java
package com.quote.k8.service;

import com.quote.k8.dto.QuotePageResponse;
import com.quote.k8.model.Quote;
import com.quote.k8.repository.QuoteRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class QuoteManagementService {

    private static final Logger LOG = Logger.getLogger(QuoteManagementService.class);

    @Inject
    QuoteRepository quoteRepository;

    public QuotePageResponse getQuotes(int page, int pageSize, String quoteText, String author, String sortBy, String sortOrder) {
        LOG.info("Getting quotes with pagination - page: " + page + ", pageSize: " + pageSize + 
                 ", sortBy: " + sortBy + ", sortOrder: " + sortOrder);

        List<Quote> allQuotes = quoteRepository.findAllQuotes();

        // Apply filters
        if (quoteText != null && !quoteText.isBlank()) {
            allQuotes = allQuotes.stream()
                    .filter(q -> q.quoteText != null && q.quoteText.toLowerCase().contains(quoteText.toLowerCase()))
                    .collect(Collectors.toList());
        }

        if (author != null && !author.isBlank()) {
            allQuotes = allQuotes.stream()
                    .filter(q -> q.author != null && q.author.toLowerCase().contains(author.toLowerCase()))
                    .collect(Collectors.toList());
        }

        // Apply sorting
        if (sortBy != null && !sortBy.isBlank()) {
            Comparator<Quote> comparator;
            boolean descending = sortOrder != null && sortOrder.equalsIgnoreCase("desc");

            switch (sortBy.toLowerCase()) {
                case "author":
                    comparator = Comparator.comparing(q -> q.author != null ? q.author.toLowerCase() : "");
                    break;
                case "created":
                    comparator = Comparator.comparing(q -> q.createdAt != null ? q.createdAt : java.time.LocalDateTime.MIN);
                    break;
                case "likes":
                    comparator = Comparator.comparing(q -> q.likeCount != null ? q.likeCount : 0);
                    break;
                case "id":
                default:
                    comparator = Comparator.comparing(q -> q.quoteId != null ? q.quoteId : 0);
                    break;
            }

            if (descending) {
                comparator = comparator.reversed();
            }

            allQuotes = allQuotes.stream()
                    .sorted(comparator)
                    .collect(Collectors.toList());
        } else {
            // Default sort by quoteId ascending
            allQuotes = allQuotes.stream()
                    .sorted(Comparator.comparing(q -> q.quoteId != null ? q.quoteId : 0))
                    .collect(Collectors.toList());
        }

        int totalCount = allQuotes.size();
        int totalPages = (int) Math.ceil((double) totalCount / pageSize);

        // Apply pagination
        int fromIndex = (page - 1) * pageSize;
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Quote> paginatedQuotes = allQuotes.subList(fromIndex, toIndex);

        LOG.info("Returning " + paginatedQuotes.size() + " quotes (total: " + totalCount + ", pages: " + totalPages + ")");

        return new QuotePageResponse(paginatedQuotes, totalCount, page, pageSize, totalPages);
    }
}
```

---

### 4. Update AdminResource

Add the `GET /api/manage/quotes` endpoint to `AdminResource.java`:

```java
@Inject
QuoteManagementService quoteManagementService;

@GET
@Path("/quotes")
@RolesAllowed("ADMIN")
public Response getQuotes(
        @QueryParam("page") @DefaultValue("1") int page,
        @QueryParam("pageSize") @DefaultValue("50") int pageSize,
        @QueryParam("sortBy") @DefaultValue("id") String sortBy,
        @QueryParam("sortOrder") @DefaultValue("asc") String sortOrder,
        @QueryParam("quoteText") String quoteText,
        @QueryParam("author") String author) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("GET /api/manage/quotes - Fetching quotes for admin: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        QuotePageResponse response = quoteManagementService.getQuotes(page, pageSize, quoteText, author, sortBy, sortOrder);
        return Response.ok(response).build();
    } catch (Exception e) {
        LOG.error("Error fetching quotes", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while retrieving quotes")
                .build();
    }
}
```

Add the necessary import at the top of `AdminResource.java`:

```java
import com.quote.k8.dto.QuotePageResponse;
import com.quote.k8.service.QuoteManagementService;
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

### Login as admin to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"admin","password":"Admin123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Test basic pagination (page 2, 50 per page, sorted by id ascending)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/manage/quotes?page=2&pageSize=50&sortBy=id&sortOrder=asc"
```

### Test with filtering by quote text

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/manage/quotes?quoteText=love&sortBy=likes&sortOrder=desc"
```

### Test with filtering by author

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/manage/quotes?author=Einstein&sortBy=created&sortOrder=desc"
```

### Test with combined filters

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/manage/quotes?quoteText=life&author=King&page=1&pageSize=10&sortBy=likes&sortOrder=desc"
```

### Expected success response (HTTP 200)

```json
{
  "quotes": [
    {
      "id": "...",
      "quoteId": 51,
      "quoteText": "The only way to do great work is to love what you do.",
      "author": "Steve Jobs",
      "likeCount": 15,
      "createdAt": "2026-05-22T10:00:00",
      "source": "ZenQuotes"
    },
    {
      "id": "...",
      "quoteId": 52,
      "quoteText": "Life is what happens when you're busy making other plans.",
      "author": "John Lennon",
      "likeCount": 12,
      "createdAt": "2026-05-22T11:00:00",
      "source": "ZenQuotes"
    }
  ],
  "totalCount": 150,
  "page": 2,
  "pageSize": 50,
  "totalPages": 3
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
  "http://localhost:8080/api/manage/quotes?page=1&pageSize=50"
```

Expected response: `403 Forbidden`

### Verify quotes in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.quotes.find().limit(5).pretty()"
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Non-admin user | `403 Forbidden` | (Quarkus default forbidden message) |
| Server error | `500 Internal Server Error` | `An error occurred while retrieving quotes` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/QuotePageResponse.java` | **Create** — new DTO class for paginated quote response |
| `repository/QuoteRepository.java` | **Update** — add filtering methods |
| `service/QuoteManagementService.java` | **Create** — new service for quote management operations |
| `resource/AdminResource.java` | **Update** — add `GET /api/manage/quotes` endpoint and inject QuoteManagementService |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- Default values: `page=1`, `pageSize=50`, `sortBy=id`, `sortOrder=asc`
- Filter parameters (`quoteText`, `author`) are optional and perform case-insensitive partial matches
- Supported sort fields: `id`, `author`, `created`, `likes`
- Supported sort orders: `asc`, `desc`
- Pagination is zero-based in the backend (uses `Skip` and `Take` in C#, `subList` in Java)
- The endpoint returns an empty quotes array if no quotes match the filters (HTTP 200)
- This endpoint is part of the admin management API under `/api/manage` path
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
