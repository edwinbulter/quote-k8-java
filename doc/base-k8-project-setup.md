# Base Kubernetes Project Setup

This document describes how to create a base Kubernetes project that can be deployed on any Cloud Provider that supports Kubernetes.

## Requirements

- **Local Development**: Use the already locally running Kind K8 cluster (context=kind-multi-node-cluster)
- **Namespace**: Use the new namespace `quote-k8-java` for the application
- **API Framework**: Java Quarkus
- **Database**: MongoDB with MongoDB Operator
- **Local Execution**: Run with Quarkus JVM in Kind K8
- **Cloud Execution**: Run in the cloud with Quarkus Native (GraalVM)

---

## Prerequisites

### 1. Kind Cluster Setup

Ensure Kind cluster is running:

```bash
kind get clusters
kind get kubeconfig --name multi-node-cluster
kubectl config use-context kind-multi-node-cluster
```

### 2. Create Namespace

```bash
kubectl create namespace quote-k8-java
```

### 3. Install MongoDB Operator

```bash
# Add MongoDB Community Kubernetes Operator
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/master/config/namespace.yaml -n quote-k8-java
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/master/config/rbac.yaml -n quote-k8-java
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/master/config/crd.yaml -n quote-k8-java
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-kubernetes-operator/master/config/operator.yaml -n quote-k8-java
```

Or use the provided MongoDB cluster YAML:

```bash
kubectl apply -f k8/mongodb/mongodb-cluster.yaml -n quote-k8-java
```

---

## Project Structure

```
quote-k8-java/
├── k8-quote-api/              # Quarkus Java application
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       │   └── com/quote/k8/
│   │       │       ├── dto/           # Data Transfer Objects
│   │       │       ├── model/          # JPA/Panache entities
│   │       │       ├── repository/     # MongoDB repositories
│   │       │       ├── resource/       # JAX-RS endpoints
│   │       │       ├── service/        # Business logic
│   │       │       └── util/           # Utilities
│   │       └── resources/
│   │           ├── application.properties
│   │           └── application.yaml
│   ├── Containerfile.jvm        # JVM Docker image
│   ├── Containerfile.native     # Native GraalVM image
│   └── pom.xml
├── k8/                         # Kubernetes manifests
│   ├── base/
│   │   └── configmap.yaml
│   ├── local/
│   │   ├── deployment-jvm.yaml
│   │   └── service-jvm.yaml
│   ├── cloud/
│   │   ├── deployment-native.yaml
│   │   └── service-native.yaml
│   └── mongodb/
│       └── mongodb-cluster.yaml
└── doc/                        # Documentation
```

---

## Quarkus Project Initialization

### Create Quarkus Project

```bash
cd k8-quote-api
quarkus create app com.quote.k8:quote-api \
  --extension=resteasy-jackson,resteasy-jaxb,hibernate-validator,smallrye-jwt,smallrye-jwt-build,quarkus-mongodb-panache,quarkus-arc,quarkus-config-yaml \
  --no-code
```

Or use Maven directly:

```bash
mvn io.quarkus.platform:quarkus-maven-plugin:create \
  -DprojectGroupId=com.quote.k8 \
  -DprojectArtifactId=quote-api \
  -Dextensions="resteasy-jackson,resteasy-jaxb,hibernate-validator,smallrye-jwt,smallrye-jwt-build,quarkus-mongodb-panache,quarkus-arc,quarkus-config-yaml"
```

---

## Configuration

### application.yaml

```yaml
quarkus:
  application:
    name: quote-api
  http:
    port: 8080
  mongodb:
    connection-string: mongodb://quote-db:27017
    database: quote-db
  smallrye-jwt:
    sign-key-secret: ${JWT_SECRET:your-secret-key-min-256-bits}
  log:
    level: INFO

mp:
  jwt:
    verify:
      issuer: https://quote-backend.local
      publickey:
        location: publicKey.pem
```

### application.properties (for local development)

```properties
quarkus.mongodb.connection-string=mongodb://localhost:27017
quarkus.mongodb.database=quote-db
quarkus.smallrye-jwt.sign-key-secret=your-secret-key-min-256-bits
```

---

## MongoDB Setup

### MongoDB Cluster YAML (k8/mongodb/mongodb-cluster.yaml)

```yaml
apiVersion: mongodbcommunity.mongodb.com/v1
kind: MongoDBCommunity
metadata:
  name: quote-db
  namespace: quote-k8-java
spec:
  members: 1
  version: "6.0.0"
  type: ReplicaSet
  security:
    authentication:
      modes: ["SCRAM"]
  users:
    - name: quote-user
      type: admin
      passwordSecretRef:
        name: quote-db-password
      roles:
        - name: readWrite
          db: quote-db
      scramCredentialsSecretName: quote-db-scram
---
apiVersion: v1
kind: Secret
metadata:
  name: quote-db-password
  namespace: quote-k8-java
type: Opaque
stringData:
  password: "quote-password-123"
---
apiVersion: v1
kind: Secret
metadata:
  name: quote-db-scram
  namespace: quote-k8-java
type: Opaque
stringData:
  password: "quote-password-123"
```

Apply the MongoDB cluster:

```bash
kubectl apply -f k8/mongodb/mongodb-cluster.yaml -n quote-k8-java
```

Wait for MongoDB to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=quote-db -n quote-k8-java --timeout=300s
```

---

## Containerfile (JVM)

### Containerfile.jvm

```dockerfile
FROM registry.access.redhat.com/ubi8/openjdk-17:1.14 as builder
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM registry.access.redhat.com/ubi8/openjdk-17:1.14
WORKDIR /deploy
COPY --from=builder /build/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## Containerfile (Native)

### Containerfile.native

```dockerfile
FROM quay.io/quarkus/quarkus-mandrel:23.0-java17 as builder
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn clean package -Pnative -DskipTests

FROM registry.access.redhat.com/ubi8/ubi-minimal:8.8
WORKDIR /deploy
COPY --from=builder /build/target/*-runner .
EXPOSE 8080
CMD ["./quote-api-1.0.0-SNAPSHOT-runner"]
```

---

## Kubernetes Manifests

### Local Deployment (JVM) - k8/local/deployment-jvm.yaml

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
      version: jvm
  template:
    metadata:
      labels:
        app: quote-api
        version: jvm
    spec:
      containers:
        - name: quote-api
          image: quote-api:latest-jvm
          imagePullPolicy: Never
          ports:
            - containerPort: 8080
          env:
            - name: QUARKUS_MONGODB_CONNECTION_STRING
              value: mongodb://quote-db-0.quote-db-svc.quote-k8-java.svc.cluster.local:27017
            - name: QUARKUS_MONGODB_DATABASE
              value: quote-db
            - name: QUARKUS_SMALLRYE_JWT_SIGN_KEY_SECRET
              valueFrom:
                secretKeyRef:
                  name: jwt-secret
                  key: secret
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: quote-api-jvm
  namespace: quote-k8-java
spec:
  selector:
    app: quote-api
    version: jvm
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

### Cloud Deployment (Native) - k8/cloud/deployment-native.yaml

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
      version: native
  template:
    metadata:
      labels:
        app: quote-api
        version: native
    spec:
      containers:
        - name: quote-api
          image: <your-registry>/quote-api:latest-native
          ports:
            - containerPort: 8080
          env:
            - name: QUARKUS_MONGODB_CONNECTION_STRING
              valueFrom:
                configMapKeyRef:
                  name: mongo-config
                  key: connection-string
            - name: QUARKUS_MONGODB_DATABASE
              value: quote-db
            - name: QUARKUS_SMALLRYE_JWT_SIGN_KEY_SECRET
              valueFrom:
                secretKeyRef:
                  name: jwt-secret
                  key: secret
          resources:
            requests:
              memory: "64Mi"
              cpu: "100m"
            limits:
              memory: "128Mi"
              cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: quote-api-native
  namespace: quote-k8-java
spec:
  selector:
    app: quote-api
    version: native
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

---

## Initial Endpoint: GET /api/quotes/random

This endpoint fetches data from ZenQuotes when the database is empty and stores it in the database, or returns a random quote from the database.

### Implementation Steps

#### 1. Create Quote Model

```java
package com.quote.k8.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

public class Quote extends PanacheMongoEntity {
    public Integer quoteId;
    public String quoteText;
    public String author;
    public Integer likeCount;
    public LocalDateTime createdAt;
    public String source;
}
```

#### 2. Create QuoteRepository

```java
package com.quote.k8.repository;

import com.quote.k8.model.Quote;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class QuoteRepository implements PanacheMongoRepository<Quote> {

    public List<Quote> findAllQuotes() {
        return findAll().list();
    }

    public Optional<Quote> findByQuoteId(Integer quoteId) {
        return find("quoteId", quoteId).firstResultOptional();
    }

    public Quote findRandomQuote() {
        List<Quote> allQuotes = findAll().list();
        if (allQuotes.isEmpty()) {
            return null;
        }
        int randomIndex = (int) (Math.random() * allQuotes.size());
        return allQuotes.get(randomIndex);
    }
}
```

#### 3. Create ZenQuotesService

```java
package com.quote.k8.service;

import com.quote.k8.model.Quote;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.List;

@ApplicationScoped
public class ZenQuotesService {

    private static final Logger LOG = Logger.getLogger(ZenQuotesService.class);

    @RestClient
    ZenQuotesClient zenQuotesClient;

    public List<Quote> getMultipleQuotes() {
        LOG.info("Fetching quotes from ZenQuotes API");
        return zenQuotesClient.getQuotes();
    }
}
```

#### 4. Create ZenQuotesClient

```java
package com.quote.k8.service;

import com.quote.k8.model.Quote;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.annotation.RegisterClientHeaders;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import java.util.List;

@Path("/api/quotes")
@RegisterRestClient
@RegisterClientHeaders
public interface ZenQuotesClient {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    List<Quote> getQuotes();
}
```

#### 5. Create QuoteService

```java
package com.quote.k8.service;

import com.quote.k8.model.Quote;
import com.quote.k8.repository.QuoteRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.List;

@ApplicationScoped
public class QuoteService {

    private static final Logger LOG = Logger.getLogger(QuoteService.class);

    @Inject
    QuoteRepository quoteRepository;

    @Inject
    ZenQuotesService zenQuotesService;

    public Quote getRandomQuote() {
        LOG.info("Getting random quote");

        // Check if database is empty
        List<Quote> allQuotes = quoteRepository.findAllQuotes();
        if (allQuotes.isEmpty()) {
            LOG.info("Database is empty, fetching quotes from ZenQuotes");
            List<Quote> newQuotes = zenQuotesService.getMultipleQuotes();
            
            int maxId = 0;
            for (Quote quote : newQuotes) {
                quote.quoteId = ++maxId;
                quote.likeCount = 0;
                quote.createdAt = LocalDateTime.now();
                quote.source = "ZenQuotes";
                quoteRepository.persist(quote);
            }
            
            LOG.info("Added " + newQuotes.size() + " quotes to database");
            return newQuotes.get(0);
        }

        // Return random quote from database
        Quote randomQuote = quoteRepository.findRandomQuote();
        LOG.info("Returning random quote with ID: " + randomQuote.quoteId);
        return randomQuote;
    }
}
```

#### 6. Create QuoteResource

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
            Quote quote = quoteService.getRandomQuote();
            if (quote == null) {
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("No quotes available")
                        .build();
            }
            return Response.ok(quote).build();
        } catch (Exception e) {
            LOG.error("Error getting random quote", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Error getting random quote: " + e.getMessage())
                    .build();
        }
    }
}
```

---

## Local Deployment (Kind Cluster)

### 1. Build JVM Image

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
```

### 2. Load Image to Kind

```bash
kind load docker-image quote-api:latest-jvm --name multi-node-cluster
```

### 3. Deploy to Kind

```bash
kubectl apply -f k8/local/deployment-jvm.yaml -n quote-k8-java
kubectl apply -f k8/local/service-jvm.yaml -n quote-k8-java
```

### 4. Get Service URL

```bash
kubectl get svc quote-api-jvm -n quote-k8-java
```

For Kind, the LoadBalancer will give you a NodePort. Access via:

```bash
kubectl port-forward svc/quote-api-jvm 8080:80 -n quote-k8-java
```

Then test:

```bash
curl http://localhost:8080/api/quotes/random
```

---

## Cloud Deployment (Native)

### 1. Build Native Image

```bash
cd k8-quote-api
mvn clean package -Pnative -DskipTests
docker build -f Containerfile.native -t <your-registry>/quote-api:latest-native .
docker push <your-registry>/quote-api:latest-native
```

### 2. Update deployment-native.yaml with your registry

### 3. Deploy to Cloud

```bash
kubectl apply -f k8/cloud/deployment-native.yaml -n quote-k8-java
kubectl apply -f k8/cloud/service-native.yaml -n quote-k8-java
```

---

## Testing

### Test Random Quote Endpoint

```bash
# First call (database empty - should fetch from ZenQuotes)
curl http://localhost:8080/api/quotes/random

# Subsequent calls (should return random from database)
curl http://localhost:8080/api/quotes/random
```

### Verify in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.quotes.find().pretty()"
```

---

## Notes

- The MongoDB Operator manages the MongoDB cluster lifecycle
- JVM deployment is for local development/testing on Kind
- Native deployment is for production cloud environments (faster startup, lower memory)
- The random quote endpoint automatically seeds the database if empty
- All secrets should be properly managed in production (use Kubernetes Secrets or external secret management)
- The JWT secret should be rotated regularly in production
