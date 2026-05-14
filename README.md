# Medico-Legal Pro

Production platform for medico-legal case intake, expert appointments, attorney
billing, and report management. Built with **React + Vite + TypeScript** on the
frontend and **Supabase** (Postgres + RLS + Edge Functions) on the backend.

- Preview: <https://id-preview--d782484e-4dde-4502-9b59-ffe68f3de0a7.lovable.app>
- Production: <https://kamedico-legal.co.za>
- Lovable project: <https://lovable.dev/projects/d782484e-4dde-4502-9b59-ffe68f3de0a7>

---

## Table of contents

1. [Tech stack](#tech-stack)
2. [Local development](#local-development)
3. [Project structure](#project-structure)
4. [Containerized & cloud deployment](#containerized--cloud-deployment)
5. [Health checks](#health-checks)
6. [Edge function API](#edge-function-api)
7. [Error handling contract](#error-handling-contract)
8. [Security & compliance](#security--compliance)
9. [Testing](#testing)

---

## Tech stack

| Layer        | Technology                                                  |
|--------------|-------------------------------------------------------------|
| Frontend     | React 18, Vite 5, TypeScript 5, Tailwind CSS, shadcn/ui     |
| State / data | TanStack Query, Supabase JS client, typed query helpers     |
| Backend      | Supabase Postgres (RLS), Supabase Edge Functions (Deno)     |
| Email        | Resend (`supabase/functions/_shared/email.ts`)              |
| AI           | Lovable AI Gateway (Gemini / GPT) for proofreading + intake |
| Container    | Docker (`oven/bun` build → `nginx:alpine` runtime)          |
| Orchestrate  | Kubernetes manifests + Cloud Run / Fly.io / Render configs  |

Node.js LTS is required for local development (≥ 20).

## Local development

```sh
# Install dependencies
npm i        # or: bun install

# Start the dev server (Vite, hot reload)
npm run dev

# Type-check + production build
npm run build

# Lint
npm run lint

# Unit tests (vitest)
npx vitest run
```

The app reads Supabase config from `.env` (publishable anon key only — service
role keys live in Supabase Edge Function secrets).

## Project structure

```
src/
  components/        Reusable UI (shadcn-derived)
  contexts/          App-level providers (sync, auth)
  hooks/             Data + permission hooks (TanStack Query)
  pages/             Route components (admin, attorney-portal, expert-portal)
  utils/             Pure helpers (dates, IDs, PDF branding, typed Supabase)
  integrations/      Supabase client
supabase/
  functions/         Edge functions (Deno) — see API below
  functions/_shared/ Shared CORS, errors, email helpers
docs/
  openapi.yaml       OpenAPI 3.1 spec for every edge function
k8s/                 Kubernetes Deployment + Service + Ingress + HPA
deploy/              Cloud Run service manifest
fly.toml             Fly.io config
render.yaml          Render.com config
Dockerfile           Multi-stage container build
nginx.conf           SPA routing + healthz + cache headers
```

## Containerized & cloud deployment

Build and run the frontend anywhere:

```sh
# Local
docker compose up --build           # http://localhost:8080

# Image
docker build -t medico-legal:latest .
docker run --rm -p 8080:8080 medico-legal:latest

# Kubernetes
kubectl apply -f k8s/deployment.yaml

# Google Cloud Run
gcloud run services replace deploy/cloud-run.yaml

# Fly.io
fly deploy

# Render
# Connect repo → Render reads render.yaml automatically
```

The container runs nginx as a non-root user on port `8080` and serves the Vite
build (`dist/`) with SPA fallback, gzip, and security headers.

## Health checks

Two-tier health model:

| Endpoint    | Purpose                                  | Latency |
|-------------|------------------------------------------|---------|
| `/healthz`  | Static nginx 200 — orchestrator probes   | <1ms    |
| `/health`   | React page that pings Supabase Auth + DB | ~50–300ms |

`/health?format=json` returns a machine-readable JSON payload for uptime
monitors:

```json
{
  "status": "ok",
  "checks": {
    "auth":     { "status": "ok", "latencyMs": 42 },
    "database": { "status": "ok", "latencyMs": 87 }
  }
}
```

Kubernetes probes (`startupProbe`, `livenessProbe`, `readinessProbe`) all hit
`/healthz`; deeper monitoring (Pingdom, Better Stack, etc.) should poll
`/health?format=json`.

## Edge function API

The full OpenAPI 3.1 spec lives at [`docs/openapi.yaml`](docs/openapi.yaml).

Render it interactively with any Swagger UI:

```sh
# Standalone preview
docker run --rm -p 8081:8080 \
  -e SWAGGER_JSON=/spec/openapi.yaml \
  -v "$PWD/docs:/spec" \
  swaggerapi/swagger-ui
# → http://localhost:8081
```

All endpoints share the same base URL:

```
https://<project-ref>.supabase.co/functions/v1
```

### Function categories

| Category                | Functions                                                                                                                                                  |
|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Auth & users**        | `create-user`, `delete-user`, `user-management`, `resend-user-confirmation`, `initialize-user-permissions`, `login-notification`                            |
| **Appointments**        | `submit-appointment-request`, `sync-appointment-requests`, `notify-new-appointment-request`, `restore-deleted-appointment`, `generate-appointment-report`  |
| **Attorney portal**     | `validate-access-code`, `attorney-directory-search`, `get-attorney-documents`, `get-appointment-reports`                                                   |
| **Expert portal**       | `validate-expert-access-code`, `upsert-expert-report`, `send-expert-statement`, `send-performance-warning`                                                  |
| **AOD & agreements**    | `auto-generate-aod`, `generate-aod-pdf`, `send-aod-email`, `generate-short-term-agreement-pdf`, `send-short-term-agreement-email`                          |
| **Email & comms**       | `send-queued-email`, `auto-send-queued-email`, `auto-send-grouped-confirmation`, `send-appointment-confirmation`, `send-appointment-update-email`, `send-appointment-request`, `send-48hr-reminders`, `send-report-email`, `send-notification`, `test-email-delivery`, `test-48hr-reminder-pdf` |
| **AI / OCR / search**   | `analyze-medical-negligence`, `proofread-document`, `screen-case-intake`, `google-search`                                                                  |
| **Notifications**       | `notify-attorney-assessment-change`, `notify-attorney-payment-change`                                                                                      |
| **Maintenance**         | `cleanup-proofreading-history`, `archive-assessment-data`                                                                                                  |
| **Webhooks**            | `webhook-receiver`, `webhook-trigger`                                                                                                                      |

Each route is documented inline in its `index.ts` and formally in
`docs/openapi.yaml` (request body, response schema, status codes, auth).

## Error handling contract

Every edge function is wrapped with `withErrorHandler` from
`supabase/functions/_shared/errors.ts`. This guarantees:

- **Consistent JSON envelope** on errors:
  ```json
  {
    "success": false,
    "error": {
      "code": "NOT_FOUND",
      "message": "Access code not found",
      "requestId": "req_01HF…"
    }
  }
  ```
- **Standard HTTP status codes:** 400 / 401 / 403 / 404 / 405 / 409 / 413 / 422 / 429 / 500 / 502
- **CORS preflight** handled uniformly (`OPTIONS` → 204).
- **`X-Request-Id`** header on every response for log correlation.

Throw typed errors inside handlers to produce the right status:

```ts
import { NotFound, ValidationError, Forbidden } from "../_shared/errors.ts";
throw NotFound("Appointment not found");
throw ValidationError("Invalid email", { field: "email" });
throw Forbidden("Access code is no longer active");
```

The frontend additionally wraps the React tree in `GlobalErrorBoundary`
(`src/components/GlobalErrorBoundary.tsx`) which surfaces uncaught render
errors with a recovery UI.

## Security & compliance

- **POPIA compliance** — claimant views are written to `audit_logs`.
- **Row-Level Security** on every table; admin checks use the `has_role(uid, role)`
  security-definer RPC (never client-side flags).
- **Service-role keys** only exist in Edge Function secrets, never in the
  client bundle.
- **Roles** stored in a separate `user_roles` table (see the User Roles
  pattern in `supabase/migrations`).
- **Audit trail** — see `src/pages/AuditTrail.tsx` and
  `mem://infrastructure/audit-trail-and-user-deletion`.
- See `SECURITY_REVIEW.md` for the latest formal review.

## Testing

```sh
npx vitest run                         # all tests
npx vitest run src/hooks/__tests__/    # one folder
```

Test setup lives in `src/test/setup.ts`. Edge functions can be invoked locally
with `supabase functions serve <name>` and tested via `curl` or the bundled
`supabase--test_edge_functions` tool.

## Continuous integration & deployment

GitHub Actions pipeline at [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
runs on every push and PR to `main`:

| Job                      | Trigger      | What it does                                                |
|--------------------------|--------------|-------------------------------------------------------------|
| `lint`                   | push / PR    | `bun run lint` (ESLint)                                     |
| `test`                   | push / PR    | `bun run test:coverage` — fails below 80% coverage gate     |
| `openapi-sync`           | push / PR    | Verifies `docs/openapi.yaml` matches edge function routes   |
| `build`                  | push / PR    | `vite build`, uploads `dist/` artifact                      |
| `deploy-edge-functions`  | push to main | Deploys every `supabase/functions/*` via Supabase CLI       |
| `deploy-container`       | push to main | Builds & pushes Docker image to `ghcr.io/<repo>:latest`     |

OpenAPI drift has its own dedicated workflow at
[`.github/workflows/openapi-sync.yml`](.github/workflows/openapi-sync.yml).

### Required GitHub secrets

Configure in **Repo → Settings → Secrets → Actions**:

| Secret                          | Used by                      | Purpose                                  |
|---------------------------------|------------------------------|------------------------------------------|
| `VITE_SUPABASE_URL`             | `build`, `deploy-container`  | Vite build-time env                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `build`, `deploy-container`  | Vite build-time env (anon key)           |
| `VITE_SUPABASE_PROJECT_ID`      | `build`, `deploy-container`  | Vite build-time env                      |
| `SUPABASE_ACCESS_TOKEN`         | `deploy-edge-functions`      | `supabase` CLI login (personal token)    |
| `SUPABASE_PROJECT_ID`           | `deploy-edge-functions`      | Target project ref for function deploy   |

If `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_ID` are missing, the
edge-function deploy step skips cleanly instead of failing — useful while
secrets are still being provisioned.

The container deploy publishes to **GitHub Container Registry** using the
built-in `GITHUB_TOKEN` (no extra secret required); pull with
`docker pull ghcr.io/<owner>/<repo>:latest`.

---

## Editing this project

You can edit the code through:

- **Lovable** — <https://lovable.dev/projects/d782484e-4dde-4502-9b59-ffe68f3de0a7>
- **Your IDE** — clone the repo, push commits; Lovable syncs both ways.
- **GitHub web editor** or **Codespaces**.

## Deployment via Lovable

Open the project in Lovable → **Share → Publish**. Custom domains are
configured under **Project → Settings → Domains**.
