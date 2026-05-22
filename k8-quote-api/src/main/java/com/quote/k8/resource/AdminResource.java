package com.quote.k8.resource;

import com.quote.k8.dto.AdminUserInfo;
import com.quote.k8.dto.QuoteAddResponse;
import com.quote.k8.dto.QuotePageResponse;
import com.quote.k8.service.AuthService;
import com.quote.k8.service.QuoteManagementService;
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
    QuoteManagementService quoteManagementService;

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

    @GET
    @Path("/quotes")
    @RolesAllowed("ADMIN")
    public Response getQuotes(
            @QueryParam("page") @DefaultValue("1") int page,
            @QueryParam("pageSize") @DefaultValue("50") int pageSize,
            @QueryParam("sortBy") @DefaultValue("id") String sortBy,
            @QueryParam("sortOrder") @DefaultValue("asc") String sortOrder,
            @QueryParam("quoteText") String quoteText,
            @QueryParam("author") String author) {
        try {
            String username = jwt.getClaim("username");
            LOG.info("GET /api/manage/quotes - Fetching quotes for admin: " + username);

            if (username == null || username.isBlank()) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("Invalid token: username claim missing")
                        .build();
            }

            QuotePageResponse response = quoteManagementService.getQuotes(page, pageSize, quoteText, author, sortBy, sortOrder);
            return Response.ok(response).build();
        } catch (Exception e) {
            LOG.error("Error fetching quotes", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("An error occurred while retrieving quotes")
                    .build();
        }
    }

    @POST
    @Path("/quotes/fetch")
    @RolesAllowed("ADMIN")
    public Response fetchQuotes() {
        try {
            String username = jwt.getClaim("username");
            LOG.info("POST /api/manage/quotes/fetch - Fetching quotes for admin: " + username);

            if (username == null || username.isBlank()) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("Invalid token: username claim missing")
                        .build();
            }

            QuoteAddResponse response = quoteManagementService.fetchAndAddNewQuotes(username);
            return Response.ok(response).build();
        } catch (Exception e) {
            LOG.error("Error fetching quotes", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("An error occurred while fetching quotes")
                    .build();
        }
    }
}
