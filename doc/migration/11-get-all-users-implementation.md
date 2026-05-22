# Implementation: GET /api/manage/users (Admin Only)

Migrate the C# `GET /api/manage/users` endpoint from `quote-azure-k8-backend` to Java Quarkus.

## What this endpoint does

- Requires a valid JWT Bearer token with ADMIN role
- Extracts the `username` from the JWT
- Returns a list of all users in the system with their roles and status information
- Only accessible to users with ADMIN role

---

## C# Implementation Reference

### Controller: AdminController.cs

```csharp
[HttpGet("users")]
[Authorize(Roles = "ADMIN")]
public async Task<ActionResult<IEnumerable<Models.Admin.AdminUserInfo>>> GetAllUsers()
{
    try
    {
        var adminId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var users = await _userService.GetAllUsersAsync(adminId);
        return Ok(users);
    }
    catch (Exception ex)
    {
        return StatusCode(500, "An error occurred while retrieving users");
    }
}
```

### Service: UserService.cs

```csharp
public async Task<IEnumerable<Models.Admin.AdminUserInfo>> GetAllUsersAsync(string adminId)
{
    try
    {
        if (!await IsAdminAsync(adminId))
            throw new UnauthorizedAccessException("Only admins can list all users");

        var users = await _userRepository.GetAllAsync();
        var userInfos = new List<Models.Admin.AdminUserInfo>();

        foreach (var user in users)
        {
            // Get user roles
            var userRoles = await _userRoleRepository.GetUserRolesAsync(user.Username);
            var roles = userRoles.Select(r => string.IsNullOrEmpty(r.Role) ? string.Empty : r.Role.ToUpper()).ToArray();
            
            var userInfo = new Models.Admin.AdminUserInfo
            {
                Username = user.Username,
                Email = user.Email,
                Roles = roles,
                Enabled = user.IsActive,
                UserStatus = user.IsActive ? "ACTIVE" : "INACTIVE",
                UserCreateDate = user.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                UserLastModifiedDate = user.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ")
            };
            
            userInfos.Add(userInfo);
        }

        return userInfos;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error getting all users");
        throw;
    }
}
```

### Model: AdminUserInfo.cs

```csharp
namespace quote_azure_k8_backend.Models.Admin
{
    public class AdminUserInfo
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string[] Roles { get; set; } = new string[0];
        public bool Enabled { get; set; }
        public string UserStatus { get; set; } = string.Empty;
        public string? UserCreateDate { get; set; }
        public string? UserLastModifiedDate { get; set; }
    }
}
```

---

## Java Migration

### 1. Create AdminUserInfo DTO

Create `AdminUserInfo.java` in `com.quote.k8.dto`:

```java
package com.quote.k8.dto;

import java.time.LocalDateTime;
import java.util.List;

public class AdminUserInfo {
    public String username;
    public String email;
    public List<String> roles;
    public boolean enabled;
    public String userStatus;
    public String userCreateDate;
    public String userLastModifiedDate;

    // Constructors
    public AdminUserInfo() {}

    public AdminUserInfo(String username, String email, List<String> roles, boolean enabled, 
                         String userStatus, String userCreateDate, String userLastModifiedDate) {
        this.username = username;
        this.email = email;
        this.roles = roles;
        this.enabled = enabled;
        this.userStatus = userStatus;
        this.userCreateDate = userCreateDate;
        this.userLastModifiedDate = userLastModifiedDate;
    }
}
```

---

### 2. Update UserRoleRepository

Add a method to get all roles for a specific user in `UserRoleRepository.java`:

```java
public List<UserRole> findAllByUsername(String username) {
    return find("username", username).list();
}
```

---

### 3. Update UserRepository

Add a method to get all users in `UserRepository.java`:

```java
public List<User> findAllUsers() {
    return findAll().list();
}
```

---

### 4. Update AuthService

Add the `getAllUsers` method to `AuthService.java`. This method:
1. Verifies the requesting user has ADMIN role
2. Gets all users from the repository
3. For each user, fetches their roles
4. Returns a list of AdminUserInfo objects

```java
public List<AdminUserInfo> getAllUsers(String adminUsername) {
    LOG.info("Getting all users for admin: " + adminUsername);

    // Verify admin role
    if (!userRoleRepository.userHasRole(adminUsername, "ADMIN")) {
        throw new SecurityException("Only admins can list all users");
    }

    List<User> users = userRepository.findAllUsers();
    List<AdminUserInfo> userInfos = new ArrayList<>();

    for (User user : users) {
        // Get user roles
        List<UserRole> userRoles = userRoleRepository.findAllByUsername(user.username);
        List<String> roles = userRoles.stream()
                .map(ur -> ur.role != null ? ur.role.toUpperCase() : "")
                .filter(r -> !r.isEmpty())
                .collect(Collectors.toList());

        // Default to USER role if no roles found
        if (roles.isEmpty()) {
            roles.add("USER");
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");
        String createDate = user.createdAt != null ? user.createdAt.format(formatter) : null;
        String lastModifiedDate = user.updatedAt != null ? user.updatedAt.format(formatter) : null;

        AdminUserInfo userInfo = new AdminUserInfo(
            user.username,
            user.email,
            roles,
            user.isActive,
            user.isActive ? "ACTIVE" : "INACTIVE",
            createDate,
            lastModifiedDate
        );

        userInfos.add(userInfo);
    }

    LOG.info("Retrieved " + userInfos.size() + " users");
    return userInfos;
}
```

Add the necessary imports at the top of `AuthService.java`:

```java
import com.quote.k8.dto.AdminUserInfo;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
```

---

### 5. Create AdminResource

Create `AdminResource.java` in `com.quote.k8.resource`:

```java
package com.quote.k8.resource;

import com.quote.k8.dto.AdminUserInfo;
import com.quote.k8.service.AuthService;
import io.quarkus.security.Authenticated;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

import java.util.List;

@Path("/api/manage")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AdminResource {

    private static final Logger LOG = Logger.getLogger(AdminResource.class);

    @Inject
    AuthService authService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("/users")
    @RolesAllowed("ADMIN")
    public Response getAllUsers() {
        try {
            String username = jwt.getClaim("username");
            LOG.info("GET /api/manage/users - Fetching all users for admin: " + username);

            if (username == null || username.isBlank()) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("Invalid token: username claim missing")
                        .build();
            }

            List<AdminUserInfo> users = authService.getAllUsers(username);
            return Response.ok(users).build();
        } catch (SecurityException e) {
            LOG.warn("Unauthorized access attempt: " + e.getMessage());
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(e.getMessage())
                    .build();
        } catch (Exception e) {
            LOG.error("Error fetching all users", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("An error occurred while retrieving users")
                    .build();
        }
    }
}
```

---

## 6. Build and Deploy

```bash
cd k8-quote-api
mvn clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name multi-node-cluster
kubectl rollout restart deployment/quote-api-jvm -n quote-k8-java
```

---

## 7. Test the Endpoint

### Login as admin to get a token

```bash
TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"admin","password":"Admin123!"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Call the get all users endpoint

```bash
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/manage/users
```

### Expected success response (HTTP 200)

```json
[
  {
    "username": "admin",
    "email": "admin@quote-backend.local",
    "roles": ["ADMIN"],
    "enabled": true,
    "userStatus": "ACTIVE",
    "userCreateDate": "2026-05-22T10:00:00Z",
    "userLastModifiedDate": "2026-05-22T10:00:00Z"
  },
  {
    "username": "user-a",
    "email": "user-a@example.com",
    "roles": ["USER"],
    "enabled": true,
    "userStatus": "ACTIVE",
    "userCreateDate": "2026-05-22T11:00:00Z",
    "userLastModifiedDate": "2026-05-22T11:00:00Z"
  },
  {
    "username": "user-b",
    "email": "user-b@example.com",
    "roles": ["USER"],
    "enabled": true,
    "userStatus": "ACTIVE",
    "userCreateDate": "2026-05-22T12:00:00Z",
    "userLastModifiedDate": "2026-05-22T12:00:00Z"
  }
]
```

### Test with non-admin user (should fail)

```bash
# Login as regular user
USER_TOKEN=$(kubectl exec <pod-name> -n quote-k8-java -- curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginIdentifier":"user-a","password":"Hello-user-a"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access admin endpoint
kubectl exec <pod-name> -n quote-k8-java -- curl -s \
  -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:8080/api/manage/users
```

Expected response: `403 Forbidden`

### Verify users in MongoDB

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.users.find().pretty()"
```

```bash
kubectl exec -it <mongodb-pod> -n quote-k8-java -- mongosh quote-db --eval "db.user_roles.find().pretty()"
```

### Expected error responses

| Scenario | HTTP Status | Body |
|---|---|---|
| Missing / invalid token | `401 Unauthorized` | `Invalid token: username claim missing` |
| Non-admin user | `403 Forbidden` | `Only admins can list all users` |
| Server error | `500 Internal Server Error` | `An error occurred while retrieving users` |

---

## Summary of changed files

| File | Action |
|---|---|
| `dto/AdminUserInfo.java` | **Create** — new DTO class for admin user info |
| `repository/UserRoleRepository.java` | **Update** — add `findAllByUsername()` method |
| `repository/UserRepository.java` | **Update** — add `findAllUsers()` method |
| `service/AuthService.java` | **Update** — add `getAllUsers()` method |
| `resource/AdminResource.java` | **Create** — new resource with admin endpoints |

---

## Notes

- The endpoint uses `@RolesAllowed("ADMIN")` annotation to enforce admin-only access
- The JWT token must include the `username` claim
- Users without any roles in the `user_roles` collection default to "USER" role
- The endpoint returns user dates in ISO 8601 format (yyyy-MM-ddTHH:mm:ssZ)
- The admin user is created by the `UserSeeder` during application startup with username "admin" and password "Admin123!"
- This endpoint is part of the admin management API under `/api/manage` path
