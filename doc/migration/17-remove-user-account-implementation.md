# Implementation: DELETE /api/manage/users/account (Admin Only)

Migrate the C# `DELETE /api/manage/users/delete` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Extracts the `username` from the JWT to identify the requesting admin
- Accepts a JSON body with `username` (target user to delete)
- Validates that the target user exists
- Deletes the user account and all associated data:
  - User record from `users` collection
  - All role assignments from `user_roles` collection
  - All liked quotes from `user_likes` collection
  - User progress from `user_progress` collection
- Returns a success message on successful deletion
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpDelete("users/delete")]
public async Task<ActionResult> DeleteUserAccount([FromBody] RemoveUserAccountRequest request)
{
    try
    {
        var targetUser = await _userService.GetUserByUsernameAsync(request.Username);
        if (targetUser == null)
            return NotFound("User not found");

        var result = await _userService.DeleteUserAsync(targetUser.Id);
        if (result)
            return Ok("User account deleted successfully");
        else
            return BadRequest("Failed to delete user account");
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while deleting user account");
    }
}

public class RemoveUserAccountRequest
{
    public string Username { get; set; } = string.Empty;
}
```

### Service: UserService.cs

```csharp
public async Task<bool> DeleteUserAsync(string userId)
{
    try
    {
        return await _userRepository.DeleteAsync(userId);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error deleting user");
        return false;
    }
}
```

### Repository: UserRepository.cs

```csharp
public async Task<bool> DeleteAsync(string id)
{
    try
    {
        // First get the entity to find the RowKey
        var entity = await _tableClient.GetEntityAsync<TableEntity>("users", id);
        await _tableClient.DeleteEntityAsync(entity.Value.PartitionKey, entity.Value.RowKey);
        return true;
    }
    catch (RequestFailedException ex) when (ex.Status == 404)
    {
        return false;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error deleting user with ID: {UserId}", id);
        throw;
    }
}
```

### Repository: UserActivityRepository.cs (Additional cleanup)

```csharp
public async Task<bool> RemoveAllUserLikesAsync(string userId)
{
    try
    {
        var query = _userLikeTable.QueryAsync<UserLikeEntity>(filter: $"PartitionKey eq '{userId}'");
        
        await foreach (var entity in query)
        {
            await _userLikeTable.DeleteEntityAsync(entity.PartitionKey, entity.RowKey);
        }
        
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error removing all user likes for user: {UserId}", userId);
        return false;
    }
}

public async Task<bool> RemoveUserProgressAsync(string userId)
{
    try
    {
        await _userProgressTable.DeleteEntityAsync("userprogress", userId);
        return true;
    }
    catch (RequestFailedException ex) when (ex.Status == 404)
    {
        return false;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error removing user progress for user: {UserId}", userId);
        return false;
    }
}
```

---

## Java Migration

### 1. Create RemoveUserAccountRequest DTO

Create `RemoveUserAccountRequest.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class RemoveUserAccountRequest {
    
    @NotBlank(message = "Username is required")
    public String username;
    
    // Constructors
    public RemoveUserAccountRequest() {}
    
    public RemoveUserAccountRequest(String username) {
        this.username = username;
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

Add the `deleteUserAccount` method to `AuthService.java`:

```java
public boolean deleteUserAccount(String adminUsername, RemoveUserAccountRequest request) {
    LOG.info("Deleting user account: " + request.username + " by admin: " + adminUsername);

    // Verify admin role
    if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
        throw new SecurityException("Only admins can delete user accounts");
    }

    // Find target user
    User targetUser = userRepository.findByUsername(request.username)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.username));

    // Prevent deleting the admin's own account
    if (targetUser.username.equals(adminUsername)) {
        throw new IllegalArgumentException("Cannot delete your own account");
    }

    // Delete all user data in the correct order
    // 1. Delete user likes
    userLikeRepository.deleteAllByUsername(targetUser.username);
    LOG.info("Deleted all likes for user: " + targetUser.username);

    // 2. Delete user progress
    userProgressRepository.deleteByUsername(targetUser.username);
    LOG.info("Deleted user progress for: " + targetUser.username);

    // 3. Delete user roles
    userRoleRepository.deleteAllByUsername(targetUser.username);
    LOG.info("Deleted all roles for user: " + targetUser.username);

    // 4. Delete user record
    userRepository.deleteByUsername(targetUser.username);
    LOG.info("Deleted user account: " + targetUser.username);

    return true;
}
```

---

### 7. Update AdminResource

Add the `DELETE /api/manage/users/account` endpoint to `AdminResource.java`:

```java
@DELETE
@Path("/users/account")
@RolesAllowed("ADMIN")
public Response deleteUserAccount(RemoveUserAccountRequest request) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("DELETE /api/manage/users/account - Deleting account for user: " + request.username + " by admin: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        boolean result = authService.deleteUserAccount(username, request);
        if (result) {
            return Response.ok("User account deleted successfully").build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to delete user account")
                    .build();
        }
    } catch (SecurityException e) {
        LOG.warn("Unauthorized access attempt: " + e.getMessage());
        return Response.status(Response.Status.FORBIDDEN)
                .entity(e.getMessage())
                .build();
    } catch (IllegalArgumentException e) {
        LOG.warn("Invalid request: " + e.getMessage());
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(e.getMessage())
                .build();
    } catch (Exception e) {
        LOG.error("Error deleting user account", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while deleting user account")
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

### Login as admin to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"admin","password":"Admin123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### First, create a test user to delete

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user-delete-test@outlook.com",
    "username": "user-delete-test",
    "password": "Hello-user-delete-test",
    "confirmPassword": "Hello-user-delete-test"
  }' \
  http://localhost:8080/api/auth/register
```

### Verify the user exists

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/users
```

### Call the delete user account endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-delete-test"}' \
  http://localhost:8080/api/manage/users/account
```

### Expected success response (HTTP 200)

```json
"User account deleted successfully"
```

### Test with non-existent user (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent-user"}' \
  http://localhost:8080/api/manage/users/account
```

Expected response: `400 Bad Request` with body `"User not found: nonexistent-user"`

### Test with deleting own account (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin"}' \
  http://localhost:8080/api/manage/users/account
```

Expected response: `400 Bad Request` with body `"Cannot delete your own account"`

### Test with non-admin user (should fail)

```bash
# Login as regular user
USER_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access admin endpoint
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-delete-test"}' \
  http://localhost:8080/api/manage/users/account
```

Expected response: `403 Forbidden`

### Verify user deletion in MongoDB

```bash
# Check users collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.users.find({username: 'user-delete-test'}).pretty()"

# Check user_roles collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find({username: 'user-delete-test'}).pretty()"

# Check user_likes collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_likes.find({username: 'user-delete-test'}).pretty()"

# Check user_progress collection
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_progress.find({username: 'user-delete-test'}).pretty()"
```

Expected output should be empty (no documents found) for all collections after successful deletion.

### Test with user who has likes and progress

```bash
# Create a user
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user-with-data@outlook.com",
    "username": "user-with-data",
    "password": "Hello-user-with-data",
    "confirmPassword": "Hello-user-with-data"
  }' \
  http://localhost:8080/api/auth/register

# Login as the user
USER_DATA_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-with-data","password":"Hello-user-with-data"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Like some quotes
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $USER_DATA_TOKEN" \
  http://localhost:8080/api/quotes/1/like

kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST \
  -H "Authorization: Bearer $USER_DATA_TOKEN" \
  http://localhost:8080/api/quotes/2/like

# Delete the user account (as admin)
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-with-data"}' \
  http://localhost:8080/api/manage/users/account

# Verify all data is deleted
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_likes.find({username: 'user-with-data'}).pretty()"
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_progress.find({username: 'user-with-data'}).pretty()"
```

### Test with missing username field

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:8080/api/manage/users/account
```

Expected response: `400 Bad Request` with validation error message

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Non-admin user | `403 Forbidden` | `Only admins can delete user accounts` |
| User not found | `400 Bad Request` | `User not found: {username}` |
| Deleting own account | `400 Bad Request` | `Cannot delete your own account` |
| Missing username field | `400 Bad Request` | Validation error message |
| Database error | `500 Internal Server Error` | `An error occurred while deleting user account` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/RemoveUserAccountRequest.java` | **Create** — new DTO for delete request |
| `repository/UserRepository.java` | **Update** — add `deleteByUsername()` method |
| `repository/UserLikeRepository.java` | **Update** — add `deleteAllByUsername()` method |
| `repository/UserProgressRepository.java` | **Update** — add `deleteByUsername()` method |
| `repository/UserRoleRepository.java` | **Update** — add `deleteAllByUsername()` method |
| `service/AuthService.java` | **Update** — add `deleteUserAccount()` method |
| `resource/AdminResource.java` | **Update** — add `DELETE /api/manage/users/account` endpoint |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- The implementation deletes all user data in a specific order to maintain referential integrity:
  1. User likes (to avoid orphaned like records)
  2. User progress (to avoid orphaned progress records)
  3. User roles (to avoid orphaned role assignments)
  4. User record (last, after all dependent data is removed)
- The endpoint prevents admins from deleting their own account to avoid locking themselves out
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
- This endpoint is part of the admin management API under `/api/manage` path
- MongoDB collections used: `users`, `user_roles`, `user_likes`, `user_progress`
- Validation is performed using Jakarta Bean Validation annotations (`@NotBlank`)
- The deletion is performed in a transaction-like manner (though MongoDB transactions are not used, the order ensures consistency)
- Consider adding soft delete functionality instead of hard delete for audit purposes
- Consider adding audit logging for all account deletions
- Consider adding a confirmation step (e.g., require typing the username to confirm deletion)
- Consider adding a grace period where deleted accounts can be restored
- Consider checking if the user is the last admin before allowing deletion (to avoid locking out all admins)
