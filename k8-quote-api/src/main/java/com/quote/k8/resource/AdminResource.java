package com.quote.k8.resource;

import com.quote.k8.dto.AdminUserInfo;
import com.quote.k8.service.AuthService;
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
