# Implementation: POST /api/manage/quotes/fetch (Admin Only)

Migrate the C# `POST /api/manage/quotes/fetch` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Extracts the `username` from the JWT
- Fetches quotes from the external ZenQuotes API (https://zenquotes.io/api/quotes)
- Checks for duplicates (by quote text and author, case-insensitive)
- Adds only new quotes to the database
- Assigns sequential IDs to new quotes
- Returns a response with the number of quotes added and total count
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpPost("quotes/fetch")]
public async Task<ActionResult<QuoteAddResponse>> FetchQuotes()
{
    var username = User.FindFirst("unique_name")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
    if (string.IsNullOrEmpty(username))
        return Unauthorized();

    try
    {
        var result = await _adminService.FetchAndAddNewQuotesAsync(username);
        return Ok(result);
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while fetching quotes");
    }
}
```

### Service: AdminService.cs

```csharp
public async Task<QuoteAddResponse> FetchAndAddNewQuotesAsync(string requestingUsername)
{
    return await _quoteManagementService.FetchAndAddNewQuotesAsync(requestingUsername);
}
```

### Service: QuoteManagementService.cs

```csharp
public async Task<QuoteAddResponse> FetchAndAddNewQuotesAsync(string requestingUsername)
{
    try
    {
        var newQuotes = await _zenQuotesService.GetMultipleQuotesAsync();
        var addedCount = 0;

        foreach (var quote in newQuotes)
        {
            // Check if quote already exists (by text and author)
            var existingQuotes = await _quoteRepository.GetAllQuotesAsync();
            var exists = existingQuotes.Any(q => 
                q.QuoteText.Equals(quote.QuoteText, StringComparison.OrdinalIgnoreCase) && 
                q.Author.Equals(quote.Author, StringComparison.OrdinalIgnoreCase));

            if (!exists)
            {
                // Assign new ID
                var maxId = existingQuotes.Any() ? existingQuotes.Max(q => q.Id) : 0;
                quote.Id = maxId + 1;
                
                await _quoteRepository.AddQuoteAsync(quote);
                addedCount++;
            }
        }

        var totalQuotes = (await _quoteRepository.GetAllQuotesAsync()).Count;

        _logger.LogInformation("Added {AddedCount} new quotes by {Username}", addedCount, requestingUsername);

        return new QuoteAddResponse
        {
            QuotesAdded = addedCount,
            TotalQuotes = totalQuotes,
            Message = $"Successfully added {addedCount} new quotes"
        };
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error fetching and adding new quotes");
        throw;
    }
}
```

### Service: ZenQuotesService.cs

```csharp
public async Task<List<Quote>> GetMultipleQuotesAsync()
{
    try
    {
        var response = await _httpClient.GetFromJsonAsync<ZenQuoteResponse[]>("quotes");
        if (response == null || response.Length == 0)
        {
            _logger.LogWarning("No quotes returned from ZenQuotes API");
            return new List<Quote>();
        }

        var quotes = new List<Quote>();
        foreach (var zenQuote in response)
        {
            quotes.Add(new Quote
            {
                QuoteText = zenQuote.q,
                Author = zenQuote.a,
                LikeCount = 0,
                CreatedAt = DateTime.UtcNow,
                Source = "ZenQuotes"
            });
        }

        return quotes;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error fetching multiple quotes from ZenQuotes API");
        throw;
    }
}

public class ZenQuoteResponse
{
    public string q { get; set; } = string.Empty; // quote text
    public string a { get; set; } = string.Empty; // author
    public string h { get; set; } = string.Empty; // HTML
}
```

### Model: QuoteAddResponse.cs

```csharp
namespace quote_azure_k8_backend.Models
{
    public class QuoteAddResponse
    {
        public int QuotesAdded { get; set; }
        public int TotalQuotes { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
```

### Model: Quote.cs

```csharp
namespace quote_azure_k8_backend.Models
{
    public class Quote
    {
        public int Id { get; set; }
        public string QuoteText { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public int LikeCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public string Source { get; set; } = "Local";
    }
}
```

---

## Java Migration

### 1. Create QuoteAddResponse DTO

Create `QuoteAddResponse.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

public class QuoteAddResponse {
    public int quotesAdded;
    public int totalQuotes;
    public String message;

    // Constructors
    public QuoteAddResponse() {}

    public QuoteAddResponse(int quotesAdded, int totalQuotes, String message) {
        this.quotesAdded = quotesAdded;
        this.totalQuotes = totalQuotes;
        this.message = message;
    }
}
```

---

### 2. Create ZenQuotesService

Create `ZenQuotesService.java` in `com.quote.k8.service`:

```java
package com.quote.k8.service;

import com.quote.k8.model.Quote;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class ZenQuotesService {

    private static final Logger LOG = Logger.getLogger(ZenQuotesService.class);
    private static final String ZEN_QUOTES_API_URL = "https://zenquotes.io/api/quotes";

    public List<Quote> getMultipleQuotes() {
        try {
            LOG.info("Fetching quotes from ZenQuotes API");
            
            // Use Rest Client or HTTP Client to fetch quotes
            // For simplicity, using java.net.http.HttpClient
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(ZEN_QUOTES_API_URL))
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, 
                    java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                LOG.warn("ZenQuotes API returned status: " + response.statusCode());
                return new ArrayList<>();
            }

            // Parse JSON response
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            ZenQuoteResponse[] zenQuotes = mapper.readValue(response.body(), ZenQuoteResponse[].class);

            if (zenQuotes == null || zenQuotes.length == 0) {
                LOG.warn("No quotes returned from ZenQuotes API");
                return new ArrayList<>();
            }

            List<Quote> quotes = new ArrayList<>();
            for (ZenQuoteResponse zenQuote : zenQuotes) {
                Quote quote = new Quote();
                quote.quoteText = zenQuote.q;
                quote.author = zenQuote.a;
                quote.likeCount = 0;
                quote.createdAt = LocalDateTime.now();
                quote.source = "ZenQuotes";
                quotes.add(quote);
            }

            LOG.info("Fetched " + quotes.size() + " quotes from ZenQuotes API");
            return quotes;
        } catch (Exception e) {
            LOG.error("Error fetching quotes from ZenQuotes API", e);
            throw new RuntimeException("Failed to fetch quotes from external API", e);
        }
    }

    // Inner class for JSON mapping
    public static class ZenQuoteResponse {
        public String q; // quote text
        public String a; // author
        public String h; // HTML
    }
}
```

---

### 3. Update QuoteManagementService

Add the `fetchAndAddNewQuotes` method to `QuoteManagementService.java`:

```java
public QuoteAddResponse fetchAndAddNewQuotes(String requestingUsername) {
    LOG.info("Fetching and adding new quotes for user: " + requestingUsername);

    try {
        List<Quote> newQuotes = zenQuotesService.getMultipleQuotes();
        int addedCount = 0;

        List<Quote> existingQuotes = quoteRepository.findAllQuotes();

        for (Quote quote : newQuotes) {
            // Check if quote already exists (by text and author, case-insensitive)
            boolean exists = existingQuotes.stream()
                    .anyMatch(q -> q.quoteText != null && q.quoteText.equalsIgnoreCase(quote.quoteText) 
                            && q.author != null && q.author.equalsIgnoreCase(quote.author));

            if (!exists) {
                // Assign new ID
                int maxId = existingQuotes.stream()
                        .mapToInt(q -> q.quoteId != null ? q.quoteId : 0)
                        .max()
                        .orElse(0);
                quote.quoteId = maxId + 1;

                quoteRepository.persist(quote);
                addedCount++;
                existingQuotes.add(quote); // Add to list to avoid duplicates in same batch
            }
        }

        int totalQuotes = quoteRepository.findAllQuotes().size();

        LOG.info("Added " + addedCount + " new quotes by " + requestingUsername);

        return new QuoteAddResponse(
                addedCount,
                totalQuotes,
                "Successfully added " + addedCount + " new quotes"
        );
    } catch (Exception e) {
        LOG.error("Error fetching and adding new quotes", e);
        throw new RuntimeException("Failed to fetch and add quotes", e);
    }
}
```

Add the necessary imports at the top of `QuoteManagementService.java`:

```java
import com.quote.k8.dto.QuoteAddResponse;
import com.quote.k8.service.ZenQuotesService;
```

Add the ZenQuotesService injection:

```java
@Inject
ZenQuotesService zenQuotesService;
```

---

### 4. Update AdminResource

Add the `POST /api/manage/quotes/fetch` endpoint to `AdminResource.java`:

```java
@POST
@Path("/quotes/fetch")
@RolesAllowed("ADMIN")
public Response fetchQuotes() {
    try {
        String username = jwt.getClaim("username");
        LOG.info("POST /api/manage/quotes/fetch - Fetching quotes for admin: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        QuoteAddResponse response = quoteManagementService.fetchAndAddNewQuotes(username);
        return Response.ok(response).build();
    } catch (Exception e) {
        LOG.error("Error fetching quotes", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while fetching quotes")
                .build();
    }
}
```

Add the necessary import at the top of `AdminResource.java`:

```java
import com.quote.k8.dto.QuoteAddResponse;
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

### Call the fetch quotes endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/quotes/fetch
```

### Expected success response (HTTP 200)

```json
{
  "quotesAdded": 5,
  "totalQuotes": 155,
  "message": "Successfully added 5 new quotes"
}
```

If no new quotes are found (all duplicates):

```json
{
  "quotesAdded": 0,
  "totalQuotes": 150,
  "message": "Successfully added 0 new quotes"
}
```

### Test with non-admin user (should fail)

```bash
# Login as regular user
USER_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access admin endpoint
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:8080/api/manage/quotes/fetch
```

Expected response: `403 Forbidden`

### Verify quotes in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.quotes.find({source: 'ZenQuotes'}).limit(5).pretty()"
```

### Check total quote count

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.quotes.countDocuments()"
```

### Test duplicate detection

Call the endpoint multiple times to verify duplicate detection works:

```bash
# First call
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/quotes/fetch

# Second call (should add 0 or fewer quotes)
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/quotes/fetch
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Non-admin user | `403 Forbidden` | (Quarkus default forbidden message) |
| External API error | `500 Internal Server Error` | `An error occurred while fetching quotes` |
| Database error | `500 Internal Server Error` | `An error occurred while fetching quotes` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/QuoteAddResponse.java` | **Create** — new DTO class for quote add response |
| `service/ZenQuotesService.java` | **Create** — new service for fetching quotes from ZenQuotes API |
| `service/QuoteManagementService.java` | **Update** — add `fetchAndAddNewQuotes()` method and inject ZenQuotesService |
| `resource/AdminResource.java` | **Update** — add `POST /api/manage/quotes/fetch` endpoint |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- The ZenQuotes API endpoint is: https://zenquotes.io/api/quotes
- Duplicate detection is case-insensitive and checks both quote text and author
- New quotes are assigned sequential IDs based on the maximum existing ID
- New quotes have `likeCount=0`, `createdAt=LocalDateTime.now()`, and `source="ZenQuotes"`
- The endpoint returns the number of quotes actually added (duplicates are skipped)
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
- This endpoint is part of the admin management API under `/api/manage` path
- The implementation uses `java.net.http.HttpClient` for HTTP requests (alternatively, consider using Quarkus Rest Client for better integration)
- Consider adding rate limiting to prevent abuse of the external API
- Consider adding retry logic for external API failures
