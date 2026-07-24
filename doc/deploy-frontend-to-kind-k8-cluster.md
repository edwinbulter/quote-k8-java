# Deploy Frontend to Kind Cluster with Ingress

This plan deploys the React frontend to the kind Kubernetes cluster using a production build with nginx, internal cluster service communication with the API, and ingress for external access.

## Prerequisites
- Kind cluster
- Docker installed locally
- kubectl configured to use kind cluster

## Implementation Steps

### 0. Install NGINX Ingress Controller in Kind Cluster
Install NGINX Ingress Controller:
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/kind/deploy.yaml
```
Wait for the ingress controller to be ready:
```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 1. Create Containerfile for Frontend
Create a single-stage Dockerfile in `k8-quote-frontend/`:
- Use nginx alpine image to serve static files
- Copy local `dist` directory (built separately) to nginx html directory
- Copy nginx configuration for SPA routing and API proxy
- Expose port 80
- Note: Build is done locally with `npm run build` to avoid Docker build issues with platform-specific dependencies

### 2. Create Kubernetes Deployment Manifest
Create `k8/local/deployment-frontend.yaml`:
- Deployment name: `quote-frontend`
- Namespace: `quote-k8-java`
- Replicas: 1
- Image: `quote-frontend:latest` (with `imagePullPolicy: Never` for kind)
- Container port: 80
- Resource limits similar to API deployment

### 3. Create Kubernetes Service Manifest
Create `k8/local/service-frontend.yaml`:
- Service name: `quote-frontend-service`
- Type: ClusterIP (since ingress will handle external access)
- Selector: app=quote-frontend
- Port: 80, targetPort: 80

### 4. Create Ingress Manifest
Create `k8/local/ingress.yaml`:
- Ingress name: `quote-ingress`
- NGINX ingress class
- Two host/path rules:
  - `/` → quote-frontend-service:80
  - `/api` → quote-api-service:80
- **Important**: Do NOT add `nginx.ingress.kubernetes.io/rewrite-target` annotation, as it will break API routing
- This allows both frontend and API to be accessed through the same ingress

### 5. Update Frontend API Configuration
Modify `src/constants/constants.tsx`:
- Change default BASE_URL from `http://localhost:7071` to `/api`
- This ensures API calls use relative paths that will be routed through ingress to the API service
- The vite dev proxy configuration is not used in production

### 6. Build Frontend and Docker Image
First build the React application locally in `k8-quote-frontend/`:
```bash
npm run build
```
Then build the Docker image:
```bash
docker build -t quote-frontend:latest .
```

### 7. Load Image into Kind Cluster
```bash
kind load docker-image quote-frontend:latest --name multi-node-cluster
```

### 8. Apply Kubernetes Manifests
```bash
kubectl apply -f k8/local/deployment-frontend.yaml
kubectl apply -f k8/local/service-frontend.yaml
kubectl apply -f k8/local/ingress.yaml
```

### 9. Verify Deployment
- Check pods: `kubectl get pods -n quote-k8-java`
- Check ingress: `kubectl get ingress -n quote-k8-java`
- Access frontend via ingress controller URL (typically localhost for kind)

## Notes
- If ingress controller is not installed, you'll need to install NGINX Ingress Controller first (use v1.11.2 for kind)
- The ingress configuration routes both frontend and API traffic, simplifying the setup
- Frontend will communicate with API via the ingress `/api` path, which internally routes to the API service
- Build is done locally with `npm run build` before Docker build to avoid platform-specific dependency issues
- Do not use `nginx.ingress.kubernetes.io/rewrite-target` annotation in ingress, as it breaks API routing
- The nginx.conf in the frontend container proxies `/api` requests to the API service internally
