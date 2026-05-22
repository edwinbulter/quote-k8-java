package com.quote.k8.dto;

import java.util.List;

public class AdminUserInfo {
    public String username;
    public String email;
    public List<String> roles;
    public boolean enabled;
    public String userStatus;
    public String userCreateDate;
    public String userLastModifiedDate;

    // Constructors
    public AdminUserInfo() {}

    public AdminUserInfo(String username, String email, List<String> roles, boolean enabled, 
                         String userStatus, String userCreateDate, String userLastModifiedDate) {
        this.username = username;
        this.email = email;
        this.roles = roles;
        this.enabled = enabled;
        this.userStatus = userStatus;
        this.userCreateDate = userCreateDate;
        this.userLastModifiedDate = userLastModifiedDate;
    }
}
