package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class UnregisterRequest {
    
    @NotBlank(message = "Password is required")
    public String password;
    
    // Constructors
    public UnregisterRequest() {}
    
    public UnregisterRequest(String password) {
        this.password = password;
    }
}
