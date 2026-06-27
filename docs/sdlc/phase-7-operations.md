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
| 7.5 | SNS/email alarm notifications | **Complete** |
| 7.6 | Staging/prod ops checklist + on-call runbook | Pending |

---

## 3. Observability stack

After `terraform apply`, outputs include:

| Output | Use |
|--------|-----|
| `cloudwatch_dashboard_name` | Open in **CloudWatch → Dashboards** |
| `lambda_log_groups` | **CloudWatch → Log groups** for REST / WS Lambda |
| `alarm_sns_topic_arn` | SNS topic for alarm emails (null if `alarm_emails` unset) |

### Dashboard widgets

- Lambda invocations & errors (REST + WebSocket)
- HTTP API requests, 4XX, 5XX
- WebSocket connects, messages, integration errors
- DynamoDB consumed read/write capacity

### Alarms

When `alarm_emails` is set in Terraform, all alarms publish to an SNS topic and email subscribers on **ALARM** and **OK** (recovery).

| Alarm | Metric | Default threshold |
|-------|--------|-------------------|
| `{prefix}-ops-rest-errors` | Lambda Errors (REST) | ≥ 5 / 5 min |
| `{prefix}-ops-ws-errors` | Lambda Errors (WS) | ≥ 5 / 5 min |
| `{prefix}-ops-rest-throttles` | Lambda Throttles (REST) | ≥ 1 / 5 min |
| `{prefix}-ops-http-5xx` | API Gateway 5xx | ≥ 10 / 5 min |
| `{prefix}-ops-ws-integration-errors` | WS IntegrationError | ≥ 5 / 5 min |

If `alarm_emails` is empty (default), alarms still exist but send no notifications.

---

## 4. Alarm email setup (7.5)

### Configure

In `terraform.tfvars` (or environment tfvars):

```hcl
alarm_emails = ["you@example.com", "oncall@example.com"]
```

Apply:

```bash
cd infra/terraform
terraform apply
```

### Confirm SNS subscription

After apply, each address receives an **AWS Notification – Subscription Confirmation** email. Click **Confirm subscription** — alerts are not delivered until confirmed.

Check pending subscriptions:

```bash
terraform output alarm_sns_topic_arn
aws sns list-subscriptions-by-topic \
  --topic-arn "$(terraform output -raw alarm_sns_topic_arn)" \
  --region us-east-1
```

Status must be `Confirmed`, not `PendingConfirmation`.

### Test (optional)

Manually set an alarm to ALARM in the CloudWatch console, or temporarily lower thresholds in the monitoring module variables.

---

## 5. Structured logging

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

### Log retention

Variable `log_retention_days` (default **14**) in `infra/terraform/variables.tf`.

---

## 6. Health checks

| Check | Command / URL |
|-------|----------------|
| REST health | `curl -s "$HTTP_API_URL/health"` → `{"status":"ok",...}` |
| Auth + API | Sign in on Amplify URL; DevTools → Network → `/users/me` → 200 |
| WebSocket | DevTools → Network → WS → `connected` event after `authenticate` |
| Chat | Send message; clock icon → checkmarks; other user receives live |

---

## 7. Runbooks

### Deploy (staging / prod)

1. Merge to target branch; CI tests pass.
2. `cd infra/terraform`
3. `terraform init -backend-config=backends/staging.hcl` (or prod)
4. `terraform plan -var-file=environments/staging.tfvars`
5. Review plan → `terraform apply -var-file=environments/staging.tfvars`
6. Update Amplify env vars from `terraform output amplify_environment_variables`
7. Redeploy Amplify branch; run smoke test (Phase 6.7 checklist).

### Rollback (application)

1. **Amplify:** Redeploy previous successful build (Deployments → Redeploy).
2. **Lambda/API:** Re-apply previous Terraform state or revert Git commit and re-apply.
3. Verify `/health` and login.

### Rollback (infrastructure)

1. `git checkout <last-known-good>` for `infra/terraform/`
2. `terraform apply -var-file=environments/<env>.tfvars`
3. Never `terraform destroy` in prod unless intentional teardown.

### Incident: API 5xx spike

1. Open CloudWatch dashboard `{name_prefix}-ops`.
2. Check alarm `{prefix}-ops-http-5xx` and `{prefix}-ops-rest-errors`.
3. Logs Insights on `/aws/lambda/{prefix}-rest` — filter `level = "error"`.
4. Common causes: DynamoDB throttling, bad deploy, CORS misconfiguration.
5. Roll back Lambda or Amplify if tied to recent deploy.

### Incident: Messages not delivering

1. Check `{prefix}-ops-ws-errors` and WS **IntegrationError** on dashboard.
2. Logs on `/aws/lambda/{prefix}-ws` — look for `ws.authenticated`, `ws.sendMessage`, `ws.failed`.
3. Confirm Amplify has `NEXT_PUBLIC_WS_URL` and clients show **connected** (not stuck on Connecting).
4. Verify WebSocket `authenticate` flow (see Phase 6 deployment notes).

### Teardown (dev / experiment)

```bash
cd infra/terraform
export AWS_PROFILE=amiochat-personal
terraform destroy
```

Delete Amplify app separately. Confirm zero recurring charges in **Billing → Cost Explorer**.

---

## 8. Environment matrix

| Environment | State backend | tfvars | Typical use |
|-------------|---------------|--------|-------------|
| dev | Local (default) | `terraform.tfvars` (gitignored) | Personal smoke tests |
| staging | `backends/staging.hcl` | `environments/staging.tfvars` | Pre-prod validation |
| prod | `backends/prod.hcl` | `environments/prod.tfvars` | Live users |

---

## 9. Next steps (7.6)

- Document on-call rotation and escalation for prod.
- Set **DynamoDB** alarms on `UserErrors` / throttling if traffic grows.
- Add **X-Ray** or ADOT tracing (optional).

---

## 10. Approval

| Role | Name | Date |
|------|------|------|
| Owner | | |
