# Implementation: DELETE /api/auth/unregister

Migrate the C# `DELETE /api/auth/unregister` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token (any authenticated user)
- Extracts the `username` from the JWT to identify the requesting user
- Accepts a JSON body with `password` (to confirm deletion)
- Validates the password before allowing deletion
- Deletes the user account and all associated data:
  - User record from `users` collection
  - All role assignments from `user_roles` collection
  - All liked quotes from `user_likes` collection
  - User progress from `user_progress` collection
- Returns a success message on successful deletion
- Accessible to any authenticated user (self-service account deletion)

---

## C# Implementation Reference

### Controller: AuthController.cs

```csharp
[HttpDelete("unregister")]
public async Task<ActionResult> Unregister([FromBody] UnregisterRequest request)
{
    var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(userId))
        return Unauthorized();

    try
    {
        var result = await _userService.UnregisterAsync(userId, request.Password);
        if (result)
            return Ok("Account deleted successfully");
        else
            return BadRequest("Failed to delete account");
    }
    catch (UnauthorizedAccessException)
    {
        return Unauthorized("Invalid password");
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while deleting account");
    }
}
```

### Model: UnregisterRequest.cs

```csharp
public class UnregisterRequest
{
    [Required(ErrorMessage = "Password is required")]
    public string Password { get; set; } = string.Empty;
}
```

### Service: UserService.cs

```csharp
public async Task<bool> UnregisterAsync(string userId, string password)
{
    try
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return false;

        // Verify password
        var verificationResult = _passwordHasher.VerifyHashedPassword(null!, user.PasswordHash, password);
        if (verificationResult != PasswordVerificationResult.Success)
            throw new UnauthorizedAccessException("Invalid password");

        // Delete all user data
        await _userRepository.DeleteAsync(userId);
        // Note: In a real implementation, you would also delete related data (likes, progress, etc.)

        _logger.LogInformation("User unregistered successfully: {UserId}", userId);
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error unregistering user");
        throw;
    }
}
```

---

## Java Migration

### 1. Create UnregisterRequest DTO

Create `UnregisterRequest.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class UnregisterRequest {
    
    @NotBlank(message = "Password is required")
    public String password;
    
    // Constructors
    public UnregisterRequest() {}
    
    public UnregisterRequest(String password) {
        this.password = password;
    }
}
```

---

### 2. Update UserRepository

Add a delete method to `UserRepository.java`:

```java
public boolean deleteByUsername(String username) {
    Optional<User> userOpt = findByUsername(username);
    if (userOpt.isEmpty()) {
        return false;
    }
    delete(userOpt.get());
    return true;
}
```

---

### 3. Update UserLikeRepository

Add a method to delete all likes for a user to `UserLikeRepository.java`:

```java
public boolean deleteAllByUsername(String username) {
    List<UserLike> likes = findByUsernameOrderByOrder(username);
    for (UserLike like : likes) {
        delete(like);
    }
    return true;
}
```

---

### 4. Update UserProgressRepository

Add a delete method to `UserProgressRepository.java`:

```java
public boolean deleteByUsername(String username) {
    Optional<UserProgress> progressOpt = findByUsername(username);
    if (progressOpt.isEmpty()) {
        return false;
    }
    delete(progressOpt.get());
    return true;
}
```

---

### 5. Update UserRoleRepository

Add a method to delete all roles for a user to `UserRoleRepository.java`:

```java
public boolean deleteAllByUsername(String username) {
    List<UserRole> roles = find("username", username).list();
    for (UserRole role : roles) {
        delete(role);
    }
    return true;
}
```

---

### 6. Update AuthService

Add the `unregister` method to `AuthService.java`:

```java
public boolean unregister(String username, UnregisterRequest request) {
    LOG.info("Unregistering user account: " + username);

    // Find user
    User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

    // Verify password
    if (!PasswordUtil.verifyPassword(request.password, user.passwordHash)) {
        throw new SecurityException("Invalid password");
    }

    // Delete all user data in the correct order
    // 1. Delete user likes
    userLikeRepository.deleteAllByUsername(user.username);
    LOG.info("Deleted all likes for user: " + user.username);

    // 2. Delete user progress
    userProgressRepository.deleteByUsername(user.username);
    LOG.info("Deleted user progress for: " + user.username);

    // 3. Delete user roles
    userRoleRepository.deleteAllByUsername(user.username);
    LOG.info("Deleted all roles for user: " + user.username);

    // 4. Delete user record
    userRepository.deleteByUsername(user.username);
    LOG.info("Deleted user account: " + user.username);

    return true;
}
```

---

### 7. Update AuthResource

Add the `DELETE /api/auth/unregister` endpoint to `AuthResource.java`:

```java
@DELETE
@Path("/unregister")
public Response unregister(UnregisterRequest request) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("DELETE /api/auth/unregister - Unregistering user: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        boolean result = authService.unregister(username, request);
        if (result) {
            return Response.ok("Account deleted successfully").build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to delete account")
                    .build();
        }
    } catch (SecurityException e) {
        LOG.warn("Unauthorized access attempt: " + e.getMessage());
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(e.getMessage())
                .build();
    } catch (IllegalArgumentException e) {
        LOG.warn("Invalid request: " + e.getMessage());
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(e.getMessage())
                .build();
    } catch (Exception e) {
        LOG.error("Error unregistering user", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while deleting account")
                .build();
    }
}
```

---

## 8. Build and Deploy

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name single-node
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 9. Test the Endpoint

### Login as a user to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### First, create a test user to delete

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user-unregister-test@outlook.com",
    "username": "user-unregister-test",
    "password": "Hello-user-unregister-test",
    "confirmPassword": "Hello-user-unregister-test"
  }' \
  http://localhost:8080/api/auth/register
```

### Login as the test user

```bash
TEST_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-unregister-test","password":"Hello-user-unregister-test"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Call the unregister endpoint with correct password

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"Hello-user-unregister-test"}' \
  http://localhost:8080/api/auth/unregister
```

### Expected success response (HTTP 200)

```json
"Account deleted successfully"
```

### Test with incorrect password (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"WrongPassword"}' \
  http://localhost:8080/api/auth/unregister
```

Expected response: `401 Unauthorized` with body `"Invalid password"`

### Test with missing password field

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:8080/api/auth/unregister
```

Expected response: `400 Bad Request` with validation error message

### Test without authentication (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Content-Type: application/json" \
  -d '{"password":"Hello-user-unregister-test"}' \
  http://localhost:8080/api/auth/unregister
```

Expected response: `401 Unauthorized`

### Verify user deletion in MongoDB

```bash
# Check users collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.users.find({username: 'user-unregister-test'}).pretty()"

# Check user_roles collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find({username: 'user-unregister-test'}).pretty()"

# Check user_likes collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_likes.find({username: 'user-unregister-test'}).pretty()"

# Check user_progress collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_progress.find({username: 'user-unregister-test'}).pretty()"
```

Expected output should be empty (no documents found) for all collections after successful deletion.

### Test with user who has likes and progress

```bash
# Create a user
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user-with-data-unregister@outlook.com",
    "username": "user-with-data-unregister",
    "password": "Hello-user-with-data-unregister",
    "confirmPassword": "Hello-user-with-data-unregister"
  }' \
  http://localhost:8080/api/auth/register

# Login as the user
USER_DATA_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-with-data-unregister","password":"Hello-user-with-data-unregister"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Like some quotes
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $USER_DATA_TOKEN" \
  http://localhost:8080/api/quotes/1/like

kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $USER_DATA_TOKEN" \
  http://localhost:8080/api/quotes/2/like

# Unregister the user account
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $USER_DATA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"Hello-user-with-data-unregister"}' \
  http://localhost:8080/api/auth/unregister

# Verify all data is deleted
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_likes.find({username: 'user-with-data-unregister'}).pretty()"
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_progress.find({username: 'user-with-data-unregister'}).pretty()"
```

### Test that deleted user cannot login

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-unregister-test","password":"Hello-user-unregister-test"}'
```

Expected response: `401 Unauthorized` with body `"Invalid credentials"`

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Incorrect password | `401 Unauthorized` | `Invalid password` |
| User not found | `400 Bad Request` | `User not found: {username}` |
| Missing password field | `400 Bad Request` | Validation error message |
| Database error | `500 Internal Server Error` | `An error occurred while deleting account` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/UnregisterRequest.java` | **Create** — new DTO for unregister request |
| `repository/UserRepository.java` | **Update** — add `deleteByUsername()` method |
| `repository/UserLikeRepository.java` | **Update** — add `deleteAllByUsername()` method |
| `repository/UserProgressRepository.java` | **Update** — add `deleteByUsername()` method |
| `repository/UserRoleRepository.java` | **Update** — add `deleteAllByUsername()` method |
| `service/AuthService.java` | **Update** — add `unregister()` method |
| `resource/AuthResource.java` | **Update** — add `DELETE /api/auth/unregister` endpoint |

---

## Notes

- The endpoint is accessible to any authenticated user (self-service account deletion)
- The JWT token must include the `username` claim
- Password verification is required to prevent unauthorized account deletion
- The implementation deletes all user data in a specific order to maintain referential integrity:
  1. User likes (to avoid orphaned like records)
  2. User progress (to avoid orphaned progress records)
  3. User roles (to avoid orphaned role assignments)
  4. User record (last, after all dependent data is removed)
- This is different from the admin delete endpoint (`DELETE /api/manage/users/account`) which allows admins to delete other users' accounts
- MongoDB collections used: `users`, `user_roles`, `user_likes`, `user_progress`
- Validation is performed using Jakarta Bean Validation annotations (`@NotBlank`)
- The deletion is performed in a transaction-like manner (though MongoDB transactions are not used, the order ensures consistency)
- Consider adding soft delete functionality instead of hard delete for audit purposes
- Consider adding audit logging for all account deletions
- Consider adding a confirmation step (e.g., require typing the username to confirm deletion)
- Consider adding a grace period where deleted accounts can be restored
- Consider adding a warning about data loss before allowing deletion
- Consider checking if the user is the last admin before allowing deletion (to avoid locking out all admins)
- The C# implementation notes that related data should be deleted but doesn't implement it - the Java implementation properly deletes all related data
