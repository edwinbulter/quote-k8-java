package com.quote.k8.resource;

import com.quote.k8.service.UserSeeder;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SeedResource {

    private static final Logger LOG = Logger.getLogger(SeedResource.class);

    @Inject
    UserSeeder userSeeder;

    @POST
    @Path("/seed-users")
    public Response seedUsers() {
        try {
            LOG.info("POST /api/seed-users - Seeding users");
            userSeeder.seedUsers();
            return Response.ok("Users seeded successfully").build();
        } catch (Exception e) {
            LOG.error("Error seeding users", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("An error occurred while seeding users: " + e.getMessage())
                    .build();
        }
    }
}
