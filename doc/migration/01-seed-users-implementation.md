# Implementing POST /api/seed-users Endpoint

## Overview

This document describes how to implement the `POST /api/seed-users` endpoint by migrating the C# code from `quote-azure-k8-backend` to Java Quarkus.

## C# Implementation

### Controller: SeedController.cs

```csharp
[ApiController]
[Route("api")]
public class SeedController : ControllerBase
{
    private readonly AdminUserSeeder _seeder;

    public SeedController(AdminUserSeeder seeder)
    {
        _seeder = seeder;
    }

    [HttpPost("seed-users")]
    public async Task<ActionResult> SeedUsers()
    {
        try
        {
            await _seeder.SeedAdminUsersAsync();
            return Ok("Users seeded successfully");
        }
        catch (Exception ex)
        {
            return StatusCode(500, "An error occurred while seeding users");
        }
    }
}
```

### Service: AdminUserSeeder.cs

The seeder creates two users:

1. **Admin User**
   - Username: `admin`
   - Email: `admin@quote-backend.local`
   - Password: `Admin123!`
   - Role: `ADMIN`
   - Fixed ID: `98d9a7e2-2657-4c37-b784-2eee61ddb3b8`

2. **Test User**
   - Username: `user-1`
   - Email: `user-1@outlook.com`
   - Password: `Hello-user-1`
   - Role: `USER`
   - Random GUID ID

## Java Migration Strategy

### 1. Create User Model

Create `User.java` in `src/main/java/com/quote/k8/model/`:

```java
package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "users")
public class User {
    
    @BsonId
    public ObjectId id;
    
    public String username;
    public String email;
    public String passwordHash;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public boolean isActive;
    
    // Constructors
    public User() {}
    
    public User(String username, String email, String passwordHash) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        this.isActive = true;
    }
}
```

### 2. Create UserRole Model

Create `UserRole.java` in `src/main/java/com/quote/k8/model/`:

```java
package com.quote.k8.model;

import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.codecs.pojo.annotations.BsonId;
import org.bson.types.ObjectId;

import java.time.LocalDateTime;

@MongoEntity(collection = "user_roles")
public class UserRole {
    
    @BsonId
    public ObjectId id;
    
    public String username;
    public String role;
    public LocalDateTime createdAt;
    public String createdBy;
    
    // Constructors
    public UserRole() {}
    
    public UserRole(String username, String role, String createdBy) {
        this.username = username;
        this.role = role;
        this.createdAt = LocalDateTime.now();
        this.createdBy = createdBy;
    }
}
```

### 3. Create UserRepository

Create `UserRepository.java` in `src/main/java/com/quote/k8/repository/`:

```java
package com.quote.k8.repository;

import com.quote.k8.model.User;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class UserRepository implements PanacheMongoRepository<User> {
    
    public Optional<User> findByUsername(String username) {
        return find("username", username).firstResultOptional();
    }
    
    public boolean existsByUsername(String username) {
        return findByUsername(username).isPresent();
    }
}
```

### 4. Create UserRoleRepository

Create `UserRoleRepository.java` in `src/main/java/com/quote/k8/repository/`:

```java
package com.quote.k8.repository;

import com.quote.k8.model.UserRole;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class UserRoleRepository implements PanacheMongoRepository<UserRole> {
    
    public Optional<UserRole> findByUsername(String username) {
        return find("username", username).firstResultOptional();
    }
    
    public boolean userHasRole(String username, String role) {
        return find("username = ?1 and role = ?2", username, role).firstResultOptional().isPresent();
    }
}
```

### 5. Create Password Utility

Create `PasswordUtil.java` in `src/main/java/com/quote/k8/util/`:

```java
package com.quote.k8.util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

public class PasswordUtil {
    
    private static final int SALT_LENGTH = 16;
    private static final int ITERATIONS = 10000;
    private static final int KEY_LENGTH = 256;
    
    public static String hashPassword(String password) {
        try {
            SecureRandom random = new SecureRandom();
            byte[] salt = new byte[SALT_LENGTH];
            random.nextBytes(salt);
            
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(salt);
            byte[] hashedPassword = md.digest(password.getBytes());
            
            // Combine salt and password
            byte[] combined = new byte[salt.length + hashedPassword.length];
            System.arraycopy(salt, 0, combined, 0, salt.length);
            System.arraycopy(hashedPassword, 0, combined, salt.length, hashedPassword.length);
            
            return Base64.getEncoder().encodeToString(combined);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Failed to hash password", e);
        }
    }
}
```

### 6. Create UserSeeder Service

Create `UserSeeder.java` in `src/main/java/com/quote/k8/service/`:

```java
package com.quote.k8.service;

import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserRepository;
import com.quote.k8.repository.UserRoleRepository;
import com.quote.k8.util.PasswordUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class UserSeeder {

    private static final Logger LOG = Logger.getLogger(UserSeeder.class);

    @Inject
    UserRepository userRepository;

    @Inject
    UserRoleRepository userRoleRepository;

    public void seedUsers() {
        try {
            LOG.info("Starting user seeding process");

            // Check if admin user already exists
            var existingAdmin = userRepository.findByUsername("admin");
            if (existingAdmin.isPresent()) {
                LOG.info("Admin user already exists, skipping creation");
                return;
            }

            // Create admin user
            User adminUser = new User(
                "admin",
                "admin@quote-backend.local",
                PasswordUtil.hashPassword("Admin123!")
            );
            userRepository.persist(adminUser);
            LOG.info("Admin user created: " + adminUser.username);

            // Assign admin role
            UserRole adminRole = new UserRole("admin", "ADMIN", "System");
            userRoleRepository.persist(adminRole);
            LOG.info("Admin role assigned to user: " + adminUser.username);

            // Check if test user already exists
            var existingTestUser = userRepository.findByUsername("user-1");
            if (existingTestUser.isPresent()) {
                LOG.info("Test user already exists, skipping creation");
                return;
            }

            // Create test user
            User testUser = new User(
                "user-1",
                "user-1@outlook.com",
                PasswordUtil.hashPassword("Hello-user-1")
            );
            userRepository.persist(testUser);
            LOG.info("Test user created: " + testUser.username);

            // Assign user role
            UserRole userRole = new UserRole("user-1", "USER", "System");
            userRoleRepository.persist(userRole);
            LOG.info("User role assigned to user: " + testUser.username);

            LOG.info("User seeding completed successfully");
        } catch (Exception e) {
            LOG.error("Error during user seeding", e);
            throw new RuntimeException("Failed to seed users", e);
        }
    }
}
```

### 7. Create SeedResource REST Endpoint

Create `SeedResource.java` in `src/main/java/com/quote/k8/resource/`:

```java
package com.quote.k8.resource;

import com.quote.k8.service.UserSeeder;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SeedResource {

    private static final Logger LOG = Logger.getLogger(SeedResource.class);

    @Inject
    UserSeeder userSeeder;

    @POST
    @Path("/seed-users")
    public Response seedUsers() {
        try {
            LOG.info("POST /api/seed-users - Seeding users");
            userSeeder.seedUsers();
            return Response.ok("Users seeded successfully").build();
        } catch (Exception e) {
            LOG.error("Error seeding users", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("An error occurred while seeding users: " + e.getMessage())
                    .build();
        }
    }
}
```

## Implementation Steps

1. **Create Models**
   - Create `User.java` model class
   - Create `UserRole.java` model class

2. **Create Repositories**
   - Create `UserRepository.java` extending PanacheMongoRepository
   - Create `UserRoleRepository.java` extending PanacheMongoRepository

3. **Create Utility**
   - Create `PasswordUtil.java` for password hashing

4. **Create Service**
   - Create `UserSeeder.java` service class

5. **Create REST Endpoint**
   - Create `SeedResource.java` REST endpoint

6. **Build and Deploy**
   ```bash
   cd k8-quote-api
   mvn clean package -DskipTests
   docker build -f Containerfile.jvm -t quote-api:latest-jvm .
   kind load docker-image quote-api:latest-jvm --name single-node
   kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
   ```

7. **Test the Endpoint**
   ```bash
   curl -X POST http://localhost:8080/api/seed-users
   ```

## Key Differences from C# Implementation

1. **Password Hashing**: C# uses ASP.NET Identity's `IPasswordHasher`, Java uses custom SHA-256 with salt
2. **ID Generation**: C# uses GUIDs, Java uses MongoDB ObjectId (except for the fixed admin ID if needed)
3. **Async/Await**: C# uses async/await, Java uses synchronous methods (Quarkus handles async internally)
4. **Retry Logic**: Simplified in Java - checks once and skips if exists
5. **Logging**: Both use similar logging patterns (ILogger vs JBoss Logger)

## Security Considerations

- The seeder should only be used in development environments
- Consider adding environment check to prevent seeding in production
- The hardcoded passwords should be changed in production
- Consider using Quarkus Dev Services for local development instead of seeding
