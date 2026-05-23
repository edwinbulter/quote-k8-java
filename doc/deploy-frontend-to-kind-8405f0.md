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
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0-beta.1/deploy/static/provider/kind/deploy.yaml
```
Wait for the ingress controller to be ready:
```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 1. Create Containerfile for Frontend
Create a multi-stage Containerfile in `k8-quote-frontend/`:
- **Stage 1 (Build)**: Use Node.js image to run `npm run build` and create production static files
- **Stage 2 (Serve)**: Use nginx alpine image to serve static files
- Copy built files from stage 1 to nginx html directory
- Configure nginx to handle client-side routing (SPA fallback)
- Expose port 80

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
- This allows both frontend and API to be accessed through the same ingress

### 5. Update Frontend API Configuration
Modify `vite.config.ts` or create production configuration:
- Remove or modify proxy configuration (not needed in production)
- Ensure API calls use relative paths (`/api/*`) which will be routed through ingress to the API service
- Alternatively, set environment variable for API base URL

### 6. Build Docker Image
Run build command in `k8-quote-frontend/`:
```bash
docker build -t quote-frontend:latest .
```

### 7. Load Image into Kind Cluster
```bash
kind load docker-image quote-frontend:latest --name <cluster-name>
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
- If ingress controller is not installed, you'll need to install NGINX Ingress Controller first
- The ingress configuration routes both frontend and API traffic, simplifying the setup
- Frontend will communicate with API via the ingress `/api` path, which internally routes to the API service
