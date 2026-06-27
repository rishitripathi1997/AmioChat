# Phase 7 — Operations

**Project:** AmioChat  
**Version:** 0.1  
**Last updated:** 2026-06-27  
**Status:** In progress  
**Prerequisites:** Phase 6 (complete)

---

## 1. Operability goals (OPS-01 – OPS-04)

| ID | Requirement | Implementation |
|----|-------------|----------------|
| OPS-01 | Structured logging with correlation IDs | JSON logs in Lambda (`packages/backend/src/lib/logger.ts`); API Gateway `requestId` as `correlationId` |
| OPS-02 | Metrics: throughput, WS connections, errors | CloudWatch dashboard + alarms (`infra/terraform/modules/monitoring/`) |
| OPS-03 | Infrastructure as code | Terraform (existing) |
| OPS-04 | Separate dev / staging / prod | `environment` variable + remote state backends (`infra/terraform/backends/`) |

---

## 2. Build order

| Step | Task | Status |
|------|------|--------|
| 7.1 | Operations doc + runbooks (this doc) | **Complete** |
| 7.2 | CloudWatch log groups (14-day retention) + JSON Lambda logs | **Complete** |
| 7.3 | CloudWatch alarms (Lambda errors, HTTP 5xx, WS integration errors) | **Complete** |
| 7.4 | CloudWatch operations dashboard | **Complete** |
| 7.5 | SNS/email alarm notifications | Pending (optional) |
| 7.6 | Staging/prod ops checklist + on-call runbook | Pending |

---

## 3. Observability stack

After `terraform apply`, outputs include:

| Output | Use |
|--------|-----|
| `cloudwatch_dashboard_name` | Open in **CloudWatch → Dashboards** |
| `lambda_log_groups` | **CloudWatch → Log groups** for REST / WS Lambda |

### Dashboard widgets

- Lambda invocations & errors (REST + WebSocket)
- HTTP API requests, 4XX, 5XX
- WebSocket connects, messages, integration errors
- DynamoDB consumed read/write capacity

### Alarms (no SNS yet)

| Alarm | Metric | Default threshold |
|-------|--------|-------------------|
| `{prefix}-ops-rest-errors` | Lambda Errors (REST) | ≥ 5 / 5 min |
| `{prefix}-ops-ws-errors` | Lambda Errors (WS) | ≥ 5 / 5 min |
| `{prefix}-ops-rest-throttles` | Lambda Throttles (REST) | ≥ 1 / 5 min |
| `{prefix}-ops-http-5xx` | API Gateway 5xx | ≥ 10 / 5 min |
| `{prefix}-ops-ws-integration-errors` | WS IntegrationError | ≥ 5 / 5 min |

Alarms are created in **ALARM** state only when thresholds breach. No email/SNS subscription is wired yet (step 7.5).

### Log retention

Variable `log_retention_days` (default **14**) in `infra/terraform/variables.tf`.

---

## 4. Structured logging

Lambda emits JSON lines compatible with CloudWatch Logs Insights:

```bash
# Recent REST errors
fields @timestamp, correlationId, method, path, error
| filter service = "amiochat-rest" and level = "error"
| sort @timestamp desc
| limit 50
```

```bash
# Trace one request
fields @timestamp, message, statusCode, method, path
| filter correlationId = "YOUR-API-GW-REQUEST-ID"
| sort @timestamp asc
```

WebSocket logs include `routeKey`, `connectionId`, and `userId` (after authenticate).

---

## 5. Health checks

| Check | Command / URL |
|-------|----------------|
| REST health | `curl -s "$HTTP_API_URL/health"` → `{"status":"ok",...}` |
| Auth + API | Sign in on Amplify URL; DevTools → Network → `/users/me` → 200 |
| WebSocket | DevTools → Network → WS → `connected` event after `authenticate` |
| Chat | Send message; clock icon → checkmarks; other user receives live |

---

## 6. Runbooks

### 6.1 Deploy (staging / prod)

1. Merge to target branch; CI tests pass.
2. `cd infra/terraform`
3. `terraform init -backend-config=backends/staging.hcl` (or prod)
4. `terraform plan -var-file=environments/staging.tfvars`
5. Review plan → `terraform apply -var-file=environments/staging.tfvars`
6. Update Amplify env vars from `terraform output amplify_environment_variables`
7. Redeploy Amplify branch; run smoke test (Phase 6.7 checklist).

### 6.2 Rollback (application)

1. **Amplify:** Redeploy previous successful build (Deployments → Redeploy).
2. **Lambda/API:** Re-apply previous Terraform state or revert Git commit and re-apply.
3. Verify `/health` and login.

### 6.3 Rollback (infrastructure)

1. `git checkout <last-known-good>` for `infra/terraform/`
2. `terraform apply -var-file=environments/<env>.tfvars`
3. Never `terraform destroy` in prod unless intentional teardown.

### 6.4 Incident: API 5xx spike

1. Open CloudWatch dashboard `{name_prefix}-ops`.
2. Check alarm `{prefix}-ops-http-5xx` and `{prefix}-ops-rest-errors`.
3. Logs Insights on `/aws/lambda/{prefix}-rest` — filter `level = "error"`.
4. Common causes: DynamoDB throttling, bad deploy, CORS misconfiguration.
5. Roll back Lambda or Amplify if tied to recent deploy.

### 6.5 Incident: Messages not delivering

1. Check `{prefix}-ops-ws-errors` and WS **IntegrationError** on dashboard.
2. Logs on `/aws/lambda/{prefix}-ws` — look for `ws.authenticated`, `ws.sendMessage`, `ws.failed`.
3. Confirm Amplify has `NEXT_PUBLIC_WS_URL` and clients show **connected** (not stuck on Connecting).
4. Verify WebSocket `authenticate` flow (see Phase 6 deployment notes).

### 6.6 Teardown (dev / experiment)

```bash
cd infra/terraform
export AWS_PROFILE=amiochat-personal
terraform destroy
```

Delete Amplify app separately. Confirm zero recurring charges in **Billing → Cost Explorer**.

---

## 7. Environment matrix

| Environment | State backend | tfvars | Typical use |
|-------------|---------------|--------|-------------|
| dev | Local (default) | `terraform.tfvars` (gitignored) | Personal smoke tests |
| staging | `backends/staging.hcl` | `environments/staging.tfvars` | Pre-prod validation |
| prod | `backends/prod.hcl` | `environments/prod.tfvars` | Live users |

---

## 8. Next steps (7.5 – 7.6)

- Wire alarms to **SNS → email** or Slack for staging/prod.
- Add **X-Ray** or ADOT tracing (optional).
- Document on-call rotation and escalation for prod.
- Set **DynamoDB** alarms on `UserErrors` / throttling if traffic grows.

---

## 9. Approval

| Role | Name | Date |
|------|------|------|
| Owner | | |
