# Implementation: PUT /api/manage/users/role (Admin Only)

Migrate the C# `PUT /api/manage/users/role` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Extracts the `username` from the JWT to identify the requesting admin
- Accepts a JSON body with `username` (target user) and `role` (new role to assign)
- Validates that the target user exists
- Creates a new role assignment for the target user (supports multiple roles per user)
- Records the admin who made the change in the `createdBy` field
- Returns a success message on successful role update
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpPut("users/role")]
public async Task<ActionResult> UpdateUserRole([FromBody] UpdateRoleRequest request)
{
    try
    {
        var result = await _userService.UpdateUserRoleAsync(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, request);
        if (result)
            return Ok("User role updated successfully");
        else
            return BadRequest("Failed to update user role");
    }
    catch (UnauthorizedAccessException)
    {
        return Forbid();
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while updating user role");
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
public async Task<bool> UpdateUserRoleAsync(string adminId, UpdateRoleRequest request)
{
    try
    {
        var admin = await _userRepository.GetByIdAsync(adminId);
        if (admin == null)
            throw new UnauthorizedAccessException("Admin user not found");

        var targetUser = await _userRepository.GetByUsernameAsync(request.username);
        if (targetUser == null)
            return false;

        // Create new role assignment (supports multiple roles per user)
        var newRole = new UserRole
        {
            Username = targetUser.Username,
            Role = request.role.ToUpper(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = admin.Username
        };
        await _userRoleRepository.CreateUserRoleAsync(newRole);

        _logger.LogInformation("User role updated: {Username} -> {Role}", targetUser.Username, request.role);
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error updating user role");
        throw;
    }
}
```

### Repository: UserRoleRepository.cs

```csharp
public async Task<UserRole> CreateUserRoleAsync(UserRole userRole)
{
    // Sanitize username for RowKey (replace invalid characters) - match original Function
    var sanitizedUsername = userRole.Username.Replace("@", "-at-").Replace(".", "-dot-");
    
    var entity = new TableEntity("userroles", $"{sanitizedUsername}_{userRole.Role.ToUpper()}")
    {
        ["Username"] = userRole.Username,
        ["Role"] = userRole.Role.ToUpper(),
        ["CreatedAt"] = DateTime.SpecifyKind(userRole.CreatedAt, DateTimeKind.Utc),
        ["UpdatedAt"] = DateTime.SpecifyKind(userRole.UpdatedAt ?? DateTime.UtcNow, DateTimeKind.Utc),
        ["CreatedBy"] = userRole.CreatedBy,
        ["UpdatedBy"] = userRole.UpdatedBy
    };

    try
    {
        await _tableClient.AddEntityAsync(entity);
        _logger.LogInformation("User role created successfully for user: {Username}", userRole.Username);
        return userRole;
    }
    catch (RequestFailedException ex)
    {
        _logger.LogError(ex, "Error creating user role for user: {Username}", userRole.Username);
        throw;
    }
}
```

---

## Java Migration

### 1. Create UpdateRoleRequest DTO

Create `UpdateRoleRequest.java` in `com.quote.k8.dto`:

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

Add the `updateUserRole` method to `AuthService.java`:

```java
public boolean updateUserRole(String adminUsername, UpdateRoleRequest request) {
    LOG.info("Updating user role for: " + request.username + " to: " + request.role + " by admin: " + adminUsername);

    // Verify admin role
    if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
        throw new SecurityException("Only admins can update user roles");
    }

    // Find target user
    User targetUser = userRepository.findByUsername(request.username)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.username));

    // Create new role assignment (supports multiple roles per user)
    UserRole userRole = new UserRole(
        targetUser.username,
        request.role.toUpperCase(),
        adminUsername
    );
    userRoleRepository.persist(userRole);

    LOG.info("User role updated successfully: " + targetUser.username + " -> " + request.role.toUpperCase());
    return true;
}
```

Add the necessary import at the top of `AuthService.java`:

```java
import com.quote.k8.dto.UpdateRoleRequest;
```

---

### 3. Update AdminResource

Add the `PUT /api/manage/users/role` endpoint to `AdminResource.java`:

```java
@PUT
@Path("/users/role")
@RolesAllowed("ADMIN")
public Response updateUserRole(UpdateRoleRequest request) {
    try {
        String username = jwt.getClaim("username");
        LOG.info("PUT /api/manage/users/role - Updating role for user: " + request.username + " by admin: " + username);

        if (username == null || username.isBlank()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity("Invalid token: username claim missing")
                    .build();
        }

        boolean result = authService.updateUserRole(username, request);
        if (result) {
            return Response.ok("User role updated successfully").build();
        } else {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Failed to update user role")
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
        LOG.error("Error updating user role", e);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("An error occurred while updating user role")
                .build();
    }
}
```

Add the necessary import at the top of `AdminResource.java`:

```java
import com.quote.k8.dto.UpdateRoleRequest;
```

---

## 4. Build and Deploy

```bash
cd k8-quote-api
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

### Call the update user role endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

### Expected success response (HTTP 200)

```json
"User role updated successfully"
```

### Test with non-existent user (should fail)

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"nonexistent-user","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Expected response: `400 Bad Request` with body `"User not found: nonexistent-user"`

### Test with non-admin user (should fail)

```bash
# Login as regular user
USER_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access admin endpoint
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b","role":"ADMIN"}' \
  http://localhost:8080/api/manage/users/role
```

Expected response: `403 Forbidden`

### Verify role assignment in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find({username: 'user-b'}).pretty()"
```

Expected output should show the new role assignment:

```json
{
  "_id": ObjectId("..."),
  "username": "user-b",
  "role": "ADMIN",
  "createdAt": ISODate("..."),
  "createdBy": "admin"
}
```

### Verify user has the new role via get all users endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/users
```

The response should show `user-b` with the `ADMIN` role in their roles array.

### Test assigning multiple roles to the same user

```bash
# Assign ADMIN role (if not already assigned)
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
```

Verify in MongoDB that user-b has both roles:

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find({username: 'user-b'}).pretty()"
```

### Test with missing fields

```bash
# Missing role
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user-b"}' \
  http://localhost:8080/api/manage/users/role

# Missing username
kubectl exec <pod-name> -n quote-k8-java -- curl -s -X PUT \
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
| Non-admin user | `403 Forbidden` | `Only admins can update user roles` |
| User not found | `400 Bad Request` | `User not found: {username}` |
| Missing username field | `400 Bad Request` | Validation error message |
| Missing role field | `400 Bad Request` | Validation error message |
| Database error | `500 Internal Server Error` | `An error occurred while updating user role` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/UpdateRoleRequest.java` | **Create** — new DTO class for update role request |
| `service/AuthService.java` | **Update** — add `updateUserRole()` method |
| `resource/AdminResource.java` | **Update** — add `PUT /api/manage/users/role` endpoint |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- The implementation supports multiple roles per user (unlike the old C# single-role format)
- Roles are stored in uppercase in the database for consistency
- The `createdBy` field records which admin made the role change
- The endpoint creates a new role assignment rather than replacing existing roles
- The role name is converted to uppercase before storage
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
- This endpoint is part of the admin management API under `/api/manage` path
- The MongoDB collection for roles is `user_roles`
- The `UserRole` model uses MongoDB Panache for database operations
- Validation is performed using Jakarta Bean Validation annotations (`@NotBlank`)
- Consider adding role validation to ensure only valid roles (e.g., USER, ADMIN) can be assigned
- Consider adding audit logging for all role changes
- Consider preventing users from removing their own ADMIN role (to avoid locking themselves out)
