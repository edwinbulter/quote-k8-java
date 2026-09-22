# Implementing POST /api/auth/login Endpoint

## Overview

This document describes how to implement the `POST /api/auth/login` endpoint by migrating the C# code from `quote-azure-k8-backend` to Java Quarkus.

## C# Implementation

### Model: LoginRequest.cs

```csharp
public class LoginRequest
{
    [Required(ErrorMessage = "Email or username is required")]
    public string LoginIdentifier { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "Password is required")]
    public string Password { get; set; } = string.Empty;
}
```

### Controller: AuthController.cs

```csharp
[HttpPost("login")]
public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
{
    try
    {
        var token = await _userService.LoginAsync(request);
        return Ok(new LoginResponse { Token = token });
    }
    catch (UnauthorizedAccessException)
    {
        return Unauthorized("Invalid credentials");
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred during login");
    }
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
}
```

### Service: UserService.cs

```csharp
public async Task<string> LoginAsync(LoginRequest request)
{
    User? user = null;

    // Try to find user by email first, then by username
    if (request.LoginIdentifier.Contains("@"))
    {
        user = await _userRepository.GetByEmailAsync(request.LoginIdentifier);
    }
    else
    {
        user = await _userRepository.GetByUsernameAsync(request.LoginIdentifier);
    }

    if (user == null)
        throw new UnauthorizedAccessException("User not found");

    // Verify password
    var verificationResult = _passwordHasher.VerifyHashedPassword(null!, user.PasswordHash, request.Password);
    if (verificationResult != PasswordVerificationResult.Success)
        throw new UnauthorizedAccessException("Invalid password");

    if (!user.IsActive)
        throw new UnauthorizedAccessException("User account is inactive");

    // Generate JWT token
    var token = _jwtService.GenerateToken(user);

    return token;
}
```

### Service: JwtService.cs

```csharp
public string GenerateToken(User user)
{
    var tokenHandler = new JwtSecurityTokenHandler();
    var key = Encoding.ASCII.GetBytes(_key);
    
    // Get user roles from the database
    var userRole = _userRoleRepository.GetUserRoleAsync(user.Username).GetAwaiter().GetResult();
    var roleClaims = new List<Claim>();
    
    if (userRole != null)
    {
        roleClaims.Add(new Claim(ClaimTypes.Role, userRole.Role));
    }
    
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim("jti", Guid.NewGuid().ToString()),
        new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
    };
    
    claims.AddRange(roleClaims);

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(claims),
        Expires = DateTime.UtcNow.AddMinutes(double.Parse(_config["JwtSettings:ExpiryMinutes"] ?? "60")),
        Issuer = _issuer,
        Audience = _audience,
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };

    var token = tokenHandler.CreateToken(tokenDescriptor);
    return tokenHandler.WriteToken(token);
}
```

## Java Migration Strategy

### 1. Add JWT Dependencies

Add to `pom.xml`:

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-smallrye-jwt</artifactId>
</dependency>
```

### 2. Configure JWT Settings

Add to `application.properties`:

```properties
# JWT Configuration
mp.jwt.verify.issuer=quote-k8-java
mp.jwt.verify.audience=quote-k8-users
smallrye.jwt.sign.key.secret=your-secret-key-at-least-256-bits-long
smallrye.jwt.sign.key.algorithm=HS256
smallrye.jwt.time-to-live=3600
```

### 3. Create LoginRequest DTO

Create `LoginRequest.java` in `src/main/java/com/quote/k8/dto/`:

```java
package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    
    @NotBlank(message = "Email or username is required")
    public String loginIdentifier;
    
    @NotBlank(message = "Password is required")
    public String password;
}
```

### 4. Create LoginResponse DTO

Create `LoginResponse.java` in `src/main/java/com/quote/k8/dto/`:

```java
package com.quote.k8.dto;

public class LoginResponse {
    
    public String token;
    
    public LoginResponse(String token) {
        this.token = token;
    }
}
```

### 5. Create JwtService

Create `JwtService.java` in `src/main/java/com/quote/k8/service/`:

```java
package com.quote.k8.service;

import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserRoleRepository;
import io.smallrye.jwt.build.Jwt;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class JwtService {

    private static final Logger LOG = Logger.getLogger(JwtService.class);

    @Inject
    UserRoleRepository userRoleRepository;

    @ConfigProperty(name = "mp.jwt.verify.issuer")
    String issuer;

    @ConfigProperty(name = "mp.jwt.verify.audience")
    String audience;

    @ConfigProperty(name = "smallrye.jwt.sign.key.secret")
    String secretKey;

    public String generateToken(User user) {
        // Get user roles
        Optional<UserRole> userRole = userRoleRepository.findByUsername(user.username);
        
        Jwt.Builder jwtBuilder = Jwt.claims()
                .subject(user.id.toString())
                .upn(user.email)
                .claim("username", user.username)
                .claim("email", user.email)
                .issuer(issuer)
                .audience(audience);
        
        // Add role if present
        userRole.ifPresent(role -> jwtBuilder.groups(role.role));
        
        return jwtBuilder.sign();
    }
}
```

### 6. Update PasswordUtil with Verification

Update `PasswordUtil.java` to add password verification:

```java
public static boolean verifyPassword(String password, String storedHash) {
    try {
        byte[] combined = Base64.getDecoder().decode(storedHash);
        byte[] salt = new byte[SALT_LENGTH];
        byte[] hash = new byte[combined.length - SALT_LENGTH];
        
        System.arraycopy(combined, 0, salt, 0, SALT_LENGTH);
        System.arraycopy(combined, SALT_LENGTH, hash, 0, hash.length);
        
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        md.update(salt);
        byte[] testHash = md.digest(password.getBytes());
        
        return MessageDigest.isEqual(hash, testHash);
    } catch (NoSuchAlgorithmException e) {
        throw new RuntimeException("Failed to verify password", e);
    }
}
```

### 7. Update AuthService

Add login method to `AuthService.java`:

```java
public String login(LoginRequest request) {
    User user = null;

    // Try to find user by email first, then by username
    if (request.loginIdentifier.contains("@")) {
        user = userRepository.findByEmail(request.loginIdentifier)
                .orElseThrow(() -> new UnauthorizedAccessException("User not found"));
    } else {
        user = userRepository.findByUsername(request.loginIdentifier)
                .orElseThrow(() -> new UnauthorizedAccessException("User not found"));
    }

    // Verify password
    if (!PasswordUtil.verifyPassword(request.password, user.passwordHash)) {
        throw new UnauthorizedAccessException("Invalid password");
    }

    if (!user.isActive) {
        throw new UnauthorizedAccessException("User account is inactive");
    }

    // Generate JWT token
    String token = jwtService.generateToken(user);
    LOG.info("User logged in successfully: " + user.username);

    return token;
}
```

### 8. Update AuthResource

Add login endpoint to `AuthResource.java`:

```java
@POST
@Path("/login")
public Response login(@Valid LoginRequest request) {
    try {
        LOG.info("POST /api/auth/login - Login attempt for: " + request.loginIdentifier);
        
        String token = authService.login(request);
        
        return Response.ok(new LoginResponse(token)).build();
    } catch (UnauthorizedAccessException e) {
        LOG.warn("Login failed: " + e.getMessage());
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity("Invalid credentials")
                .build();
    } catch (Exception e) {
        LOG.error("Error during login", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred during login")
                .build();
    }
}
```

## Implementation Steps

1. **Add Dependencies**
   - Add `quarkus-smallrye-jwt` to pom.xml

2. **Configure JWT**
   - Add JWT configuration to application.properties

3. **Create DTOs**
   - Create `LoginRequest.java` with validation
   - Create `LoginResponse.java`

4. **Create JWT Service**
   - Create `JwtService.java` for token generation
   - Implement role-based claims

5. **Update Password Utility**
   - Add `verifyPassword()` method to PasswordUtil

6. **Update Auth Service**
   - Add `login()` method to AuthService
   - Implement email/username lookup
   - Add password verification
   - Add inactive account check

7. **Update Auth Resource**
   - Add POST /api/auth/login endpoint
   - Return JWT token on success
   - Return 401 for invalid credentials
   - Return 500 for server errors

8. **Build and Deploy**
   ```bash
   cd k8-quote-api
   mvn clean package -DskipTests
   docker build -f Containerfile.jvm -t quote-api:latest-jvm .
   kind load docker-image quote-api:latest-jvm --name single-node
   kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
   ```

9. **Test the Endpoint**
   ```bash
   curl -X POST http://localhost:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "loginIdentifier": "user-b",
       "password": "Hello-user-b"
     }'
   ```

## Key Differences from C# Implementation

1. **JWT Library**: C# uses `System.IdentityModel.Tokens.Jwt`, Java uses SmallRye JWT
2. **Password Verification**: C# uses ASP.NET Identity's `VerifyHashedPassword`, Java uses custom SHA-256 verification
3. **Token Generation**: C# uses manual claim building, Java uses SmallRye JWT builder
4. **Role Claims**: C# uses `ClaimTypes.Role`, Java uses SmallRye groups
5. **Configuration**: C# uses appsettings.json, Java uses application.properties
6. **Async/Await**: C# uses async/await, Java uses synchronous methods

## Security Considerations

- Password is verified using SHA-256 with salt (same as registration)
- JWT token expires after configured time (default 1 hour)
- User must be active to login
- Email or username can be used for login
- Role is included in JWT token for authorization
- Secret key should be at least 256 bits
- Consider adding rate limiting to prevent brute force
- Consider adding account lockout after failed attempts
- HTTPS should be used in production
