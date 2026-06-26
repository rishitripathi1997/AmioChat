# Phase 6 — Deployment

**Project:** AmioChat  
**Version:** 0.1  
**Last updated:** 2026-06-16  
**Status:** In progress  
**Prerequisites:** Phase 5 (complete)

---

## 1. Deployment strategy

AmioChat deploys as a **serverless stack** in **us-east-1**:

| Layer | Service | Deploy method |
|-------|---------|---------------|
| Frontend | Amplify Hosting (Next.js SSR) | Git branch → Amplify build |
| REST API | API Gateway HTTP + Lambda | Terraform |
| Real-time | API Gateway WebSocket + Lambda | Terraform |
| Auth | Cognito | Terraform |
| Data | DynamoDB + S3 | Terraform |
| Config | SSM Parameter Store | Terraform outputs → Amplify env vars |

**Environments:** `dev` (local Terraform state), `staging`, `prod` (remote S3 state).

CI (Phase 5.7) runs tests on every PR. Deploy workflows (Phase 6.6) run Terraform **plan** on infra PRs and **apply** via manual dispatch after review.

> **Do not run `terraform apply` against shared environments without explicit approval.** Local `dev` apply on a personal AWS account is fine for experimentation.

---

## 2. Build order

| Step | Task | Status |
|------|------|--------|
| 6.1 | Deployment strategy + runbooks (this doc) | **Complete** |
| 6.2 | Remote state bootstrap (`infra/terraform/bootstrap/`) | **Complete** |
| 6.3 | DynamoDB repository + WS connection store for Lambda | Pending |
| 6.4 | Production env wiring (CORS, SSM → Amplify env vars) | Pending |
| 6.5 | Amplify Hosting (`amplify.yml`, branch deploy) | Pending |
| 6.6 | GitHub Actions deploy workflow (plan / apply) | **Complete** |
| 6.7 | First staging deploy + smoke test | Pending |

### Blocker — DynamoDB data layer

Phase 4 uses `MemoryRepository` for local dev. Lambda handlers share the same router but **throw if `USE_MEMORY_DB=false`** without a DynamoDB implementation.

Before the first AWS deploy:

1. Implement `DynamoRepository` in `packages/backend/src/db/dynamodb.ts` per [dynamodb-schema.md](./design/dynamodb-schema.md).
2. Implement `DynamoConnectionRepository` in `packages/backend/src/ws/connections.ts` (or separate file).
3. Wire `getRepository()` / `getConnectionRepository()` to select DynamoDB when `DYNAMODB_TABLE_NAME` is set.
4. Add integration tests (optional: LocalStack or mocked AWS SDK).

---

## 3. Prerequisites

### AWS account

Use a **personal** CLI profile (see [infra/README.md](../../infra/README.md)):

```bash
aws configure --profile amiochat-personal
aws sts get-caller-identity --profile amiochat-personal
```

### GitHub secrets (for CI deploy workflow)

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | Terraform deploy user |
| `AWS_SECRET_ACCESS_KEY` | Terraform deploy user |
| `AWS_REGION` | `us-east-1` (optional — defaults in workflow) |

Create an IAM user (e.g. `amiochat-github-deploy`) with permissions for Cognito, DynamoDB, S3, Lambda, API Gateway, IAM, SSM. Tighten to least-privilege after first successful apply.

---

## 4. Remote state bootstrap (one-time)

Creates the S3 bucket and DynamoDB lock table for Terraform state.

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars   # optional edits
terraform init
terraform plan
terraform apply
```

Note the outputs (`state_bucket_name`, `lock_table_name`).

### Wire main stack to remote state

```bash
cd ../   # infra/terraform
terraform init \
  -backend-config=backends/staging.hcl \
  -migrate-state
```

Edit `backends/staging.hcl` / `backends/prod.hcl` with your bucket and state keys before init.

---

## 5. Deploy infrastructure

### Staging

```bash
cd infra/terraform
export AWS_PROFILE=amiochat-personal

terraform init -backend-config=backends/staging.hcl
terraform plan  -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars
```

### Production

Same flow with `backends/prod.hcl` and `environments/prod.tfvars`. Use **manual approval** (GitHub environment protection) before prod apply.

### After apply — read outputs

```bash
terraform output
aws ssm get-parameters-by-path --path /amiochat/staging --recursive --profile amiochat-personal
```

---

## 6. Frontend (Amplify Hosting)

### Connect repository

1. AWS Console → **Amplify** → **Create app** → connect GitHub `AmioChat`.
2. Branch: `master` for staging (or a `staging` branch if preferred).
3. Monorepo app root: `apps/web` (build spec: root `amplify.yml`).
4. Set environment variables from SSM / Terraform outputs:

| Variable | Example source |
|----------|------------------|
| `NEXT_PUBLIC_AUTH_MODE` | `cognito` |
| `NEXT_PUBLIC_AWS_REGION` | `us-east-1` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Terraform output |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Terraform output |
| `NEXT_PUBLIC_WS_URL` | Terraform `websocket_api_url` |
| `NEXT_PUBLIC_API_URL` | Terraform `http_api_url` (when frontend calls API directly) |
| `AUTH_SESSION_SECRET` | Generate strong random string (Amplify secret) |
| `USE_MEMORY_DB` | `false` |
| `DYNAMODB_TABLE_NAME` | From SSM (if Next.js proxy still used) |

Update `web_app_origins` in `environments/staging.tfvars` with the Amplify URL, then re-apply Terraform for CORS.

### Local env reference

See [apps/web/.env.example](../../apps/web/.env.example).

---

## 7. CI/CD workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| [ci.yml](../../.github/workflows/ci.yml) | Push / PR | typecheck, Vitest, Playwright, build |
| [deploy.yml](../../.github/workflows/deploy.yml) | PR (infra paths) | Terraform **plan** (staging) |
| [deploy.yml](../../.github/workflows/deploy.yml) | `workflow_dispatch` | Terraform **apply** to chosen env |

```bash
# Manual deploy from GitHub Actions UI:
# Actions → Deploy → Run workflow → environment: staging | prod
```

---

## 8. Post-deploy smoke test

1. Register a user (Cognito email verification).
2. Sign in at Amplify URL → `/chat`.
3. Open a second browser / incognito → register second user → start chat.
4. Send a message (WebSocket connected).
5. Start a voice call → accept → end.

---

## 9. Rollback

| Component | Rollback |
|-----------|----------|
| Lambda | Redeploy previous zip via Terraform (revert git commit + apply) |
| Frontend | Amplify → redeploy previous build |
| DynamoDB | **No automatic rollback** — design schema changes carefully |
| Terraform | `terraform apply` previous state or restore state from S3 versioning |

Enable **S3 versioning** on the Terraform state bucket (bootstrap module does this).

---

## 10. Cost guardrails (MVP)

- On-demand DynamoDB (no provisioned capacity at MVP scale).
- Lambda memory 256 MB, 30 s timeout.
- S3 lifecycle: optional transition for old media after 90 days (future).
- CloudWatch log retention: 14 days (configure in Phase 7).

Target: **< $200/month** at ~500 concurrent users (Phase 1 assumption).

---

## Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-06-16 | SDLC Phase 6 | Initial deployment plan; bootstrap + deploy workflow |
