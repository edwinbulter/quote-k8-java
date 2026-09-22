package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    
    @NotBlank(message = "Email or username is required")
    public String loginIdentifier;
    
    @NotBlank(message = "Password is required")
    public String password;
}
