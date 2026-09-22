# Implementing POST /api/auth/register Endpoint

## Overview

This document describes how to implement the `POST /api/auth/register` endpoint by migrating the C# code from `quote-azure-k8-backend` to Java Quarkus.

## C# Implementation

### Model: RegisterRequest.cs

```csharp
public class RegisterRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email address")]
    public string Email { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Username is required")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
    public string Username { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password is required")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters long")]
    public string Password { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password confirmation is required")]
    [Compare("Password", ErrorMessage = "Passwords do not match")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
```

### Controller: AuthController.cs

```csharp
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;

    [HttpPost("register")]
    public async Task<ActionResult<User>> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var user = await _userService.RegisterAsync(request);
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "An error occurred while registering the user");
        }
    }
}
```

### Service: UserService.cs

```csharp
public async Task<User> RegisterAsync(RegisterRequest request)
{
    // Check if user already exists
    if (await _userRepository.EmailExistsAsync(request.Email))
        throw new ArgumentException("Email already exists");

    if (await _userRepository.UsernameExistsAsync(request.Username))
        throw new ArgumentException("Username already exists");

    // Create new user
    var user = new User
    {
        Id = Guid.NewGuid().ToString(),
        Email = request.Email,
        Username = request.Username,
        PasswordHash = _passwordHasher.HashPassword(null!, request.Password),
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
        IsActive = true
    };

    var createdUser = await _userRepository.CreateAsync(user);

    // Assign USER role by default
    var userRole = new UserRole
    {
        Username = createdUser.Username,
        Role = "USER",
        CreatedAt = DateTime.UtcNow,
        CreatedBy = "System"
    };

    await _userRoleRepository.CreateUserRoleAsync(userRole);

    return createdUser;
}
```

## Java Migration Strategy

### 1. Create RegisterRequest DTO

Create `RegisterRequest.java` in `src/main/java/com/quote/k8s/dto/`:

```java
package com.quote.k8.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {
    
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email address")
    public String email;
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    public String username;
    
    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters long")
    public String password;
    
    @NotBlank(message = "Password confirmation is required")
    public String confirmPassword;
    
    // Custom validation for password matching
    public boolean isPasswordMatch() {
        return password != null && password.equals(confirmPassword);
    }
}
```

### 2. Update UserRepository

Add email and username existence checks to `UserRepository.java`:

```java
@ApplicationScoped
public class UserRepository implements PanacheMongoRepository<User> {
    
    public Optional<User> findByUsername(String username) {
        return find("username", username).firstResultOptional();
    }
    
    public Optional<User> findByEmail(String email) {
        return find("email", email).firstResultOptional();
    }
    
    public boolean existsByUsername(String username) {
        return findByUsername(username).isPresent();
    }
    
    public boolean existsByEmail(String email) {
        return findByEmail(email).isPresent();
    }
}
```

### 3. Create AuthService

Create `AuthService.java` in `src/main/java/com/quote/k8s/service/`:

```java
package com.quote.k8.service;

import com.quote.k8.dto.RegisterRequest;
import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserRepository;
import com.quote.k8.repository.UserRoleRepository;
import com.quote.k8.util.PasswordUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AuthService {

    private static final Logger LOG = Logger.getLogger(AuthService.class);

    @Inject
    UserRepository userRepository;

    @Inject
    UserRoleRepository userRoleRepository;

    public User register(RegisterRequest request) {
        // Validate password match
        if (!request.isPasswordMatch()) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        // Check if email already exists
        if (userRepository.existsByEmail(request.email)) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Check if username already exists
        if (userRepository.existsByUsername(request.username)) {
            throw new IllegalArgumentException("Username already exists");
        }

        // Create new user
        User user = new User(
            request.username,
            request.email,
            PasswordUtil.hashPassword(request.password)
        );
        userRepository.persist(user);
        LOG.info("User registered successfully: " + user.username);

        // Assign USER role by default
        UserRole userRole = new UserRole(user.username, "USER", "System");
        userRoleRepository.persist(userRole);
        LOG.info("USER role assigned to: " + user.username);

        return user;
    }
}
```

### 4. Create AuthResource REST Endpoint

Create `AuthResource.java` in `src/main/java/com/quote/k8s/resource/`:

```java
package com.quote.k8.resource;

import com.quote.k8.dto.RegisterRequest;
import com.quote.k8.model.User;
import com.quote.k8.service.AuthService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final Logger LOG = Logger.getLogger(AuthResource.class);

    @Inject
    AuthService authService;

    @POST
    @Path("/register")
    public Response register(@Valid RegisterRequest request) {
        try {
            LOG.info("POST /api/auth/register - Registering user: " + request.username);
            
            User user = authService.register(request);
            
            return Response.status(Response.Status.CREATED)
                    .entity(user)
                    .build();
        } catch (IllegalArgumentException e) {
            LOG.warn("Registration failed: " + e.getMessage());
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(e.getMessage())
                    .build();
        } catch (Exception e) {
            LOG.error("Error registering user", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("An error occurred while registering the user")
                    .build();
        }
    }
}
```

### 5. Add Validation Dependency

Ensure `pom.xml` includes Hibernate Validator for Bean Validation:

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-hibernate-validator</artifactId>
</dependency>
```

## Implementation Steps

1. **Create DTO**
   - Create `RegisterRequest.java` with Bean Validation annotations
   - Add custom validation for password matching

2. **Update Repository**
   - Add `findByEmail()` method to UserRepository
   - Add `existsByEmail()` method to UserRepository

3. **Create Service**
   - Create `AuthService.java` with register method
   - Implement validation logic
   - Use existing PasswordUtil for hashing
   - Assign USER role by default

4. **Create REST Endpoint**
   - Create `AuthResource.java` with POST /api/auth/register
   - Use `@Valid` annotation for validation
   - Return 201 Created on success
   - Return 400 for validation errors
   - Return 500 for server errors

5. **Build and Deploy**
   ```bash
   cd quote-api
   mvn clean package -DskipTests
   docker build -f Containerfile.jvm -t quote-api:latest-jvm .
   kind load docker-image quote-api:latest-jvm --name single-node
   kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
   ```

6. **Test the Endpoint**
   ```bash
   curl -X POST http://localhost:8080/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user-b@outlook.com",
       "username": "user-b",
       "password": "Hello-user-b",
       "confirmPassword": "Hello-user-b"
     }'
   ```

## Key Differences from C# Implementation

1. **Validation**: C# uses Data Annotations, Java uses Bean Validation (`@Valid`, `@NotBlank`, etc.)
2. **Password Matching**: C# uses `[Compare]` attribute, Java uses custom method
3. **Async/Await**: C# uses async/await, Java uses synchronous methods (Quarkus handles async internally)
4. **ID Generation**: C# uses GUID, Java uses MongoDB ObjectId
5. **Return Type**: C# returns `ActionResult<User>`, Java returns `Response`

## Security Considerations

- Password is hashed before storage using SHA-256 with salt
- Email and username uniqueness is enforced
- Default role is USER (not ADMIN)
- Input validation prevents empty or invalid data
- Password confirmation prevents typos
- Consider adding email verification in production
- Consider adding rate limiting to prevent abuse
