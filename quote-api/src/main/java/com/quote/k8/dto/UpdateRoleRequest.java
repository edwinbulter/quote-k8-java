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
