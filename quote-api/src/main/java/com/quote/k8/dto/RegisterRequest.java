package com.quote.k8.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {
    
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email address")
    public String email;
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    public String username;
    
    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters long")
    public String password;
    
    @NotBlank(message = "Password confirmation is required")
    public String confirmPassword;
    
    // Custom validation for password matching
    public boolean isPasswordMatch() {
        return password != null && password.equals(confirmPassword);
    }
}
