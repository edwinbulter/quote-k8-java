# Implement GET /api/quotes/{id} Endpoint

This document describes how to implement a public endpoint that returns a quote by its ID.

## Endpoint Specification

- **Method**: GET
- **Path**: `/api/quotes/{id}`
- **Access**: Public (no authentication required)
- **Example**: `GET {{baseUrl}}/api/quotes/1`
- **Response**: Quote object in JSON format or 404 if not found

**Note**: The path uses `/api/quotes/{id}` (plural) instead of `/api/quote/{id}` to avoid a path conflict with the existing authenticated endpoint `GET /api/quote`.

## Implementation Steps

### 1. Add Service Method to QuoteService

Add a new method to `QuoteService.java` to retrieve a quote by its ID:

```java
public Optional<Quote> getQuoteById(Integer quoteId) {
    LOG.info("Getting quote by ID: " + quoteId);
    return quoteRepository.findByQuoteId(quoteId);
}
```

**Location**: `/quote-api/src/main/java/com/quote/k8s/service/QuoteService.java`

Add this method after the existing methods, for example after `getRandomQuote()`.

### 2. Add Endpoint to QuoteResource

Add a new GET endpoint to `QuoteResource.java`:

```java
@GET
@Path("/quotes/{id}")
public Response getQuoteById(@PathParam("id") Integer id) {
    try {
        LOG.info("GET /api/quotes/" + id + " - Fetching quote by ID");
        
        var quoteOpt = quoteService.getQuoteById(id);
        if (quoteOpt.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Quote not found with ID: " + id)
                    .build();
        }
        
        return Response.ok(quoteOpt.get()).build();
    } catch (Exception e) {
        LOG.error("Error fetching quote by ID: " + id, e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("Error fetching quote: " + e.getMessage())
                .build();
    }
}
```

**Location**: `/quote-api/src/main/java/com/quote/k8s/resource/QuoteResource.java`

Add this method at the end of the class, after all other endpoint methods.

**Key Points**:
- No `@Authenticated` annotation - this makes the endpoint public
- Uses `@PathParam("id")` to extract the ID from the URL
- Returns 404 if the quote doesn't exist
- Returns 500 for any unexpected errors
- Logs the request and any errors
- Path is `/api/quotes/{id}` (plural) to avoid conflict with existing `GET /api/quote` endpoint

## Deployment

### 1. Build the Application

Navigate to the `quote-api` directory and build the application:

```bash
cd quote-api
mvn clean package -DskipTests
```

### 2. Build Container Image for Kind

Build the JVM container image using Podman:

```bash
podman build -f Containerfile.jvm -t quote-api:latest-jvm .
```

### 3. Load Image into Kind Cluster

Load the image into your Kind cluster:

```bash
kind load docker-image quote-api:latest-jvm --name kind-single-node
```

### 4. Deploy to Kind

Apply the Kubernetes manifests for local deployment:

```bash
kubectl apply -f k8s/local/deployment-jvm.yaml --context=kind-single-node
kubectl apply -f k8s/local/service-jvm.yaml --context=kind-single-node
```

### 5. Verify Deployment

Check that the deployment is successful:

```bash
# Check pods
kubectl get pods -n quote-k8-java --context=kind-single-node

# Check service
kubectl get svc -n quote-k8-java --context=kind-single-node

# View logs
kubectl logs -l app=quote-api,mode=jvm -n quote-k8-java --context=kind-single-node -f
```

### 6. Get Service URL

Get the external IP or port to access the service:

```bash
# For Kind, get the node port
kubectl get svc quote-api-service -n quote-k8-java --context=kind-single-node

# Or port-forward for local testing
kubectl port-forward svc/quote-api-service 8080:80 -n quote-k8-java --context=kind-single-node
```

The service will be available at `http://localhost:8080` when using port-forward.

## Testing

### 1. Using HTTP Client

Add to your `doc/test-api.http` file:

```http
### Get quote by ID
GET {{baseUrl}}/api/quotes/1

### Get quote by ID (non-existent)
GET {{baseUrl}}/api/quotes/999
```

### 2. Using curl

Test the endpoint directly with curl:

```bash
# Test with existing quote ID
curl http://localhost:8080/api/quotes/1

# Test with non-existent quote ID
curl http://localhost:8080/api/quotes/999
```

### 3. Expected Response

**Success (200 OK)**:
```json
{
  "id": "...",
  "quoteId": 1,
  "quoteText": "Your quote text here",
  "author": "Author Name",
  "likeCount": 5,
  "createdAt": "2024-01-01T12:00:00",
  "source": "Local"
}
```

**Not Found (404)**:
```json
"Quote not found with ID: 999"
```

### 4. Integration Testing

Test the endpoint in the Kind cluster context:

```bash
# Get the service endpoint
kubectl get svc quote-api-service -n quote-k8-java --context=kind-single-node

# Test using the service name from within the cluster
kubectl run test-pod --image=curlimages/curl -i --rm --restart=Never -- \
  curl http://quote-api-service.quote-k8-java.svc.cluster.local/api/quote/1
```

### 5. Verify Logs

Check the application logs to verify the endpoint is working:

```bash
kubectl logs -l app=quote-api,mode=jvm -n quote-k8-java --context=kind-single-node
```

You should see log entries like:
```
INFO  [com.quot.k8.res.QuoteResource] (executor-thread-1) GET /api/quote/1 - Fetching quote by ID
INFO  [com.quot.k8.ser.QuoteService] (executor-thread-1) Getting quote by ID: 1
```

## Notes

- The endpoint uses the existing `QuoteRepository.findByQuoteId()` method
- The `quoteId` field in the `Quote` model is a sequential Integer ID for API compatibility
- The MongoDB `_id` is stored in the `id` field but is not used for API lookups
- This endpoint follows the same error handling pattern as other endpoints in the resource class
- The endpoint is public (no `@Authenticated` annotation) and can be accessed without authentication
- For cloud deployment, use the native deployment manifests in `k8s/cloud/` instead of the JVM manifests
