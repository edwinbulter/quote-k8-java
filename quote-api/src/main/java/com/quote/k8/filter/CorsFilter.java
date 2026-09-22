package com.quote.k8.filter;

import io.vertx.core.http.HttpServerResponse;
import jakarta.enterprise.event.Observes;
import io.vertx.ext.web.Router;
import jakarta.inject.Singleton;

@Singleton
public class CorsFilter {

    public void register(@Observes Router router) {
        router.route().order(10).handler(ctx -> {
            HttpServerResponse response = ctx.response();
            response.putHeader("Access-Control-Allow-Origin", "http://localhost:5173");
            response.putHeader("Access-Control-Allow-Credentials", "true");
            response.putHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.putHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
            
            if (ctx.request().method().name().equals("OPTIONS")) {
                response.setStatusCode(200).end();
            } else {
                ctx.next();
            }
        });
    }
}
