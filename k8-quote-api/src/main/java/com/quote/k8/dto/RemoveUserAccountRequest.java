package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class RemoveUserAccountRequest {
    
    @NotBlank(message = "Username is required")
    public String username;
    
    // Constructors
    public RemoveUserAccountRequest() {}
    
    public RemoveUserAccountRequest(String username) {
        this.username = username;
    }
}
