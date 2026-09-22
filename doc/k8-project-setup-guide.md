# Kubernetes Project Setup Guide: Quote API with Quarkus and MongoDB

## Overview

This guide describes how to create a base Kubernetes project that can be deployed on any Cloud Provider supporting K8. The project implements a Quote API using Java Quarkus with MongoDB database.

**Technology Stack:**
- **Framework:** Quarkus (Java)
- **Database:** MongoDB with MongoDB Operator
- **Local Runtime:** Quarkus JVM in Kind K8 cluster
- **Cloud Runtime:** Quarkus Native (GraalVM)
- **K8 Context:** `kind-single-node` (already running)
- **Namespace:** `quote-k8-java`

## Prerequisites

- Kind K8 cluster running with context `kind-single-node`
- kubectl configured to use the Kind cluster
- Java 17+ installed
- Maven 3.8+ installed
- Podman installed (for building images)
- GraalVM installed (for native compilation, optional for local development)

## Project Structure

```
quote-k8-java/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── quote/
│   │   │           └── k8/
│   │   │               ├── QuoteApplication.java
│   │   │               ├── model/
│   │   │               │   └── Quote.java
│   │   │               ├── repository/
│   │   │               │   └── QuoteRepository.java
│   │   │               ├── service/
│   │   │               │   ├── QuoteService.java
│   │   │               │   └── ZenQuotesService.java
│   │   │               └── resource/
│   │   │                   └── QuoteResource.java
│   │   └── resources/
│   │       ├── application.properties
│   │       └── application-local.properties
│   └── test/
│       └── java/
├── k8/
│   ├── base/
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── mongodb/
│   │   ├── mongodb-operator.yaml
│   │   └── mongodb-cluster.yaml
│   ├── local/
│   │   ├── deployment-jvm.yaml
│   │   └── service-jvm.yaml
│   └── cloud/
│       ├── deployment-native.yaml
│       └── service-native.yaml
├── Containerfile.jvm
├── Containerfile.native
├── pom.xml
└── README.md
```

## Step 1: Create Kubernetes Namespace

Create the namespace `quote-k8-java` in your Kind cluster:

```bash
kubectl create namespace quote-k8-java --context=kind-single-node
```

Verify the namespace was created:

```bash
kubectl get namespaces --context=kind-single-node
```

## Step 2: Install MongoDB Operator using Helm

### 2.1 Prerequisites

Ensure Helm is installed:

```bash
# Check if Helm is installed
helm version

# If not installed, install Helm (macOS)
brew install helm

# Or install using script (Linux/macOS)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 2.2 Add MongoDB Helm Repository

```bash
# Add the MongoDB Community Helm repository
helm repo add mongodb https://mongodb.github.io/helm-charts

# Update the repository
helm repo update

# Verify the repository
helm search repo mongodb
```

### 2.3 Install MongoDB Operator

```bash
# Install the MongoDB Community Operator using Helm
helm install mongodb-operator mongodb/community-operator \
  --namespace quote-k8-java \
  --create-namespace \
  --set operator.createOperatorResource=true \
  --set operator.watchNamespace=quote-k8-java
```

```bash
# Verify the operator is running
kubectl get pods -n quote-k8-java --context=kind-single-node
```

### 2.4 Create MongoDB Cluster

Create `k8/mongodb/mongodb-cluster.yaml`:

```yaml
apiVersion: mongodbcommunity.mongodb.com/v1
kind: MongoDBCommunity
metadata:
  name: mongodb-cluster
  namespace: quote-k8-java
spec:
  members: 1
  type: ReplicaSet
  version: "6.0.0"
  security:
    authentication:
      modes: ["SCRAM"]
  users:
    - name: quote-user
      database: quote-db
      passwordSecretRef:
        name: mongodb-password
      roles:
        - name: readWrite
          db: quote-db
      scramCredentialsSecretName: quote-user-scram
---
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-password
  namespace: quote-k8-java
type: Opaque
stringData:
  password: "ChangeThisPassword123!"
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
  namespace: quote-k8-java
spec:
  selector:
    app: mongodb-cluster
  ports:
    - port: 27017
      targetPort: 27017
```

Apply the MongoDB configuration:

```bash
kubectl apply -f k8/mongodb/mongodb-cluster.yaml --context=kind-single-node
```

Verify MongoDB is running:

```bash
kubectl get pods -n quote-k8-java --context=kind-single-node
kubectl get mongodbcommunity -n quote-k8-java --context=kind-single-node
```

## Step 3: Create Quarkus Project

### 3.1 Generate Quarkus Project

Use the Quarkus CLI or Maven to create the project:

```bash
# Using Quarkus CLI (recommended)
quarkus create app com.quote:k8-quote-api \
    --extension=resteasy-reactive,jackson,mongodb-reactive,hibernate-validator,smallrye-openapi \
    --build-tool=maven

# Or using Maven
mvn io.quarkus.platform:quarkus-maven-plugin:create \
    -DprojectGroupId=com.quote \
    -DprojectArtifactId=k8-quote-api \
    -Dextensions="resteasy-reactive,jackson,mongodb-reactive,hibernate-validator,smallrye-openapi"
```

### 3.2 Update pom.xml

Add necessary dependencies to `pom.xml`:

```xml
<dependencies>
    <!-- Quarkus core -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-resteasy-reactive</artifactId>
    </dependency>
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-resteasy-reactive-jackson</artifactId>
    </dependency>
    
    <!-- MongoDB -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-mongodb-client</artifactId>
    </dependency>
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-mongodb-panache</artifactId>
    </dependency>
    
    <!-- Validation -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-hibernate-validator</artifactId>
    </dependency>
    
    <!-- OpenAPI -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-smallrye-openapi</artifactId>
    </dependency>
    
    <!-- HTTP Client for ZenQuotes API -->
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-rest-client-reactive</artifactId>
    </dependency>
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-rest-client-reactive-jackson</artifactId>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>io.quarkus.platform</groupId>
            <artifactId>quarkus-maven-plugin</artifactId>
            <version>${quarkus.platform.version}</version>
            <executions>
                <execution>
                    <goals>
                        <goal>build</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

## Step 4: Configure Application Properties

### 4.1 application.properties

```properties
# Application configuration
quarkus.application.name=quote-k8-api
quarkus.http.port=8080

# MongoDB configuration
quarkus.mongodb.connection-string=mongodb://quote-user:ChangeThisPassword123!@mongodb-service:27017/quote-db?authSource=admin
quarkus.mongodb.database=quote-db

# Logging
quarkus.log.category."com.quote".level=INFO

# OpenAPI
quarkus.swagger-ui.path=/swagger-ui
quarkus.swagger-ui.always-include=true

# Dev mode
%dev.quarkus.mongodb.connection-string=mongodb://localhost:27017/quote-db
```

### 4.2 application-local.properties (for local Kind deployment)

```properties
# Override for local Kind deployment
quarkus.mongodb.connection-string=mongodb://quote-user:ChangeThisPassword123!@mongodb-service.quote-k8-java.svc.cluster.local:27017/quote-db?authSource=admin
```

## Step 5: Implement Quote Model

Create `src/main/java/com/quote/k8/model/Quote.java`:

```java
package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "quotes")
public class Quote {

    @BsonId
    public ObjectId id;
    
    public Integer quoteId;  // Sequential ID for API compatibility
    public String quoteText;
    public String author;
    public Integer likeCount;
    public LocalDateTime createdAt;
    public String source;

    public Quote() {
        this.likeCount = 0;
        this.createdAt = LocalDateTime.now();
        this.source = "Local";
    }

    public Quote(Integer quoteId, String quoteText, String author) {
        this();
        this.quoteId = quoteId;
        this.quoteText = quoteText;
        this.author = author;
    }
}
```

## Step 6: Implement Quote Repository

Create `src/main/java/com/quote/k8/repository/QuoteRepository.java`:

```java
package com.quote.k8.repository;

import com.quote.k8.model.Quote;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class QuoteRepository implements PanacheMongoRepository {

    public Optional<Quote> findByQuoteId(Integer quoteId) {
        return find("quoteId", quoteId).firstResultOptional();
    }

    public List<Quote> findAllOrderByQuoteId() {
        return listAll("quoteId");
    }

    public Integer getMaxQuoteId() {
        Quote quote = find("order by quoteId desc").firstResult();
        return quote != null ? quote.quoteId : 0;
    }

    public boolean existsByText(String quoteText) {
        return count("quoteText", quoteText) > 0;
    }
}
```

## Step 7: Implement ZenQuotes Service

Create `src/main/java/com/quote/k8/service/ZenQuotesService.java`:

```java
package com.quote.k8.service;

import com.quote.k8.model.Quote;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Random;

@ApplicationScoped
public class ZenQuotesService {

    private static final Logger LOG = Logger.getLogger(ZenQuotesService.class);
    private static final String API_BASE_URL = "https://zenquotes.io/api";

    @Inject
    ZenQuotesClient zenQuotesClient;

    public Quote getRandomQuote() {
        try {
            List<ZenQuoteResponse> responses = zenQuotesClient.getRandom();
            if (responses == null || responses.isEmpty()) {
                throw new IllegalStateException("No quotes returned from ZenQuotes API");
            }
            ZenQuoteResponse response = responses.get(0);
            return mapToQuote(response);
        } catch (Exception e) {
            LOG.error("Error fetching random quote from ZenQuotes", e);
            throw new RuntimeException("Failed to fetch quote from ZenQuotes", e);
        }
    }

    public List<Quote> getMultipleQuotes() {
        try {
            List<ZenQuoteResponse> responses = zenQuotesClient.getQuotes();
            if (responses == null || responses.isEmpty()) {
                LOG.warn("No quotes returned from ZenQuotes API");
                return List.of();
            }
            return responses.stream()
                    .map(this::mapToQuote)
                    .toList();
        } catch (Exception e) {
            LOG.error("Error fetching multiple quotes from ZenQuotes", e);
            throw new RuntimeException("Failed to fetch quotes from ZenQuotes", e);
        }
    }

    private Quote mapToQuote(ZenQuoteResponse response) {
        Quote quote = new Quote();
        quote.quoteText = response.q;
        quote.author = response.a;
        quote.likeCount = 0;
        quote.createdAt = java.time.LocalDateTime.now();
        quote.source = "ZenQuotes";
        return quote;
    }

    @RegisterRestClient(baseUri = "https://zenquotes.io/api")
    public interface ZenQuotesClient {
        @GET
        @Path("/random")
        @Produces(MediaType.APPLICATION_JSON)
        List<ZenQuoteResponse> getRandom();

        @GET
        @Path("/quotes")
        @Produces(MediaType.APPLICATION_JSON)
        List<ZenQuoteResponse> getQuotes();
    }

    public static class ZenQuoteResponse {
        public String q;  // quote text
        public String a;  // author
        public String h;  // HTML
    }
}
```

## Step 8: Implement Quote Service

Create `src/main/java/com/quote/k8/service/QuoteService.java`:

```java
package com.quote.k8.service;

import com.quote.k8.model.Quote;
import com.quote.k8.repository.QuoteRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

@ApplicationScoped
public class QuoteService {

    private static final Logger LOG = Logger.getLogger(QuoteService.class);

    @Inject
    QuoteRepository quoteRepository;

    @Inject
    ZenQuotesService zenQuotesService;

    public Quote getRandomQuote() {
        return getRandomQuote(new HashSet<>());
    }

    public Quote getRandomQuote(Set<Integer> idsToExclude) {
        LOG.info("Getting random quote, excluding " + idsToExclude.size() + " IDs");
        
        int maxId = quoteRepository.getMaxQuoteId();
        LOG.info("Max quote ID in database: " + maxId);
        
        // Fetch more quotes if database is empty or has too few quotes
        if (maxId < 5 || maxId <= idsToExclude.size()) {
            LOG.info("Need to fetch more quotes (maxId=" + maxId + ", excludeCount=" + idsToExclude.size() + ")");
            fetchMoreQuotesIfNeeded();
            maxId = quoteRepository.getMaxQuoteId();
            LOG.info("After fetching, new max ID: " + maxId);
        }
        
        // Try to find a random quote not in exclusion list
        Random random = new Random();
        int maxAttempts = Math.min(100, maxId);
        Set<Integer> attemptedIds = new HashSet<>();
        
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            int candidateId = random.nextInt(maxId) + 1;
            if (idsToExclude.contains(candidateId) || attemptedIds.contains(candidateId)) {
                continue;
            }
            
            attemptedIds.add(candidateId);
            var quote = quoteRepository.findByQuoteId(candidateId);
            if (quote.isPresent()) {
                return quote.get();
            }
        }
        
        // Fallback: get all quotes and filter
        List<Quote> allQuotes = quoteRepository.findAllOrderByQuoteId();
        List<Quote> filteredQuotes = allQuotes.stream()
                .filter(q -> !idsToExclude.contains(q.quoteId))
                .toList();
        
        if (filteredQuotes.isEmpty()) {
            LOG.warn("No available quotes after excluding " + idsToExclude.size() + " IDs");
            throw new IllegalStateException("No quotes available");
        }
        
        return filteredQuotes.get(random.nextInt(filteredQuotes.size()));
    }

    private void fetchMoreQuotesIfNeeded() {
        try {
            LOG.info("Fetching quotes from ZenQuotes API");
            List<Quote> fetchedQuotes = zenQuotesService.getMultipleQuotes();
            LOG.info("Fetched " + (fetchedQuotes != null ? fetchedQuotes.size() : 0) + " quotes from ZenQuotes");
            
            List<Quote> currentDatabaseQuotes = quoteRepository.findAllOrderByQuoteId();
            LOG.info("Current database has " + currentDatabaseQuotes.size() + " quotes");
            
            Set<String> existingTexts = new HashSet<>();
            currentDatabaseQuotes.forEach(q -> existingTexts.add(q.quoteText));
            
            int nextId = quoteRepository.getMaxQuoteId() + 1;
            int addedCount = 0;
            
            if (fetchedQuotes != null) {
                for (Quote quote : fetchedQuotes) {
                    if (!existingTexts.contains(quote.quoteText)) {
                        int originalId = quote.quoteId;
                        quote.quoteId = nextId++;
                        LOG.info("Assigning new ID: " + quote.quoteId + " to quote (original ID: " + originalId + ")");
                        quoteRepository.persist(quote);
                        existingTexts.add(quote.quoteText);
                        addedCount++;
                    }
                }
            }
            
            LOG.info("Added " + addedCount + " new quotes to database");
        } catch (Exception e) {
            LOG.error("Failed to fetch quotes from ZenQuotes", e);
        }
    }
}
```

## Step 9: Implement Quote Resource (REST API)

Create `src/main/java/com/quote/k8/resource/QuoteResource.java`:

```java
package com.quote.k8.resource;

import com.quote.k8.model.Quote;
import com.quote.k8.service.QuoteService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/api/quotes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class QuoteResource {

    private static final Logger LOG = Logger.getLogger(QuoteResource.class);

    @Inject
    QuoteService quoteService;

    @GET
    @Path("/random")
    public Response getRandomQuote() {
        try {
            LOG.info("GET /api/quotes/random - Fetching random quote");
            Quote quote = quoteService.getRandomQuote();
            if (quote == null) {
                return Response.status(Response.Status.NOT_FOUND).entity("No quotes available").build();
            }
            return Response.ok(quote).build();
        } catch (Exception e) {
            LOG.error("Error fetching random quote", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Error fetching quote: " + e.getMessage())
                    .build();
        }
    }
}
```

## Step 10: Create Kubernetes Resources

### 10.1 Create ConfigMap

Create `k8/base/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: quote-api-config
  namespace: quote-k8-java
data:
  application.properties: |
    quarkus.application.name=quote-k8-api
    quarkus.http.port=8080
    quarkus.mongodb.connection-string=mongodb://quote-user:ChangeThisPassword123!@mongodb-service:27017/quote-db?authSource=admin
    quarkus.mongodb.database=quote-db
    quarkus.log.category."com.quote".level=INFO
```

### 10.2 Create JVM Deployment (Local Kind)

Create `k8/local/deployment-jvm.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: quote-api-jvm
  namespace: quote-k8-java
spec:
  replicas: 1
  selector:
    matchLabels:
      app: quote-api
      mode: jvm
  template:
    metadata:
      labels:
        app: quote-api
        mode: jvm
    spec:
      containers:
        - name: quote-api
          image: quote-api:latest-jvm
          imagePullPolicy: Never
          ports:
            - containerPort: 8080
          env:
            - name: QUARKUS_MONGODB_CONNECTION_STRING
              valueFrom:
                secretKeyRef:
                  name: mongodb-password
                  key: connection-string
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /q/health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /q/health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
```

### 10.3 Create JVM Service

Create `k8/local/service-jvm.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: quote-api-service
  namespace: quote-k8-java
spec:
  selector:
    app: quote-api
    mode: jvm
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

### 10.4 Create Native Deployment (Cloud)

Create `k8/cloud/deployment-native.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: quote-api-native
  namespace: quote-k8-java
spec:
  replicas: 2
  selector:
    matchLabels:
      app: quote-api
      mode: native
  template:
    metadata:
      labels:
        app: quote-api
        mode: native
    spec:
      containers:
        - name: quote-api
          image: quote-api:latest-native
          ports:
            - containerPort: 8080
          env:
            - name: QUARKUS_MONGODB_CONNECTION_STRING
              valueFrom:
                secretKeyRef:
                  name: mongodb-password
                  key: connection-string
          resources:
            requests:
              memory: "64Mi"
              cpu: "100m"
            limits:
              memory: "128Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /q/health/live
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /q/health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
```

### 10.5 Create Native Service (Cloud)

Create `k8/cloud/service-native.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: quote-api-service
  namespace: quote-k8-java
spec:
  selector:
    app: quote-api
    mode: native
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

## Step 11: Create Containerfiles

### 11.1 JVM Containerfile

Create `Containerfile.jvm`:

```dockerfile
FROM quay.io/quarkus/quarkus-maven:22.3-java17 AS build
COPY src /usr/src/app/src
COPY pom.xml /usr/src/app
RUN mvn -f /usr/src/app/pom.xml clean package -DskipTests

FROM registry.access.redhat.com/ubi8/openjdk-17-runtime
WORKDIR /work
COPY --from=build /usr/src/app/target/quarkus-app/lib/ /work/lib
COPY --from=build /usr/src/app/target/quarkus-app/*.jar /work/app.jar
COPY --from=build /usr/src/app/target/quarkus-app/quarkus-run.jar /work/quarkus-run.jar
EXPOSE 8080
CMD ["java", "-jar", "quarkus-run.jar"]
```

### 11.2 Native Containerfile

Create `Containerfile.native`:

```dockerfile
FROM quay.io/quarkus/ubi-quarkus-native-image:22.3-java17 AS build
COPY src /usr/src/app/src
COPY pom.xml /usr/src/app
RUN mvn -f /usr/src/app/pom.xml clean package -DskipTests -Dnative
FROM registry.access.redhat.com/ubi8/ubi-minimal
WORKDIR /work
COPY --from=build /usr/src/app/target/*-runner /work/application
EXPOSE 8080
CMD ["./application", "-Dquarkus.http.host=0.0.0.0"]
```

## Step 12: Local Deployment (Kind with JVM)

### 12.1 Build JVM Image

```bash
# Build the application
mvn clean package -DskipTests
```

```bash
docker build --platform linux/arm64 -f Containerfile.jvm -t quote-api:latest-jvm .
```

```bash
kind load docker-image quote-api:latest-jvm --name single-node
```

### 12.2 Deploy to Kind

```bash
# Apply Kubernetes resources
kubectl apply -f k8/base/configmap.yaml --context=kind-single-node
kubectl apply -f k8/local/deployment-jvm.yaml --context=kind-single-node
kubectl apply -f k8/local/service-jvm.yaml --context=kind-single-node
```

### 12.3 Verify Deployment

```bash
# Check pods
kubectl get pods -n quote-k8-java --context=kind-single-node

# Check service
kubectl get svc -n quote-k8-java --context=kind-single-node

# Get service URL
kubectl get svc quote-api-service -n quote-k8-java --context=kind-single-node

# View logs
kubectl logs -l app=quote-api,mode=jvm -n quote-k8-java --context=kind-single-node -f
```

### 12.4 Test the API

```bash
# Port forward to test locally
kubectl port-forward svc/quote-api-service 8080:80 -n quote-k8-java --context=kind-single-node

# Test the endpoint
curl http://localhost:8080/api/quotes/random
```

## Step 13: Cloud Deployment (Native with GraalVM)

### 13.1 Build Native Image

```bash
# Build native executable
mvn clean package -Dnative -DskipTests

# Build container image
podman build -f Containerfile.native -t your-registry/quote-api:latest-native .

# Push to container registry
podman push your-registry/quote-api:latest-native
```

### 13.2 Update Deployment for Cloud

Update `k8/cloud/deployment-native.yaml` to use your registry:

```yaml
image: your-registry/quote-api:latest-native
imagePullPolicy: Always
```

### 13.3 Deploy to Cloud

```bash
# Apply Kubernetes resources (same as local, but using native manifests)
kubectl apply -f k8/base/configmap.yaml
kubectl apply -f k8/cloud/deployment-native.yaml
kubectl apply -f k8/cloud/service-native.yaml
```

### 13.4 Verify Cloud Deployment

```bash
# Check pods
kubectl get pods -n quote-k8-java

# Check service
kubectl get svc -n quote-k8-java

# Test the endpoint
curl http://<EXTERNAL-IP>/api/quotes/random
```

## Step 14: Testing the /api/quotes/random Endpoint

The `/api/quotes/random` endpoint should:

1. **First call (empty database):**
   - Detect that database has < 5 quotes
   - Fetch quotes from ZenQuotes API (https://zenquotes.io/api/quotes)
   - Store fetched quotes in MongoDB
   - Return a random quote from the newly stored quotes

2. **Subsequent calls (database has quotes):**
   - Check if database has sufficient quotes (> 5 and not all excluded)
   - Return a random quote from the database
   - Only fetch from ZenQuotes if needed

### Test with HTTP file

Create `test-api.http`:

```http
### Test random quote endpoint
GET http://localhost:8080/api/quotes/random

### Test with exclusions
POST http://localhost:8080/api/quote
Content-Type: application/json

[1, 2, 3, 4, 5]
```

## Step 15: Monitoring and Logging

### 15.1 View Application Logs

```bash
# For Kind deployment
kubectl logs -l app=quote-api,mode=jvm -n quote-k8-java --context=kind-single-node -f

# For cloud deployment
kubectl logs -l app=quote-api,mode=native -n quote-k8-java -f
```

### 15.2 Health Checks

Quarkus provides built-in health endpoints:

- `/q/health/live` - Liveness probe
- `/q/health/ready` - Readiness probe
- `/q/health` - Combined health status

### 15.3 Metrics

Enable metrics in `application.properties`:

```properties
quarkus.smallrye-metrics.enabled=true
```

Access metrics at `/q/metrics`.

## Step 16: Cloud Provider Specific Configuration

The same Kubernetes manifests work across different cloud providers. Only the following may need adjustment:

### 16.1 Image Registry

Update the image name in deployment manifests:
- **AWS ECR:** `123456789.dkr.ecr.us-east-1.amazonaws.com/quote-api:latest-native`
- **GCP GCR:** `gcr.io/your-project/quote-api:latest-native`
- **Azure ACR:** `yourregistry.azurecr.io/quote-api:latest-native`

### 16.2 Service Type

For cloud deployments, consider using:
- `LoadBalancer` for external access (default in this guide)
- `Ingress` with ingress controller for more control
- `ClusterIP` with port-forward for internal access only

### 16.3 Storage

For production MongoDB, consider:
- Using cloud-specific MongoDB Atlas
- Persistent volumes with cloud storage classes
- Backup and disaster recovery solutions

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check MongoDB pod status
kubectl get pods -n quote-k8-java -l app=mongodb-cluster

# Check MongoDB logs
kubectl logs -l app=mongodb-cluster -n quote-k8-java

# Test MongoDB connection from application pod
kubectl exec -it <pod-name> -n quote-k8-java -- mongosh mongodb://quote-user:password@mongodb-service:27017/quote-db
```

### Application Startup Issues

```bash
# Check application logs
kubectl logs -l app=quote-api -n quote-k8-java

# Describe pod for events
kubectl describe pod <pod-name> -n quote-k8-java
```

### Image Pull Issues

```bash
# For Kind, ensure image is loaded
podman save quote-api:latest-jvm | kind load image-archive - --name kind-single-node

# For cloud, ensure registry credentials are set up
kubectl create secret docker-registry regcred \
  --docker-server=<registry-url> \
  --docker-username=<username> \
  --docker-password=<password> \
  -n quote-k8-java
```

## Summary

This guide provides a complete setup for a cloud-agnostic Kubernetes project using:
- **Quarkus** for fast startup and low memory footprint
- **MongoDB with Operator** for database management
- **Kind** for local development and testing
- **Native compilation** for optimized cloud deployment
- **Cloud-agnostic manifests** for deployment across any K8 provider

The `/api/quotes/random` endpoint is implemented to fetch quotes from ZenQuotes API when the database is empty and return random quotes from the database thereafter, matching the functionality from the existing C# backend.
