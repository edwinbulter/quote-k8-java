#!/bin/bash

set -e

# Change to project root directory
cd "$(dirname "$0")/.."

# Configuration
NAMESPACE="quote-k8-java"
CLUSTER_NAME="${CLUSTER_NAME:-quote-k8-java-cluster}"
REGION="${REGION:-fr-par}"
K8S_VERSION="${K8S_VERSION:-1.35.3}"
NODE_TYPE="${NODE_TYPE:-PLAY2-NANO}"
MIN_NODES="${MIN_NODES:-1}"
MAX_NODES="${MAX_NODES:-1}"
GITHUB_USERNAME="${GITHUB_USERNAME:-YOUR_USERNAME}"
GITHUB_TOKEN="${GITHUB_TOKEN:-YOUR_TOKEN}"
DOMAIN="${DOMAIN:-YOUR_DOMAIN.COM}"
EMAIL="${EMAIL:-your-email@example.com}"
FLEXIBLE_IP="${FLEXIBLE_IP:-}"

# Load environment variables from separate script if it exists
if [ -f "scripts/set-scaleway-env.sh" ]; then
    echo "Loading environment variables from scripts/set-scaleway-env.sh"
    source scripts/set-scaleway-env.sh
fi

echo "=========================================="
echo "Scaleway Kapsule Setup Script"
echo "=========================================="
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

echo "✓ Scaleway CLI is configured"
echo ""

# Check if cluster already exists
CLUSTER_ID=$(scw k8s cluster list name="$CLUSTER_NAME" region="$REGION" -o json | jq -r '.[0].id // empty')

if [ -n "$CLUSTER_ID" ]; then
    echo "Cluster '$CLUSTER_NAME' already exists with ID: $CLUSTER_ID"
    read -p "Do you want to use the existing cluster? (yes/no): " use_existing
    if [ "$use_existing" != "yes" ]; then
        echo "Aborting. Please delete the existing cluster first or choose a different name."
        exit 1
    fi
else
    # Create Kapsule cluster
    echo "Creating Kapsule cluster: $CLUSTER_NAME"
    CLUSTER_ID=$(scw k8s cluster create \
        name="$CLUSTER_NAME" \
        region="$REGION" \
        version="$K8S_VERSION" \
        cni=cilium \
        -o json | jq -r '.id')
    echo "✓ Cluster created with ID: $CLUSTER_ID"
    echo ""

    # Add node pool immediately (cluster won't become ready without it)
    echo "Adding node pool..."
    retry_count=0
    max_retries=5
    while [ $retry_count -lt $max_retries ]; do
        if scw k8s pool create \
            cluster-id="$CLUSTER_ID" \
            name=default-pool \
            node-type="$NODE_TYPE" \
            size="$MIN_NODES" \
            region="$REGION" 2>/dev/null; then
            echo "✓ Node pool added"
            break
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                echo "  Cluster still initializing, retrying in 10 seconds... (attempt $retry_count/$max_retries)"
                sleep 10
            else
                echo "ERROR: Failed to add node pool after $max_retries attempts"
                exit 1
            fi
        fi
    done
    echo ""

    # Wait for cluster to be ready
    echo "Waiting for cluster to be ready..."
    while true; do
        STATUS=$(scw k8s cluster get "$CLUSTER_ID" region="$REGION" -o json | jq -r '.status')
        if [ "$STATUS" = "ready" ]; then
            break
        fi
        echo "  Current status: $STATUS (waiting...)"
        sleep 10
    done
    echo "✓ Cluster is ready"
    echo ""
fi

# Download kubeconfig
echo "Downloading kubeconfig..."
scw k8s kubeconfig get "$CLUSTER_ID" region="$REGION" > kubeconfig
export KUBECONFIG=$(pwd)/kubeconfig
echo "✓ Kubeconfig downloaded"
echo ""

# Add Scaleway context to kubectl config
echo "Adding Scaleway context to kubectl config..."
KUBECONFIG=kubeconfig kubectl config current-context > /dev/null 2>&1
if [ $? -eq 0 ]; then
    # Merge the Scaleway kubeconfig with user's default kubeconfig
    KUBECONFIG=kubeconfig:$HOME/.kube/config kubectl config view --flatten > /tmp/merged-kubeconfig
    mv /tmp/merged-kubeconfig $HOME/.kube/config
    echo "✓ Scaleway context added to kubectl config"
    echo ""
    echo "To switch to Scaleway cluster:"
    echo "  kubectl config use-context <scaleway-context-name>"
    echo ""
    echo "To list all contexts:"
    echo "  kubectl config get-contexts"
    echo ""
else
    echo "⚠ Could not merge kubeconfig. Use: export KUBECONFIG=$(pwd)/kubeconfig"
    echo ""
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo "ERROR: kubectl is not configured or cluster is not accessible"
    exit 1
fi

echo "✓ kubectl is configured"
echo ""

# Create namespace
echo "Creating namespace: $NAMESPACE"
kubectl apply -f k8/scaleway/namespace.yaml
echo "✓ Namespace created"
echo ""

# Create secrets
echo "Creating secrets..."
kubectl apply -f k8/scaleway/secret.yaml

# Create GitHub Container Registry secret
kubectl create secret docker-registry ghcr-secret \
    --docker-server=ghcr.io \
    --docker-username="$GITHUB_USERNAME" \
    --docker-password="$GITHUB_TOKEN" \
    -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo "✓ Secrets created"
echo ""

# Create ConfigMap
echo "Creating ConfigMap..."
kubectl apply -f k8/scaleway/configmap.yaml
echo "✓ ConfigMap created"
echo ""

# Deploy MongoDB
echo "Deploying MongoDB..."
kubectl apply -f k8/scaleway/mongodb/pvc.yaml
kubectl apply -f k8/scaleway/mongodb/deployment.yaml
kubectl apply -f k8/scaleway/mongodb/service.yaml
echo "✓ MongoDB deployed"
echo ""

# Deploy backend
echo "Deploying backend..."
sed "s|ghcr.io/YOUR_USERNAME/quote-api:latest-jvm|ghcr.io/$GITHUB_USERNAME/quote-api:latest-jvm|g" \
    k8/scaleway/backend/deployment.yaml | kubectl apply -f -
kubectl apply -f k8/scaleway/backend/service.yaml
echo "✓ Backend deployed"
echo ""

# Deploy frontend
echo "Deploying frontend..."
sed "s|ghcr.io/YOUR_USERNAME/quote-frontend:latest|ghcr.io/$GITHUB_USERNAME/quote-frontend:latest|g" \
    k8/scaleway/frontend/deployment.yaml | kubectl apply -f -
kubectl apply -f k8/scaleway/frontend/service.yaml
echo "✓ Frontend deployed"
echo ""

# Install NGINX ingress controller with Scaleway-specific annotations
echo "Installing NGINX ingress controller..."
if ! helm repo list | grep -q "ingress-nginx"; then
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
fi

# Create ingress values file with Scaleway annotations
cat > /tmp/ingress-values.yaml <<EOF
controller:
  service:
    type: LoadBalancer
    annotations:
      # Enable PROXY protocol v2
      service.beta.kubernetes.io/scw-loadbalancer-proxy-protocol-v2: "true"
      # Use hostname for cert-manager compatibility
      service.beta.kubernetes.io/scw-loadbalancer-use-hostname: "true"
  config:
    # Enable PROXY protocol in NGINX
    use-proxy-protocol: "true"
    use-forwarded-headers: "true"
    compute-full-forwarded-for: "true"
EOF

# Add flexible IP if provided
if [ -n "$FLEXIBLE_IP" ]; then
    echo "Using flexible IP: $FLEXIBLE_IP"
    sed -i.bak "2a\    loadBalancerIP: \"$FLEXIBLE_IP\"" /tmp/ingress-values.yaml
fi

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    -f /tmp/ingress-values.yaml \
    --set controller.resources.requests.memory="128Mi" \
    --set controller.resources.requests.cpu="100m" \
    --set controller.resources.limits.memory="256Mi" \
    --set controller.resources.limits.cpu="500m"
echo "✓ NGINX ingress controller installed"
echo ""

# Install cert-manager
echo "Installing cert-manager..."
if ! helm repo list | grep -q "jetstack"; then
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
fi

helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --version v1.13.0 \
    --set installCRDs=true \
    --set resources.requests.memory="64Mi" \
    --set resources.requests.cpu="50m" \
    --set resources.limits.memory="128Mi" \
    --set resources.limits.cpu="200m"
echo "✓ cert-manager installed"
echo ""

# Create ClusterIssuer for Let's Encrypt
echo "Creating Let's Encrypt ClusterIssuer..."
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $EMAIL
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
echo "✓ ClusterIssuer created"
echo ""

# Update ingress with domain
echo "Configuring ingress with domain: $DOMAIN"
sed "s|YOUR_DOMAIN.COM|$DOMAIN|g" k8/scaleway/ingress/ingress.yaml | kubectl apply -f -
echo "✓ Ingress configured"
echo ""

# Wait for pods to be ready
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=mongodb -n "$NAMESPACE" --timeout=300s
kubectl wait --for=condition=ready pod -l app=quote-api -n "$NAMESPACE" --timeout=300s
kubectl wait --for=condition=ready pod -l app=quote-frontend -n "$NAMESPACE" --timeout=300s
echo "✓ All pods are ready"
echo ""

# Get LoadBalancer IP/Hostname
echo "Getting LoadBalancer address..."
LB_ADDRESS=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$LB_ADDRESS" ]; then
    LB_ADDRESS=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
fi

if [ -z "$LB_ADDRESS" ]; then
    echo "⚠ LoadBalancer address not yet available. Please check with:"
    echo "  kubectl get svc ingress-nginx-controller -n ingress-nginx"
else
    echo "✓ LoadBalancer address: $LB_ADDRESS"
    echo ""
    echo "=========================================="
    echo "IMPORTANT: Route 53 DNS Configuration Required"
    echo "=========================================="
    echo "Update your Route 53 A record for $DOMAIN:"
    echo "  Type: A"
    echo "  Name: $DOMAIN"
    echo "  Value: $LB_ADDRESS"
    echo ""
    echo "NOTE: If you redeploy the cluster later, the LoadBalancer IP may change."
    echo "You will need to update this Route 53 record with the new IP address."
    echo "To avoid this, consider using a Scaleway Flexible IP (see documentation)."
    echo ""
    echo "After updating DNS, run:"
    echo "  kubectl get ingress -n $NAMESPACE"
    echo "  kubectl get certificate -n $NAMESPACE"
    echo ""
fi

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Cluster ID: $CLUSTER_ID"
echo "Cluster Name: $CLUSTER_NAME"
echo ""
echo "To check status:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl get svc -n $NAMESPACE"
echo "  kubectl get ingress -n $NAMESPACE"
echo ""
echo "To view logs:"
echo "  kubectl logs -l app=quote-api -n $NAMESPACE -f"
echo "  kubectl logs -l app=quote-frontend -n $NAMESPACE -f"
echo ""
echo "To delete the cluster later:"
echo "  scw k8s cluster delete $CLUSTER_ID region=$REGION"
echo ""
