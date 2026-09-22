#!/bin/bash

set -e

# Change to project root directory
cd "$(dirname "$0")/.."

CLUSTER_NAME="single-node"
CONTEXT="kind-${CLUSTER_NAME}"
NAMESPACE="quote-k8-java"

echo "=========================================="
echo "Installing quote-k8-java into kind cluster '${CLUSTER_NAME}'"
echo "=========================================="
echo ""

# Check the kind cluster exists
if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    echo "ERROR: kind cluster '$CLUSTER_NAME' not found"
    echo "Create it first, e.g.: kind create cluster --name $CLUSTER_NAME"
    exit 1
fi
echo "✓ kind cluster '$CLUSTER_NAME' found"
echo ""

# Ensure the NGINX ingress controller is installed in this cluster
if ! kubectl --context="$CONTEXT" get namespace ingress-nginx &> /dev/null; then
    echo "Installing NGINX ingress controller..."
    kubectl apply --context="$CONTEXT" -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/kind/deploy.yaml
    echo "Waiting for ingress controller to be ready..."
    kubectl wait --context="$CONTEXT" --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=90s
    echo "✓ Ingress controller installed"
else
    echo "✓ Ingress controller already installed"
fi
echo ""

# Create namespace and MongoDB
echo "Applying namespace and MongoDB resources..."
kubectl apply --context="$CONTEXT" -f k8/local/namespace.yaml
kubectl apply --context="$CONTEXT" -f k8/local/mongodb/
echo "✓ Namespace and MongoDB resources applied"
echo ""

# Deploy backend and frontend
echo "Applying backend, frontend, and ingress resources..."
kubectl apply --context="$CONTEXT" \
    -f k8/local/deployment-jvm.yaml \
    -f k8/local/service-jvm.yaml \
    -f k8/local/deployment-frontend.yaml \
    -f k8/local/service-frontend.yaml \
    -f k8/local/ingress.yaml
echo "✓ Backend, frontend, and ingress resources applied"
echo ""

# Wait for rollouts
echo "Waiting for deployments to become ready..."
kubectl rollout status deployment/mongodb -n "$NAMESPACE" --context="$CONTEXT" --timeout=120s
kubectl rollout status deployment/quote-api-jvm -n "$NAMESPACE" --context="$CONTEXT" --timeout=180s
kubectl rollout status deployment/quote-frontend -n "$NAMESPACE" --context="$CONTEXT" --timeout=120s
echo ""

echo "=========================================="
echo "✓ Setup complete"
echo "=========================================="
echo ""
kubectl get pods -n "$NAMESPACE" --context="$CONTEXT"
echo ""
echo "Frontend: http://localhost/"
echo "API:      http://localhost/api/quotes/random"
