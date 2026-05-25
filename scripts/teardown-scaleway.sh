#!/bin/bash

set -e

# Configuration
NAMESPACE="quote-k8-java"
CLUSTER_NAME="${CLUSTER_NAME:-quote-k8-java-cluster}"
REGION="${REGION:-fr-par}"
KUBECONFIG_FILE="$(dirname "$0")/../kubeconfig"
export KUBECONFIG="$KUBECONFIG_FILE"

echo "=========================================="
echo "Scaleway Kapsule Teardown Script"
echo "=========================================="
echo ""

# Check if Scaleway kubeconfig exists
if [ ! -f "$KUBECONFIG_FILE" ]; then
    echo "ERROR: Scaleway kubeconfig not found at $KUBECONFIG_FILE"
    echo "Please run the setup script first to download the kubeconfig"
    exit 1
fi

# Check if kubectl is configured with Scaleway cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "ERROR: kubectl is not configured or Scaleway cluster is not accessible"
    echo "KUBECONFIG: $KUBECONFIG_FILE"
    exit 1
fi

# Verify we're connected to the correct cluster
CURRENT_CONTEXT=$(kubectl config current-context)
echo "Using kubectl context: $CURRENT_CONTEXT"
echo "KUBECONFIG: $KUBECONFIG_FILE"
echo ""

echo "This script will delete all resources in namespace: $NAMESPACE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Teardown cancelled"
    exit 0
fi

echo ""
echo "Deleting ingress..."
kubectl delete -f k8/scaleway/ingress/ingress.yaml --ignore-not-found=true
echo "✓ Ingress deleted"
echo ""

echo "Deleting deployments and services..."
kubectl delete deployment quote-api -n "$NAMESPACE" --ignore-not-found=true
kubectl delete service quote-api-service -n "$NAMESPACE" --ignore-not-found=true
kubectl delete deployment quote-frontend -n "$NAMESPACE" --ignore-not-found=true
kubectl delete service quote-frontend-service -n "$NAMESPACE" --ignore-not-found=true
echo "✓ Deployments and services deleted"
echo ""

echo "Deleting MongoDB..."
kubectl delete deployment mongodb -n "$NAMESPACE" --ignore-not-found=true
kubectl delete service mongodb-service -n "$NAMESPACE" --ignore-not-found=true
kubectl delete pvc mongodb-pvc -n "$NAMESPACE" --ignore-not-found=true
echo "✓ MongoDB deleted"
echo ""

echo "Deleting secrets..."
kubectl delete secret mongodb-password -n "$NAMESPACE" --ignore-not-found=true
kubectl delete secret ghcr-secret -n "$NAMESPACE" --ignore-not-found=true
echo "✓ Secrets deleted"
echo ""

echo "Deleting namespace..."
kubectl delete namespace "$NAMESPACE" --ignore-not-found=true
echo "✓ Namespace deleted"
echo ""

echo "=========================================="
echo "Teardown Complete!"
echo "=========================================="
echo ""
echo "Current cost state: ~€15-30/month (Kapsule cluster nodes still running)"
echo ""
echo "To achieve €0 cost, you must delete the Kapsule cluster."
echo "This can be done via the Scaleway CLI or console."
echo ""
read -p "Do you want to delete the Kapsule cluster now? (yes/no): " delete_cluster

if [ "$delete_cluster" = "yes" ]; then
    echo ""
    
    # Check if scw CLI is configured
    if ! command -v scw &> /dev/null; then
        echo "ERROR: Scaleway CLI (scw) is not installed"
        echo "Please install it from: https://github.com/scaleway/scaleway-cli"
        exit 1
    fi

    if ! scw info &> /dev/null; then
        echo "ERROR: Scaleway CLI is not configured"
        echo "Please run: scw init"
        exit 1
    fi

    # Get cluster ID
    CLUSTER_ID=$(scw k8s cluster list name="$CLUSTER_NAME" region="$REGION" -o json | jq -r '.[0].id // empty')
    
    if [ -z "$CLUSTER_ID" ]; then
        echo "ERROR: Cluster '$CLUSTER_NAME' not found in region '$REGION'"
        exit 1
    fi

    echo "Deleting cluster: $CLUSTER_NAME (ID: $CLUSTER_ID)"
    scw k8s cluster delete "$CLUSTER_ID" region="$REGION"
    echo "✓ Cluster deleted"
    echo ""
    
    # Wait for cluster to be fully deleted
    echo "Waiting for cluster to be fully deleted..."
    while scw k8s cluster get "$CLUSTER_ID" region="$REGION" &> /dev/null; do
        echo "  Cluster still deleting..."
        sleep 5
    done
    echo "✓ Cluster fully deleted"
    echo ""
    
    # Delete Load Balancers
    echo "Deleting Load Balancers..."
    ZONE="${REGION}-1"
    LB_IDS=$(scw lb lb list zone="$ZONE" -o json | jq -r '.[].id // empty')
    if [ -n "$LB_IDS" ]; then
        for LB_ID in $LB_IDS; do
            echo "  Deleting Load Balancer: $LB_ID"
            scw lb lb delete "$LB_ID" zone="$ZONE" release-ip=true &> /dev/null || true
        done
        echo "✓ Load Balancers deleted"
    else
        echo "  No Load Balancers found"
    fi
    echo ""
    
    # Delete IPAM IPs
    echo "Deleting IPAM IPs..."
    IP_IDS=$(scw ipam ip list region="$REGION" -o json | jq -r '.[].id // empty')
    if [ -n "$IP_IDS" ]; then
        for IP_ID in $IP_IDS; do
            echo "  Deleting IP: $IP_ID"
            scw ipam ip delete "$IP_ID" region="$REGION" &> /dev/null || true
        done
        echo "✓ IPAM IPs deleted"
    else
        echo "  No IPAM IPs found"
    fi
    echo ""
    
    # Delete Private Networks
    echo "Deleting Private Networks..."
    PN_IDS=$(scw vpc private-network list region="$REGION" -o json | jq -r '.[].id // empty')
    if [ -n "$PN_IDS" ]; then
        for PN_ID in $PN_IDS; do
            echo "  Deleting Private Network: $PN_ID"
            scw vpc private-network delete "$PN_ID" region="$REGION" &> /dev/null || true
        done
        echo "✓ Private Networks deleted"
    else
        echo "  No Private Networks found"
    fi
    echo ""
    
    # Delete VPCs
    echo "Deleting VPCs..."
    VPC_IDS=$(scw vpc vpc list region="$REGION" -o json | jq -r '.[].id // empty')
    if [ -n "$VPC_IDS" ]; then
        for VPC_ID in $VPC_IDS; do
            echo "  Deleting VPC: $VPC_ID"
            scw vpc vpc delete "$VPC_ID" region="$REGION" &> /dev/null || true
        done
        echo "✓ VPCs deleted"
    else
        echo "  No VPCs found"
    fi
    echo ""
    
    echo "After cluster deletion, costs will be €0/month"
else
    echo ""
    echo "Kapsule cluster remains active. Costs: ~€15-30/month"
    echo "To delete the cluster later, run this script again or use Scaleway console/CLI:"
    echo "  scw k8s cluster delete <cluster-id> region=$REGION"
fi

echo ""
