# AmioChat

A WhatsApp Web–style messaging application with live chat and video calling, built on AWS.

## Status

SDLC **Phase 6 (Deployment)** in progress. Phases 1–5 complete. See [docs/sdlc/](./docs/sdlc/).

## Tech stack (confirmed)

- **Frontend:** Next.js 15 (App Router)
- **Real-time chat:** API Gateway WebSockets + Lambda
- **REST API:** API Gateway HTTP API + Lambda
- **Video/voice calls:** Amazon Chime SDK
- **Auth:** Amazon Cognito
- **Data:** DynamoDB (single-table), S3 (media)
- **Hosting:** Amplify Hosting + CloudFront
- **Infrastructure:** Terraform (HCL) — `infra/terraform/`
- **Region:** us-east-1

## Documentation


| Phase            | Document                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| 1 — Requirements | [docs/sdlc/phase-1-requirements.md](./docs/sdlc/phase-1-requirements.md) |
| 2 — Architecture | [docs/sdlc/phase-2-architecture.md](./docs/sdlc/phase-2-architecture.md) |
| 3 — Design       | [docs/sdlc/phase-3-design.md](./docs/sdlc/phase-3-design.md)             |
| 5 — Testing      | [docs/sdlc/phase-5-testing.md](./docs/sdlc/phase-5-testing.md)             |
| 6 — Deployment   | [docs/sdlc/phase-6-deployment.md](./docs/sdlc/phase-6-deployment.md)     |
| SDLC tracker     | [docs/sdlc/README.md](./docs/sdlc/README.md)                             |


## Getting started

```bash
# Install all workspace dependencies
npm install

# Copy env (mock auth works without AWS)
cp apps/web/.env.example apps/web/.env.local

# Run the web app (localhost:3000)
npm run dev
```

See [phase-4-local-dev.md](./docs/sdlc/phase-4-local-dev.md) for mock auth instructions (code **123456**).

Monorepo layout: `apps/web` (Next.js), `packages/shared`, `packages/backend`, `infra/terraform/` (Terraform).

### Infrastructure (Terraform)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```