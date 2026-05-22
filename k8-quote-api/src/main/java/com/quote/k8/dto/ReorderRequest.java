package com.quote.k8.dto;

public class ReorderRequest {
    public Integer newPosition;

    public ReorderRequest() {
    }

    public ReorderRequest(Integer newPosition) {
        this.newPosition = newPosition;
    }
}
