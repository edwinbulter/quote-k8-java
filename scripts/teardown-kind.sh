#!/bin/bash

set -e

CLUSTER_NAME="single-node"
CONTEXT="kind-${CLUSTER_NAME}"
NAMESPACE="quote-k8-java"

echo "=========================================="
echo "Removing quote-k8-java from kind cluster '${CLUSTER_NAME}'"
echo "=========================================="
echo ""

if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    echo "ERROR: kind cluster '$CLUSTER_NAME' not found"
    exit 1
fi

echo "Deleting namespace '$NAMESPACE' (this removes all deployments, services, ingress, secrets, and PVCs in it)..."
kubectl delete namespace "$NAMESPACE" --context="$CONTEXT" --ignore-not-found=true --wait=true

echo ""
echo "✓ Teardown complete (ingress-nginx controller was left in place)"
