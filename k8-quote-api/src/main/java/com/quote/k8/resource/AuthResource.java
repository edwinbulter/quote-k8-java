package com.quote.k8.resource;

import com.quote.k8.dto.ChangePasswordRequest;
import com.quote.k8.dto.LoginRequest;
import com.quote.k8.dto.LoginResponse;
import com.quote.k8.dto.RegisterRequest;
import com.quote.k8.model.User;
import com.quote.k8.service.AuthService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final Logger LOG = Logger.getLogger(AuthResource.class);

    @Inject
    AuthService authService;

    @Inject
    JsonWebToken jwt;

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

    @POST
    @Path("/login")
    public Response login(@Valid LoginRequest request) {
        try {
            LOG.info("POST /api/auth/login - Login attempt for: " + request.loginIdentifier);
            
            String token = authService.login(request);
            
            return Response.ok(new LoginResponse(token)).build();
        } catch (IllegalArgumentException e) {
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
}
