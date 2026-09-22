package com.quote.k8.service;

import com.quote.k8.model.User;
import com.quote.k8.model.UserRole;
import com.quote.k8.repository.UserRoleRepository;
import io.smallrye.jwt.build.Jwt;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Optional;

@ApplicationScoped
public class JwtService {

    @Inject
    UserRoleRepository userRoleRepository;

    @ConfigProperty(name = "mp.jwt.verify.issuer")
    String issuer;

    @ConfigProperty(name = "mp.jwt.verify.audience")
    String audience;

    public String generateToken(User user) {
        // Get user roles
        Optional<UserRole> userRole = userRoleRepository.findByUsername(user.username);
        
        var jwtBuilder = Jwt.claims()
                .subject(user.id.toString())
                .upn(user.email)
                .claim("username", user.username)
                .claim("email", user.email)
                .issuer(issuer)
                .audience(audience);
        
        // Add role if present
        userRole.ifPresent(role -> jwtBuilder.groups(role.role));
        
        return jwtBuilder.sign();
    }
}
