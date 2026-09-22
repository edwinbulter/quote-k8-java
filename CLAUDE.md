# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`quote-k8-java` is a cloud-agnostic Kubernetes quote application: a Quarkus (Java 17) REST API + MongoDB backend, and a React/TypeScript SPA frontend. It's a from-scratch Java/Quarkus port of the backend logic from the original C#-based [quote-azure-k8](https://github.com/edwinbulter/quote-azure-k8) project, redesigned to avoid Azure-specific services and deploy to a local kind cluster or Scaleway.

For the full architecture (components, data model, API surface, auth flow, deployment topologies) see **`doc/architecture.md`** — read it before making non-trivial changes, since it's the authoritative reference and this file intentionally doesn't duplicate it.

## Commands

### Backend (`quote-api/`)

```bash
./mvnw quarkus:dev          # dev mode with live reload, port 8080
./mvnw clean package -DskipTests   # build the JVM jar (target/quarkus-app/)
./mvnw clean package -DskipTests -Dnative   # build native executable (requires GraalVM, or use Containerfile.native's multi-stage build)
./mvnw test                 # run tests (none currently exist in this module)
```

`quarkus:dev` needs a local MongoDB reachable at `mongodb://localhost:27017/quote-db` (no auth) — see the `%dev.quarkus.mongodb.connection-string` override in `application.properties`. Dev Services auto-start is not in play here since that connection string is explicitly set.

Docker image build (what's actually used — see "Gotchas" below):
```bash
docker build -f Containerfile.jvm -t quote-api:latest-jvm .
```

### Frontend (`quote-frontend/`)

```bash
npm run dev              # Vite dev server on :5173, proxies /api to localhost:8080
npm run build             # tsc -b && vite build
npm run lint               # eslint .
npm run test               # vitest
npm run test:coverage      # vitest --coverage
```

To run a single test file: `npx vitest run src/App.test.tsx`.

### Local kind deployment

Full walkthrough in `doc/local-kind-setup.md`; the short version, from repo root:

```bash
# one-time: generate the JWT signing key (must exist before packaging the backend)
KEY=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
cat > quote-api/src/main/resources/sign-key.jwk <<EOF
{"keys":[{"kty":"oct","kid":"quote-k8-key","k":"$KEY"}]}
EOF

# build + load both images into the kind cluster named "single-node"
(cd quote-api && ./mvnw clean package -DskipTests && docker build -f Containerfile.jvm -t quote-api:latest-jvm . && kind load docker-image quote-api:latest-jvm --name single-node)
(cd quote-frontend && npm run build && docker build -t quote-frontend:latest . && kind load docker-image quote-frontend:latest --name single-node)

./scripts/setup-kind.sh      # installs everything into the quote-k8-java namespace, seeds admin/user-1
./scripts/teardown-kind.sh   # removes the quote-k8-java namespace (cluster + ingress-nginx controller untouched)
```

Check status with `kubectl get pods -n quote-k8-java --context=kind-single-node`. The app is then reachable at `http://localhost/`.

Scaleway deployment is driven by `scripts/setup-scaleway.sh` / `scripts/teardown-scaleway.sh` — see `doc/scaleway-deployment-guide.md`.

## Gotchas

- **`quote-api/Containerfile.jvm` and `quote-api/Containerfile.native`** (at the module root) are what's actually built and deployed. The Quarkus-generated `quote-api/src/main/docker/Dockerfile.*` files are unused leftovers from `quarkus create` — don't build from those.
- **`quote-api/src/main/resources/sign-key.jwk`** is gitignored and must be generated per-checkout before `mvn package` (it's packaged into the jar at build time, not mounted at runtime for the kind/Scaleway topologies). See `doc/smallrye-sign-key.md`.
- **No backend unit tests currently exist** despite `maven-surefire-plugin`/`maven-failsafe-plugin` being configured in `pom.xml`.
- **`POST /api/seed-users`** is an unauthenticated dev-only endpoint that seeds `admin`/`Admin123!` and `user-1`/`Hello-user-1`. `scripts/setup-kind.sh` calls it automatically; it's not gated behind an environment check, so don't expose it on anything production-facing without addressing that first.
- The local kind cluster is named `single-node` (kubectl context `kind-single-node`) — not `multi-node-cluster`, which was retired.
