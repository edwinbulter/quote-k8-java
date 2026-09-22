# Local Setup: kind Cluster `single-node`

Quick day-to-day workflow for building the app and running it in the local `single-node` kind cluster (context `kind-single-node`).

This is different from `doc/k8-project-setup-guide.md`, which is a detailed walkthrough of building the project from scratch and uses the MongoDB Community Operator. This guide uses a plain `mongo:7.0` Deployment instead (no Helm/operator bootstrap needed) and two scripts that install or remove everything in one command — meant for quickly spinning the app up and tearing it down while iterating locally.

## Prerequisites

- Docker
- A kind cluster named `single-node` already running, with kubectl context `kind-single-node`
- kubectl
- Java 17+ and the Maven wrapper (`k8-quote-api/mvnw`)
- Node.js and npm

Verify the cluster is up:

```bash
kind get clusters
kubectl config get-contexts kind-single-node
```

## Step 1: Create the JWT signing key

The backend won't start without `k8-quote-api/src/main/resources/sign-key.jwk` (see `doc/smallrye-sign-key.md`). It's gitignored and must be created once per checkout, **before** building the backend image:

```bash
KEY=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
cat > k8-quote-api/src/main/resources/sign-key.jwk <<EOF
{"keys":[{"kty":"oct","kid":"quote-k8-key","k":"$KEY"}]}
EOF
```

Skip this if the file already exists.

## Step 2: Build the Docker images

### Backend

```bash
cd k8-quote-api
./mvnw clean package -DskipTests
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
kind load docker-image quote-api:latest-jvm --name single-node
cd ..
```

### Frontend

```bash
cd k8-quote-frontend
npm install
npm run build
docker build -t quote-frontend:latest .
kind load docker-image quote-frontend:latest --name single-node
cd ..
```

No `--platform` flag is needed — the kind node runs on the same architecture as the host.

## Step 3: Install all k8s resources

```bash
./scripts/setup-kind.sh
```

This script:
- Verifies the `single-node` kind cluster exists
- Installs the NGINX ingress controller if it isn't already present
- Applies the `quote-k8-java` namespace, MongoDB (Deployment + PVC + Service + Secret), and the backend/frontend Deployments, Services, and Ingress (`k8/local/`)
- Waits for all three Deployments to become ready

Check progress at any time with:

```bash
kubectl get pods -n quote-k8-java --context=kind-single-node
```

## Step 4: Try it out

```bash
curl http://localhost/api/quotes/random
```

Or open `http://localhost/` in a browser. Port 80 on the kind node is already mapped to `localhost` on the host, so no port-forwarding is needed.

## Step 5: Remove everything

```bash
./scripts/teardown-kind.sh
```

This deletes the `quote-k8-java` namespace, which cascades to every Deployment, Service, Ingress, Secret, and PVC created in Step 3. It does **not** delete the kind cluster itself or the shared ingress-nginx controller — rerun Step 3 any time to reinstall.

## Troubleshooting

```bash
# Pod status
kubectl get pods -n quote-k8-java --context=kind-single-node

# Logs
kubectl logs -l app=quote-api -n quote-k8-java --context=kind-single-node -f
kubectl logs -l app=mongodb -n quote-k8-java --context=kind-single-node -f

# Pod events
kubectl describe pod <pod-name> -n quote-k8-java --context=kind-single-node
```

If a pod is stuck in `ImagePullBackOff` for `quote-api:latest-jvm` or `quote-frontend:latest`, the image wasn't loaded into the cluster — redo Step 2's `kind load docker-image` commands.
