package com.quote.k8.resource;

import com.quote.k8.model.Quote;
import com.quote.k8.service.QuoteService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class QuoteResource {

    private static final Logger LOG = Logger.getLogger(QuoteResource.class);

    @Inject
    QuoteService quoteService;

    @Inject
    JsonWebToken jwt;

    @GET
    @Path("/quote")
    @Authenticated
    public Response getQuote() {
        try {
            String username = jwt.getClaim("username");
            LOG.info("GET /api/quote - Fetching quote for user: " + username);

            if (username == null || username.isBlank()) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("Invalid token: username claim missing")
                        .build();
            }

            Quote quote = quoteService.getNextQuoteForUser(username);
            if (quote == null) {
                return Response.status(Response.Status.NOT_FOUND).entity("No quotes available").build();
            }
            return Response.ok(quote).build();
        } catch (Exception e) {
            LOG.error("Error fetching quote for authenticated user", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Error fetching quote: " + e.getMessage())
                    .build();
        }
    }

    @GET
    @Path("/quotes/random")
    public Response getRandomQuote() {
        try {
            LOG.info("GET /api/quotes/random - Fetching random quote");
            Quote quote = quoteService.getRandomQuote();
            if (quote == null) {
                return Response.status(Response.Status.NOT_FOUND).entity("No quotes available").build();
            }
            return Response.ok(quote).build();
        } catch (Exception e) {
            LOG.error("Error fetching random quote", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Error fetching quote: " + e.getMessage())
                    .build();
        }
    }

    @POST
    @Path("/quote")
    public Response getQuoteWithExclusions(List<Integer> excludedIds) {
        try {
            LOG.info("POST /api/quote - Fetching random quote with exclusions");
            Set<Integer> exclusions = excludedIds != null ? excludedIds.stream().collect(Collectors.toSet()) : Set.of();
            Quote quote = quoteService.getRandomQuote(exclusions);
            if (quote == null) {
                return Response.status(Response.Status.NOT_FOUND).entity("No quotes available").build();
            }
            return Response.ok(quote).build();
        } catch (Exception e) {
            LOG.error("Error fetching random quote with exclusions", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Error fetching quote: " + e.getMessage())
                    .build();
        }
    }

    @GET
    @Path("/quote/viewed")
    @Authenticated
    public Response getViewHistory() {
        try {
            String username = jwt.getClaim("username");
            LOG.info("GET /api/quote/viewed - Fetching view history for user: " + username);

            if (username == null || username.isBlank()) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity("Invalid token: username claim missing")
                        .build();
            }

            List<Quote> viewedQuotes = quoteService.getViewedQuotesForUser(username);
            return Response.ok(viewedQuotes).build();
        } catch (Exception e) {
            LOG.error("Error fetching view history for authenticated user", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Error fetching view history: " + e.getMessage())
                    .build();
        }
    }
}
