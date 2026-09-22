# Implementation: DELETE /api/manage/users/role (Admin Only)

Migrate the C# `DELETE /api/manage/users/role` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Extracts the `username` from the JWT to identify the requesting admin
- Accepts a JSON body with `username` (target user) and `role` (role to remove)
- Validates that the target user exists
- Validates that the target user has the specified role
- Removes the role assignment for the target user
- Returns a success message on successful role removal
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpDelete("users/role")]
public async Task<ActionResult> RemoveUserRole([FromBody] UpdateRoleRequest request)
{
    try
    {
        var result = await _userService.RemoveUserRoleAsync(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, request);
        if (result)
            return Ok("User role removed successfully");
        else
            return BadRequest("Failed to remove user role");
    }
    catch (UnauthorizedAccessException)
    {
        return Forbid();
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while removing user role");
    }
}
```

### Model: UpdateRoleRequest.cs

```csharp
using System.ComponentModel.DataAnnotations;

namespace quote_azure_k8_backend.Models.Auth
{
    public class UpdateRoleRequest
    {
        [Required(ErrorMessage = "Username is required")]
        public string username { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "Role is required")]
        public string role { get; set; } = string.Empty;
    }
}
```

### Service: UserService.cs

```csharp
public async Task<bool> RemoveUserRoleAsync(string adminId, UpdateRoleRequest request)
{
    try
    {
        var targetUser = await _userRepository.GetByUsernameAsync(request.username);
        if (targetUser == null)
            return false;

        await _userRoleRepository.DeleteUserRoleAsync(targetUser.Username);

        _logger.LogInformation("User role removed: {Username}", targetUser.Username);
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error removing user role");
        throw;
    }
}
```

### Repository: UserRoleRepository.cs

```csharp
public async Task<bool> DeleteUserRoleAsync(string username)
{
    try
    {
        await _tableClient.DeleteEntityAsync("userroles", username);
        return true;
    }
    catch (RequestFailedException ex) when (ex.Status == 404)
    {
        return false;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error deleting user role for user: {Username}", username);
        return false;
    }
}
```

---

## Java Migration

### 1. UpdateRoleRequest DTO (Already Exists)

The `UpdateRoleRequest.java` DTO already exists in `com.quote.k8.dto` and can be reused:

```java
package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateRoleRequest {
    
    @NotBlank(message = "Username is required")
    public String username;
    
    @NotBlank(message = "Role is required")
    public String role;
    
    // Constructors
    public UpdateRoleRequest() {}
    
    public UpdateRoleRequest(String username, String role) {
        this.username = username;
        this.role = role;
    }
}
```

---

### 2. Update AuthService

Add the `removeUserRole` method to `AuthService.java`:

```java
public boolean removeUserRole(String adminUsername, UpdateRoleRequest request) {
    LOG.info("Removing user role for: " + request.username + " role: " + request.role + " by admin: " + adminUsername);

    // Verify admin role
    if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
        throw new SecurityException("Only admins can remove user roles");
    }

    // Find target user
    User targetUser = userRepository.findByUsername(request.username)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.username));

    // Check if user has this role
    String roleUpper = request.role.toUpperCase();
    if (!userRoleRepository.userHasRole(targetUser.username, roleUpper)) {
        LOG.info("User " + targetUser.username + " does not have role: " + roleUpper);
        return false;
    }

    // Delete the role assignment
    userRoleRepository.deleteByUsernameAndRole(targetUser.username, roleUpper);

    LOG.info("User role removed successfully: " + targetUser.username + " -> " + roleUpper);
    return true;
}
```

---

### 3. Update AdminResource

Add the `DELETE /api/manage/users/role` endpoint to `AdminResource.java`:

```java
@DELETE
@Path("/users/role")
@RolesAllowed("ADMIN")
public Response removeUserRole(UpdateRoleRequest request) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("DELETE /api/manage/users/role - Removing role for user: " + request.username + " by admin: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        boolean result = authService.removeUserRole(username, request);
        if (result) {
            return Response.ok("User role removed successfully").build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to remove user role")
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
        LOG.error("Error removing user role", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while removing user role")
                .build();
    }
}
```

---

## 4. Build and Deploy

```bash
cd quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name single-node
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 5. Test the Endpoint

### Login as admin to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"admin","password":"Admin123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### First, assign a role to a user (if not already assigned)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

### Call the remove user role endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

### Expected success response (HTTP 200)

```json
"User role removed successfully"
```

### Test with non-existent user (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent-user","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Expected response: `400 Bad Request` with body `"User not found: nonexistent-user"`

### Test with user who doesn't have the role (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Expected response: `400 Bad Request` with body `"Failed to remove user role"` (because the user doesn't have that role)

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
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Expected response: `403 Forbidden`

### Verify role removal in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find({username: 'user-b', role: 'ADMIN'}).pretty()"
```

Expected output should be empty (no documents found) after successful removal.

### Verify user no longer has the role via get all users endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/users
```

The response should show `user-b` without the removed role in their roles array.

### Test removing one role from a user with multiple roles

```bash
# Assign ADMIN role
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role

# Assign USER role (supports multiple roles)
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"USER"}' \
  http://localhost:8080/api/manage/users/role

# Remove ADMIN role (should keep USER role)
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Verify in MongoDB that user-b still has the USER role:

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find({username: 'user-b'}).pretty()"
```

### Test with missing fields

```bash
# Missing role
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b"}' \
  http://localhost:8080/api/manage/users/role

# Missing username
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Expected response: `400 Bad Request` with validation error message

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Non-admin user | `403 Forbidden` | `Only admins can remove user roles` |
| User not found | `400 Bad Request` | `User not found: {username}` |
| User doesn't have the role | `400 Bad Request` | `Failed to remove user role` |
| Missing username field | `400 Bad Request` | Validation error message |
| Missing role field | `400 Bad Request` | Validation error message |
| Database error | `500 Internal Server Error` | `An error occurred while removing user role` |

---

## Summary of changed files

| File | Action |
|---|---|
| `service/AuthService.java` | **Update** — add `removeUserRole()` method |
| `resource/AdminResource.java` | **Update** — add `DELETE /api/manage/users/role` endpoint |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- The implementation supports multiple roles per user (unlike the old C# single-role format)
- Roles are stored in uppercase in the database for consistency
- The endpoint removes a specific role assignment rather than all roles
- The role name is converted to uppercase before deletion
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
- This endpoint is part of the admin management API under `/api/manage` path
- The MongoDB collection for roles is `user_roles`
- The `UserRole` model uses MongoDB Panache for database operations
- Validation is performed using Jakarta Bean Validation annotations (`@NotBlank`)
- The `deleteByUsernameAndRole` method in `UserRoleRepository` is used to delete the specific role assignment
- Consider adding validation to prevent removing the last ADMIN role from a user (to avoid locking out all admins)
- Consider adding audit logging for all role removals
- Consider preventing users from removing their own ADMIN role (to avoid locking themselves out)
