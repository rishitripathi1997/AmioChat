# Phase 4 — Implementation

**Project:** AmioChat  
**Version:** 0.2  
**Last updated:** 2026-06-18  
**Status:** In progress  
**Prerequisites:** Phases 1–3 (complete)

---

## 1. Build order

| Step | Task | Status |
|------|------|--------|
| 4.1 | Monorepo scaffold (`apps/web`, `packages/backend`, `packages/shared`) | **Complete** |
| 4.1b | Terraform scaffold (`infra/terraform/` + modules) | **Complete** |
| 4.2 | Terraform — harden modules (JWT authorizer, real Lambda bundles, Chime, outputs to SSM) | **Next** |
| 4.3 | Auth flows — register, login, PostConfirmation trigger | Pending |
| 4.4 | REST APIs — users, conversations, messages, media | Pending |
| 4.5 | WebSocket handlers — connect, sendMessage, typing, read | Pending |
| 4.6 | Chat UI — sidebar, thread, composer | Pending |
| 4.7 | Chime integration — call create/join, CallOverlay | Pending |
| 4.8 | Polish — notifications, error states, reconnect | Pending |

---

## 2. Repository layout

```
AmioChat/
├── apps/
│   └── web/                 # Next.js frontend
├── packages/
│   ├── shared/              # Shared TypeScript types
│   └── backend/             # Lambda handlers & DDB layer
├── infra/
│   ├── README.md
│   └── terraform/           # Terraform root + modules
│       ├── main.tf
│       ├── modules/
│       │   ├── cognito/
│       │   ├── dynamodb/
│       │   ├── s3/
│       │   ├── lambda/
│       │   ├── http_api/
│       │   └── websocket_api/
│       └── environments/
├── docs/sdlc/
├── package.json             # npm workspaces root
└── tsconfig.base.json
```

---

## 3. Infrastructure (Terraform)

**IaC decision:** Terraform (team standard) — see [ADR-004](./phase-2-architecture.md#adr-004-terraform).

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Baseline modules provision Cognito, DynamoDB, S3, placeholder Lambdas, HTTP API, and WebSocket API. Phase 4.2 replaces placeholders with real handler code and adds authorizers, IAM fine-tuning, and SSM outputs for the web app.

---

## Revision history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-06-16 | SDLC Phase 4 | Implementation tracker started |
| 0.3 | 2026-06-22 | SDLC Phase 4 | Terraform validated; CDK removed; ready for Phase 4.2 |
