package com.quote.k8.resource;

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
}
