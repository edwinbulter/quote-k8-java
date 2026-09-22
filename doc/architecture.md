# Architecture

A reference for how `quote-k8-java` is built today: what each component does, how they talk to each other, the data model, and how the same system is deployed across two different environments. For step-by-step setup/deploy instructions, see [`local-kind-setup.md`](local-kind-setup.md) and [`scaleway-deployment-guide.md`](scaleway-deployment-guide.md).

## Components

```mermaid
flowchart TD
    Browser["Browser"] --> Ingress["ingress-nginx"]
    Ingress -->|"/"| Frontend["quote-frontend<br/>React + nginx<br/>static SPA"]
    Ingress -->|"/api"| Backend["quote-api (Quarkus)<br/>Java 17 — JVM or native (GraalVM)"]
    Backend -->|"mongodb://"| Mongo["MongoDB<br/>(plain Deployment or Operator CRD)"]
```

- **`quote-frontend/`** — React + TypeScript SPA (Vite build), served as static files by nginx in production. `nginx.conf` proxies `/api/*` to `quote-api-service` internally so the SPA and API appear same-origin to the browser. In dev, `vite.config.ts` proxies `/api` to `http://localhost:8080` instead.
- **`quote-api/`** — Quarkus (Java 17) REST API. Talks to MongoDB via `quarkus-mongodb-panache`, issues/verifies JWTs via `quarkus-smallrye-jwt`, exposes health checks via `quarkus-smallrye-health`. Built either as a JVM image (`Containerfile.jvm`) or a native GraalVM image (`Containerfile.native`) — see "Build variants" below.
- **MongoDB** — single instance holding all application data. No caching layer, no message queue, no other backing services.
- **ingress-nginx** — routes `/` to the frontend Service and `/api` to the backend Service; not part of the application, installed once per cluster.

## Request flow

1. Browser loads the SPA from `quote-frontend-service` (via Ingress or, for Scaleway, TLS-terminated at the Ingress).
2. SPA calls `/api/...` (relative path — see `quote-frontend/src/constants/constants.tsx`, `BASE_URL` defaults to `/api`). These requests hit the same Ingress, which routes `/api` to `quote-api-service`.
3. The backend authenticates requests carrying `Authorization: Bearer <jwt>` and reads/writes MongoDB via the `mongodb-service` ClusterIP DNS name (`mongodb://quote-user:...@mongodb-service:27017/quote-db?authSource=admin`) — the same connection string works in every environment because the Service name never changes, only what backs it does.

## Data model (MongoDB collections)

| Collection | Model | Purpose |
|---|---|---|
| `quotes` | `Quote` | `quoteId` (sequential), `quoteText`, `author`, `likeCount`, `createdAt`, `source`. Backfilled from the [ZenQuotes API](https://zenquotes.io) on demand when the collection is running low (`QuoteService`/`ZenQuotesService`). |
| `users` | `User` | `username`, `email`, `passwordHash` (salted SHA-256, see `PasswordUtil`), `isActive`. |
| `user_roles` | `UserRole` | `username` → `role` (`ADMIN` or `USER`); a user can hold more than one role row. |
| `userlikes` | `UserLike` | Per-user liked quotes with an `order` field for user-defined reordering. |
| `userprogress` | `UserProgress` | Tracks `lastQuoteId` per user, used to resume where a user left off. |

## API surface

All routes are under `/api`. Auth style: `@Authenticated` (any valid JWT) or `@RolesAllowed("ADMIN")` (JWT with `groups: ["ADMIN"]`); unmarked routes are public.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/quotes/random` | public | Random quote; fetches more from ZenQuotes if the DB is low. |
| GET | `/quotes/{id}` | public | Single quote by `quoteId`. |
| POST | `/quote` | public | Random quote excluding a given list of IDs. |
| POST | `/auth/register` | public | Create a user (default role `USER`). |
| POST | `/auth/login` | public | Verify credentials (`loginIdentifier` = username or email), return a signed JWT. |
| POST | `/seed-users` | public | Dev/test helper — seeds `admin`/`user-1` if they don't already exist. See "Security considerations" below. |
| GET | `/quote` | authenticated | Alias of `/quotes/random` for logged-in users. |
| GET | `/quote/viewed` | authenticated | Caller's view history. |
| GET | `/quote/progress` | authenticated | Caller's `lastQuoteId`. |
| POST | `/quote/{quoteId}/like` | authenticated | Like a quote. |
| DELETE | `/quote/{quoteId}/unlike` | authenticated | Unlike a quote. |
| GET | `/quote/liked` | authenticated | Caller's liked quotes. |
| PUT | `/quote/{quoteId}/reorder` | authenticated | Reorder a liked quote. |
| POST | `/auth/change-password` | authenticated | Change the caller's own password. |
| DELETE | `/auth/unregister` | authenticated | Delete the caller's own account and all owned data. |
| GET | `/manage/users` | ADMIN | List all users with roles/status. |
| PUT | `/manage/users/role` | ADMIN | Grant a role to a user. |
| DELETE | `/manage/users/role` | ADMIN | Revoke a role from a user. |
| DELETE | `/manage/users/account` | ADMIN | Delete another user's account (not your own). |
| GET | `/manage/quotes` | ADMIN | List/browse quotes. |
| POST | `/manage/quotes/fetch` | ADMIN | Force-fetch more quotes from ZenQuotes. |
| GET | `/manage/stats` | ADMIN | Aggregate stats (quote/user counts, etc). |

## Auth flow

1. `POST /api/auth/login` verifies the password hash and, on success, builds a JWT (`JwtService`) with claims `sub` (user ObjectId), `upn`/`email`, `username`, and `groups` (the user's role, e.g. `["ADMIN"]`), signed HS256 with the key in `sign-key.jwk`.
2. The frontend attaches `Authorization: Bearer <token>` to subsequent requests.
3. `quarkus-smallrye-jwt` validates the signature/issuer/audience (`mp.jwt.verify.issuer` / `mp.jwt.verify.audience` in `application.properties`) and exposes claims via `JsonWebToken`; `@Authenticated` and `@RolesAllowed("ADMIN")` enforce access at the resource-method level based on the `groups` claim.
4. **The signing key itself is never committed to git** and must be generated once per environment — see [`smallrye-sign-key.md`](smallrye-sign-key.md).

## Build variants

Two backend build targets exist for different deployment shapes:

- **JVM** (`Containerfile.jvm`) — fast to build, used for local/kind development where iteration speed matters more than image size or cold-start time.
- **Native** (`Containerfile.native`, GraalVM) — small image, near-instant cold start, used for cloud deployments where resource efficiency matters (`k8s/cloud/deployment-native.yaml`).

The frontend has one build path: `npm run build` (Vite) → static files served by nginx (`quote-frontend/Dockerfile`); it's identical across environments.

## Deployment topologies

The same components are assembled two different ways today, driven entirely by which `k8s/` manifests are applied — application code doesn't change.

| | Quick kind setup | Scaleway |
|---|---|---|
| Doc | `local-kind-setup.md` | `scaleway-deployment-guide.md` |
| Manifests | `k8s/local/` (+ `k8s/local/mongodb/`) | `k8s/scaleway/` |
| Namespace | `quote-k8-java` | `scaleway-quote-k8` |
| Backend image | JVM, local-only, `imagePullPolicy: Never` | JVM, pulled from `ghcr.io` |
| MongoDB | plain `mongo:7.0` Deployment + PVC | plain `mongo:7.0` Deployment + PVC |
| Ingress/TLS | plain nginx Ingress, no TLS | nginx Ingress + cert-manager + Let's Encrypt |
| Driven by | `scripts/setup-kind.sh` / `teardown-kind.sh` | `scripts/setup-scaleway.sh` / `teardown-scaleway.sh` |

Both use a plain MongoDB Deployment rather than the MongoDB Community Operator — no Helm/CRD bootstrap needed, which is the right tradeoff for a single, non-HA instance. An earlier setup path used the MongoDB Community Operator (`MongoDBCommunity` CRD, Helm-installed) instead; those manifests (`k8s/base/`, `k8s/mongodb/`) have since been removed as unused. Revisit that approach if a real multi-member replica set is ever needed locally.

## Security considerations

- `POST /api/seed-users` is unauthenticated and creates hardcoded accounts (`admin`/`Admin123!`, `user-1`/`Hello-user-1`). It's a dev/test convenience, not gated behind an environment check — don't expose it on a production deployment without addressing this (see "Security Considerations" in `doc/migration/01-seed-users-implementation.md`).
- MongoDB credentials (`quote-user` / `ChangeThisPassword123!`) are hardcoded placeholders shared across every environment's ConfigMap/Secret — fine for local/dev, should be rotated per-environment for anything production-facing.
- The JWT signing key must be unique per environment; see [`smallrye-sign-key.md`](smallrye-sign-key.md).
