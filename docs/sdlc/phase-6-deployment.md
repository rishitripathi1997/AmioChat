# Phase 6 — Deployment

**Project:** AmioChat  
**Version:** 0.1  
**Last updated:** 2026-06-27  
**Status:** Complete  
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
| 6.3 | DynamoDB repository + WS connection store for Lambda | **Complete** |
| 6.4 | Production env wiring (CORS, SSM → Amplify env vars) | **Complete** |
| 6.5 | Amplify Hosting (`amplify.yml`, branch deploy) | **Complete** |
| 6.6 | GitHub Actions deploy workflow (plan / apply) | **Complete** |
| 6.7 | First staging deploy + smoke test | **Complete** |

### Production wiring (6.4 — complete)

| Item | Location |
|------|----------|
| Direct API mode | `apps/web/src/lib/config/runtime.ts` — `NEXT_PUBLIC_API_URL` → API Gateway; default `/api/v1` for local |
| WebSocket URL | `NEXT_PUBLIC_WS_URL` in `ws/client.ts` |
| S3 CORS | `web_app_origins` → media bucket PUT/GET |
| Amplify env output | `terraform output amplify_environment_variables` |
| Print helper | `npm run print:deploy-env` |

### Amplify Hosting (6.5 — complete)

| Item | Location |
|------|----------|
| Build spec | Root `amplify.yml` (monorepo, `buildPath: /`) |
| App root | `apps/web` |
| Env vars | Set in Amplify Console after `terraform apply` — see below |

---

### Data layer (6.3 — complete)

- **`DynamoRepository`** — `packages/backend/src/db/dynamodb.ts` (single-table schema + S3 presigned media)
- **`DynamoConnectionRepository`** — `packages/backend/src/ws/dynamodb-connections.ts`
- **Auto-select:** when `DYNAMODB_TABLE_NAME` is set and `USE_MEMORY_DB !== 'true'`, Lambda uses DynamoDB; local dev stays in-memory by default.

---

## When to run `terraform apply` / `destroy`

You do **not** need Terraform to run local tests (`npm test`, `npm run test:e2e`). Apply only when you want to verify the stack on AWS.

| Step | When |
|------|------|
| **`terraform apply`** | After 6.3 is in your branch and you want to smoke-test Cognito + API Gateway + DynamoDB on your personal account |
| **Smoke test** | Immediately after apply — register a user, hit REST/WS endpoints |
| **`terraform destroy`** | **Right after testing** — same terminal session, same var-file |

```bash
cd infra/terraform
export AWS_PROFILE=amiochat-personal
cp terraform.tfvars.example terraform.tfvars   # if not done yet

terraform init
terraform apply          # ← when ready to test on AWS

# ... smoke test using outputs / SSM params ...

terraform destroy        # ← run immediately when done
```

Bootstrap (`infra/terraform/bootstrap/`) is only needed for **staging/prod remote state** — skip it for a quick dev apply/destroy test.

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

### 1. Apply infrastructure first

```bash
cd infra/terraform
export AWS_PROFILE=amiochat-personal
terraform apply    # or -var-file=environments/staging.tfvars
```

### 2. Print Amplify environment variables

```bash
npm run print:deploy-env          # dev (default)
npm run print:deploy-env staging  # staging
```

Copy output into **Amplify Console → App settings → Environment variables**.

Also set **`AUTH_SESSION_SECRET`** to a long random string (mark as secret in Amplify if available).

### 3. Connect GitHub in Amplify

1. AWS Console → **Amplify** → **Create app** → connect `rishitripathi1997/AmioChat`.
2. Branch: `master` (or `staging`).
3. Amplify detects root `amplify.yml` and monorepo app root `apps/web`.
4. Paste environment variables from step 2.
5. Deploy.

### 4. Update CORS with Amplify URL

After the first Amplify deploy, copy the app URL (e.g. `https://master.xxxxx.amplifyapp.com`) into `web_app_origins` in your tfvars file, then re-apply:

```bash
terraform apply -var-file=environments/staging.tfvars
```

This updates HTTP API CORS and S3 media upload CORS.

### Environment variable reference

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_AUTH_MODE` | `cognito` |
| `NEXT_PUBLIC_AWS_REGION` | `us-east-1` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Terraform output |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Terraform output |
| `NEXT_PUBLIC_API_URL` | Terraform `http_api_url` |
| `NEXT_PUBLIC_WS_URL` | Terraform `websocket_api_url` |
| `AUTH_SESSION_SECRET` | Generate manually |

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
- CloudWatch log retention: 14 days (see [phase-7-operations.md](./phase-7-operations.md)).

Target: **< $200/month** at ~500 concurrent users (Phase 1 assumption).

---

## Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-06-16 | SDLC Phase 6 | Initial deployment plan; bootstrap + deploy workflow |
