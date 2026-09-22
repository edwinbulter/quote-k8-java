# Implementation: POST /api/auth/change-password

Migrate the C# `POST /api/auth/change-password` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token (authenticated user)
- Extracts the user ID from the JWT to identify the requesting user
- Accepts a JSON body with `currentPassword`, `newPassword`, and `confirmNewPassword`
- Validates that the new password and confirmation match
- Verifies that the current password is correct
- Updates the user's password hash in the database
- Updates the user's `updatedAt` timestamp
- Returns a success message on successful password change
- Only accessible to authenticated users

---

## C# Implementation Reference

### Model: ChangePasswordRequest.cs

```csharp
using System.ComponentModel.DataAnnotations;

namespace quote_azure_k8_backend.Models.Auth
{
    public class ChangePasswordRequest
    {
        [Required(ErrorMessage = "Current password is required")]
        public string CurrentPassword { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "New password is required")]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters long")]
        public string NewPassword { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "Password confirmation is required")]
        [Compare("NewPassword", ErrorMessage = "Passwords do not match")]
        public string ConfirmNewPassword { get; set; } = string.Empty;
    }
}
```

### Controller: AuthController.cs

```csharp
[HttpPost("change-password")]
public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
{
    var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(userId))
        return Unauthorized();

    try
    {
        var result = await _userService.ChangePasswordAsync(userId, request);
        if (result)
            return Ok("Password changed successfully");
        else
            return BadRequest("Failed to change password");
    }
    catch (UnauthorizedAccessException)
    {
        return Unauthorized("Current password is incorrect");
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while changing password");
    }
}
```

### Service: UserService.cs

```csharp
public async Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request)
{
    try
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return false;

        // Verify current password
        var verificationResult = _passwordHasher.VerifyHashedPassword(null!, user.PasswordHash, request.CurrentPassword);
        if (verificationResult != PasswordVerificationResult.Success)
            throw new UnauthorizedAccessException("Current password is incorrect");

        // Update password
        user.PasswordHash = _passwordHasher.HashPassword(null!, request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user);

        _logger.LogInformation("Password changed successfully for user: {UserId}", userId);
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error changing password");
        throw;
    }
}
```

---

## Java Migration

### 1. Create ChangePasswordRequest DTO

Create `ChangePasswordRequest.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChangePasswordRequest {
    
    @NotBlank(message = "Current password is required")
    public String currentPassword;
    
    @NotBlank(message = "New password is required")
    @Size(min = 8, message = "Password must be at least 8 characters long")
    public String newPassword;
    
    @NotBlank(message = "Password confirmation is required")
    public String confirmNewPassword;
    
    // Constructors
    public ChangePasswordRequest() {}
    
    public ChangePasswordRequest(String currentPassword, String newPassword, String confirmNewPassword) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
        this.confirmNewPassword = confirmNewPassword;
    }
    
    // Custom validation for password matching
    public boolean isPasswordMatch() {
        return newPassword != null && newPassword.equals(confirmNewPassword);
    }
}
```

---

### 2. Update AuthService

Add the `changePassword` method to `AuthService.java`:

```java
public boolean changePassword(String username, ChangePasswordRequest request) {
    LOG.info("Changing password for user: " + username);

    // Validate password match
    if (!request.isPasswordMatch()) {
        throw new IllegalArgumentException("Passwords do not match");
    }

    // Find user
    User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

    // Verify current password
    if (!PasswordUtil.verifyPassword(request.currentPassword, user.passwordHash)) {
        throw new SecurityException("Current password is incorrect");
    }

    // Update password
    user.passwordHash = PasswordUtil.hashPassword(request.newPassword);
    user.updatedAt = java.time.Instant.now();
    userRepository.update(user);

    LOG.info("Password changed successfully for user: " + username);
    return true;
}
```

Add the necessary import at the top of `AuthService.java`:

```java
import com.quote.k8.dto.ChangePasswordRequest;
```

---

### 3. Update AuthResource

Add the `POST /api/auth/change-password` endpoint to `AuthResource.java`:

```java
@POST
@Path("/change-password")
public Response changePassword(@Valid ChangePasswordRequest request) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("POST /api/auth/change-password - Changing password for user: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        boolean result = authService.changePassword(username, request);
        if (result) {
            return Response.ok("Password changed successfully").build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to change password")
                    .build();
        }
    } catch (SecurityException e) {
        LOG.warn("Password change failed: " + e.getMessage());
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(e.getMessage())
                .build();
    } catch (IllegalArgumentException e) {
        LOG.warn("Invalid request: " + e.getMessage());
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(e.getMessage())
                .build();
    } catch (Exception e) {
        LOG.error("Error changing password", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while changing password")
                .build();
    }
}
```

Add the necessary imports at the top of `AuthResource.java`:

```java
import com.quote.k8.dto.ChangePasswordRequest;
import io.smallrye.jwt.auth.principal.JwtCallerPrincipal;
import jakarta.inject.Inject;
```

Also add the JWT injection at the class level in `AuthResource.java`:

```java
@Inject
JwtCallerPrincipal jwt;
```

---

### 4. Update UserRepository

Ensure `UserRepository.java` has an `update` method:

```java
@ApplicationScoped
public class UserRepository implements PanacheMongoRepository<User> {
    
    public void update(User user) {
        update("_id", user.id)
            .set("username", user.username)
            .set("email", user.email)
            .set("passwordHash", user.passwordHash)
            .set("isActive", user.isActive)
            .set("updatedAt", user.updatedAt)
            .where("_id", user.id);
    }
}
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

### Login to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Change password successfully

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Hello-user-a",
    "newPassword": "NewUser123!",
    "confirmNewPassword": "NewUser123!"
  }' \
  http://localhost:8080/api/auth/change-password
```

Expected success response (HTTP 200):

```json
"Password changed successfully"
```

### Test with incorrect current password

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "WrongPassword",
    "newPassword": "NewUser123!",
    "confirmNewPassword": "NewUser123!"
  }' \
  http://localhost:8080/api/auth/change-password
```

Expected response: `401 Unauthorized` with body `"Current password is incorrect"`

### Test with mismatched password confirmation

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Hello-user-a",
    "newPassword": "NewUser123!",
    "confirmNewPassword": "DifferentPassword!"
  }' \
  http://localhost:8080/api/auth/change-password
```

Expected response: `400 Bad Request` with body `"Passwords do not match"`

### Test with missing fields

```bash
# Missing current password
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "NewUser123!",
    "confirmNewPassword": "NewUser123!"
  }' \
  http://localhost:8080/api/auth/change-password

# Missing new password
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Hello-user-a",
    "confirmNewPassword": "NewUser123!"
  }' \
  http://localhost:8080/api/auth/change-password

# Missing password confirmation
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Hello-user-a",
    "newPassword": "NewUser123!"
  }' \
  http://localhost:8080/api/auth/change-password
```

Expected response: `400 Bad Request` with validation error message

### Test with password too short

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Hello-user-a",
    "newPassword": "Short",
    "confirmNewPassword": "Short"
  }' \
  http://localhost:8080/api/auth/change-password
```

Expected response: `400 Bad Request` with body `"Password must be at least 8 characters long"`

### Test without authentication

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Hello-user-a",
    "newPassword": "NewUser123!",
    "confirmNewPassword": "NewUser123!"
  }' \
  http://localhost:8080/api/auth/change-password
```

Expected response: `401 Unauthorized` with body `"Invalid token: username claim missing"`

### Verify password change by logging in with new password

```bash
# Login with old password (should fail)
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}'

# Login with new password (should succeed)
NEW_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"NewUser123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Verify password hash changed in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.users.find({username: 'user-a'}).pretty()"
```

The `passwordHash` field should be different after the password change, and `updatedAt` should be updated.

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Incorrect current password | `401 Unauthorized` | `Current password is incorrect` |
| Passwords do not match | `400 Bad Request` | `Passwords do not match` |
| Missing current password | `400 Bad Request` | Validation error message |
| Missing new password | `400 Bad Request` | Validation error message |
| Missing password confirmation | `400 Bad Request` | Validation error message |
| Password too short | `400 Bad Request` | `Password must be at least 8 characters long` |
| Database error | `500 Internal Server Error` | `An error occurred while changing password` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/ChangePasswordRequest.java` | **Create** — new DTO class for change password request |
| `service/AuthService.java` | **Update** — add `changePassword()` method |
| `resource/AuthResource.java` | **Update** — add `POST /api/auth/change-password` endpoint and JWT injection |
| `repository/UserRepository.java` | **Update** — add `update()` method if not present |

---

## Notes

- The endpoint requires JWT authentication (no `@RolesAllowed` needed, any authenticated user can change their own password)
- The JWT token must include the `username` claim
- The implementation uses the existing `PasswordUtil` for password hashing and verification
- Passwords are hashed using SHA-256 with salt before storage
- The `updatedAt` timestamp is updated when the password is changed
- The endpoint validates that the new password and confirmation match
- The endpoint verifies the current password before allowing the change
- The password must be at least 8 characters long
- The endpoint only allows users to change their own password (extracted from JWT)
- Consider adding password complexity requirements (e.g., uppercase, lowercase, numbers, special characters)
- Consider adding rate limiting to prevent brute force attacks
- Consider adding password history to prevent reusing old passwords
- Consider adding email notification when password is changed
- The MongoDB collection for users is `users`
- The `User` model uses MongoDB Panache for database operations
- Validation is performed using Jakarta Bean Validation annotations (`@NotBlank`, `@Size`)
