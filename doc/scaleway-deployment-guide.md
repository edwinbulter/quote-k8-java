# Scaleway Deployment Guide

This guide explains how to deploy the quote-k8-java application to Scaleway Kubernetes Kapsule.

## Prerequisites

- Scaleway account with project created
- Custom domain name configured with DNS
- GitHub account with Container Registry access
- kubectl and helm installed locally
- Scaleway CLI (`scw`) configured

## Scaleway CLI Setup

### 1. Install Scaleway CLI

```bash
# On macOS
brew install scw

# On Linux
curl -s https://raw.githubusercontent.com/scaleway/scaleway-cli/master/scripts/install.sh | sh
```

### 2. Configure CLI

```bash
scw init
```

Follow the prompts to:
- Enter your Scaleway access key
- Enter your Scaleway secret key
- Select your default region (e.g., `fr-par`)
- Select your default zone (e.g., `fr-par-1`)

### 3. Enable Autocomplete (Optional)

```bash
# For zsh
echo 'eval "$(scw autocomplete script shell=zsh)"' >> ~/.zshrc
source ~/.zshrc

# For bash
echo 'eval "$(scw autocomplete script shell=bash)"' >> ~/.bashrc
source ~/.bashrc
```

## GitHub Container Registry Setup

### 1. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes:
   - `write:packages` - for pushing images
   - `read:packages` - for pulling images
3. Save the token securely

### 2. Build and Push Backend Image

```bash
cd k8-quote-api
mvn clean package -DskipTests
podman build --platform linux/amd64 -f Containerfile.jvm -t ghcr.io/YOUR_USERNAME/quote-api:latest-jvm .
podman login ghcr.io -u YOUR_USERNAME -p YOUR_TOKEN
podman push ghcr.io/YOUR_USERNAME/quote-api:latest-jvm
```

### 3. Build and Push Frontend Image

The frontend already has a Dockerfile that expects the dist directory to be built locally:

```bash
cd k8-quote-frontend
npm run build
podman build --platform linux/amd64 -t ghcr.io/edwinbulter/quote-frontend:latest .
podman login ghcr.io -u edwinbulter -p YOUR_TOKEN
podman push ghcr.io/edwinbulter/quote-frontend:latest
```

## Scaleway Kapsule Cluster Creation

### 1. Create Kapsule Cluster

The setup script can create a cluster automatically, or you can create it manually:

```bash
# Manual cluster creation
scw k8s cluster create \
  name=quote-k8-java-cluster \
  region=fr-par \
  version=1.35.3 \
  cni=cilium
```

Note the cluster ID from the output.

### 2. Add Node Pool

```bash
# Replace <cluster-id> with your actual cluster ID
scw k8s pool create \
  cluster-id=<cluster-id> \
  name=default-pool \
  node-type=PLAY2-NANO \
  size=1 \
  region=fr-par
```

Available node types include:
- `PLAY2-NANO` - 1 vCPU, 1GB RAM (~€8/month)
- `PLAY2-MICRO` - 1 vCPU, 2GB RAM (~€15/month)
- `DEV1-S` - 2 vCPUs, 4GB RAM (~€30/month)

### 3. Download Kubeconfig

```bash
scw k8s kubeconfig get <cluster-id> region=fr-par > kubeconfig
export KUBECONFIG=$(pwd)/kubeconfig
```

### 4. (Optional) Reserve Flexible IP

For production, reserve a flexible IP to ensure stable DNS:

```bash
# Reserve flexible IP
FLEXIBLE_IP=$(scw ip create region=fr-par -o json | jq -r '.address')

# Attach to your project (if not already)
```

## Deployment

### 1. Set Environment Variables

```bash
export GITHUB_USERNAME="your-github-username"
export GITHUB_TOKEN="your-github-pat-token"
export DOMAIN="your-domain.com"

# Optional: Use reserved flexible IP for stable DNS
export FLEXIBLE_IP="your-flexible-ip"

# Optional: Customize cluster settings
export CLUSTER_NAME="quote-k8-java-cluster"
export REGION="fr-par"
export K8S_VERSION="1.35.3"
export NODE_TYPE="PLAY2-NANO"
export MIN_NODES="1"
export MAX_NODES="1"
```

### 2. Run Setup Script

```bash
./scripts/setup-scaleway.sh
```

The script will:
- Create Kapsule cluster (if it doesn't exist)
- Add node pool (if cluster is new)
- Download kubeconfig
- Create namespace and secrets
- Deploy MongoDB, backend, and frontend
- Install NGINX ingress controller with Scaleway-specific annotations
- Install cert-manager for TLS certificates
- Configure ingress with your custom domain

**Scaleway-specific features**:
- PROXY protocol v2 enabled for real client IP preservation
- Hostname support for cert-manager HTTP01 challenges
- Optional flexible IP support for stable DNS

### 3. Configure DNS

After the script completes, it will display the LoadBalancer IP or hostname. Add a DNS record:

```
Type: A
Name: your-domain.com
Value: <LoadBalancer-IP>
```

If using a flexible IP, point your DNS to that IP instead.

### 4. Verify Deployment

```bash
# Check pods
kubectl get pods -n scaleway-quote-k8

# Check services
kubectl get svc -n scaleway-quote-k8

# Check ingress
kubectl get ingress -n scaleway-quote-k8

# Check certificate
kubectl get certificate -n scaleway-quote-k8

# Test HTTPS access
curl https://your-domain.com
curl https://your-domain.com/api/quotes/random
```

## Teardown

### 1. Run Teardown Script

```bash
./scripts/teardown-scaleway.sh
```

The script will:
- Delete all deployments, services, and ingress
- Delete PVC and secrets
- Delete namespace
- Prompt to delete the Kapsule cluster (required for €0 cost)

### 2. Delete Kapsule Cluster (Optional)

To achieve €0 cost, delete the cluster:

```bash
# Get cluster ID
scw k8s cluster list name=quote-k8-java-cluster region=fr-par

# Delete cluster
scw k8s cluster delete <cluster-id> region=fr-par
```

Or via the Scaleway console:
1. Go to Kubernetes → Kapsule
2. Select your cluster
3. Click Delete

## Cost Breakdown

- **Fully deployed (single PLAY2-NANO node)**: ~€18-20/month
  - Kapsule cluster node: €8/month (PLAY2-NANO)
  - LoadBalancer: ~€10-15/month
  - Storage: ~€0.10-0.20/GB/month (5GB = ~€0.50-1/month)

- **After teardown (without cluster deletion)**: ~€8/month
  - Only Kapsule cluster node remains
  - Control plane is free on Scaleway

- **After teardown (with cluster deletion)**: €0/month
  - All resources deleted

**Node type options**:
- `PLAY2-NANO` (1 vCPU, 1GB RAM): ~€8/month (default)
- `PLAY2-MICRO` (1 vCPU, 2GB RAM): ~€15/month
- `DEV1-S` (2 vCPUs, 4GB RAM): ~€30/month

## Troubleshooting

### Image Pull Errors

If pods fail to pull images:

```bash
# Check secret exists
kubectl get secret ghcr-secret -n scaleway-quote-k8

# Verify secret
kubectl describe secret ghcr-secret -n scaleway-quote-k8

# Recreate secret if needed
kubectl delete secret ghcr-secret -n scaleway-quote-k8
kubectl create secret docker-registry ghcr-secret \
    --docker-server=ghcr.io \
    --docker-username=YOUR_USERNAME \
    --docker-password=YOUR_TOKEN \
    -n scaleway-quote-k8
```

### Certificate Issues

If TLS certificate fails to issue:

```bash
# Check certificate status
kubectl get certificate -n scaleway-quote-k8
kubectl describe certificate quote-tls-secret -n scaleway-quote-k8

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager

# Check ingress
kubectl describe ingress quote-ingress -n scaleway-quote-k8
```

### MongoDB Connection Issues

```bash
# Check MongoDB pod
kubectl get pods -n scaleway-quote-k8 -l app=mongodb
kubectl logs -n scaleway-quote-k8 -l app=mongodb

# Test connection from backend pod
kubectl exec -it <backend-pod> -n scaleway-quote-k8 -- sh
# Inside pod:
# nc -zv mongodb-service 27017
```

### LoadBalancer Issues

If LoadBalancer IP is not assigned:

```bash
# Check LoadBalancer service
kubectl get svc ingress-nginx-controller -n ingress-nginx

# Check Scaleway Load Balancer in console
# Navigate to Network > Load Balancers

# Verify annotations are applied
kubectl describe svc ingress-nginx-controller -n ingress-nginx
```

### Cluster Creation Issues

If cluster creation fails:

```bash
# Check cluster status
scw k8s cluster get <cluster-id> region=fr-par

# Check pool status
scw k8s pool list cluster-id=<cluster-id> region=fr-par

# View cluster events
scw k8s cluster get <cluster-id> region=fr-par -o json | jq '.events'
```

## Quick Re-deployment

After initial setup, you can quickly re-deploy:

```bash
# Set environment variables
export GITHUB_USERNAME="your-github-username"
export GITHUB_TOKEN="your-github-pat-token"
export DOMAIN="your-domain.com"

# Run setup script (will use existing cluster)
./scripts/setup-scaleway.sh
```

Images are already in GHCR, so no rebuild needed unless code changes.

## Additional Resources

- [Scaleway Kapsule Documentation](https://www.scaleway.com/en/docs/kubernetes/kapsule/)
- [Scaleway CLI Documentation](https://github.com/scaleway/scaleway-cli)
- [NGINX Ingress on Scaleway](https://www.scaleway.com/en/docs/kubernetes/reference-content/lb-ingress-controller/)
- [Scaleway Pricing](https://www.scaleway.com/en/pricing/)
