package com.quote.k8.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChangePasswordRequest {
    
    @NotBlank(message = "Current password is required")
    public String currentPassword;
    
    @NotBlank(message = "New password is required")
    @Size(min = 8, message = "Password must be at least 8 characters long")
    public String newPassword;
    
    @NotBlank(message = "Password confirmation is required")
    public String confirmNewPassword;
    
    // Constructors
    public ChangePasswordRequest() {}
    
    public ChangePasswordRequest(String currentPassword, String newPassword, String confirmNewPassword) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
        this.confirmNewPassword = confirmNewPassword;
    }
    
    // Custom validation for password matching
    public boolean isPasswordMatch() {
        return newPassword != null && newPassword.equals(confirmNewPassword);
    }
}
