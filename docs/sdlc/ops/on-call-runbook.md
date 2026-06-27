# On-call runbook

**Project:** AmioChat  
**Last updated:** 2026-06-27  
**Related:** [Staging/prod checklist](./staging-prod-checklist.md) · [Phase 7 operations](../phase-7-operations.md)

This runbook is for whoever responds to **CloudWatch alarms** and **user-reported outages** in staging or prod.

---

## 1. On-call model (MVP)

AmioChat MVP assumes a **small team or solo owner**. Formal 24/7 rotation is optional until traffic warrants it.

| Role | Responsibility | Default |
|------|----------------|---------|
| **Primary** | First responder to SNS alarms; triage and fix or escalate | Product owner |
| **Backup** | Covers primary absence (vacation, etc.) | Same person or named delegate |
| **Escalation** | AWS account / billing / unrecoverable infra | Primary → AWS Support (Business+ if subscribed) |

Fill in contacts before prod go-live:

| Role | Name | Email | Phone (optional) |
|------|------|-------|------------------|
| Primary | | | |
| Backup | | | |

---

## 2. How alerts arrive

1. CloudWatch alarm breaches threshold → publishes to SNS topic `{prefix}-ops-alarms`
2. SNS sends email to all **Confirmed** subscribers in `alarm_emails`
3. Email subject includes alarm name and state (`ALARM` or `OK`)

**If no email:** subscription may be pending — see [Phase 7 §4](../phase-7-operations.md#4-alarm-email-setup-75).

**Prefix examples:** `amiochat-staging-ops-*`, `amiochat-prod-ops-*`

---

## 3. Alarm → action matrix

| Alarm | Likely cause | First actions |
|-------|--------------|---------------|
| `{prefix}-ops-rest-errors` | Bad deploy, DynamoDB errors, unhandled exceptions | Logs Insights on `/aws/lambda/{prefix}-rest`; check recent deploy |
| `{prefix}-ops-ws-errors` | WS handler crash, auth failure storm | Logs on `/aws/lambda/{prefix}-ws`; verify `NEXT_PUBLIC_WS_URL` |
| `{prefix}-ops-rest-throttles` | Traffic spike or account concurrency limit | Dashboard invocations; consider reserved concurrency later |
| `{prefix}-ops-http-5xx` | Lambda errors, API Gateway integration failures | Correlate with REST errors alarm; check API Gateway metrics |
| `{prefix}-ops-ws-integration-errors` | WS route failures, Lambda timeout | WS logs; integration latency on dashboard |

When **OK** email arrives: note recovery time; no action unless flapping (alarm → OK → alarm repeatedly).

---

## 4. Incident response flow

```
Alert or user report
        │
        ▼
Acknowledge (< 15 min target for prod)
        │
        ▼
Severity? ── SEV3 (minor) ──► Fix in next business window
        │
        SEV1/2 (users blocked)
        │
        ▼
Open dashboard + logs (§5)
        │
        ▼
Recent deploy? ── yes ──► Rollback (§6)
        │
        no
        │
        ▼
Identify component (REST / WS / Auth / Amplify / DynamoDB)
        │
        ▼
Mitigate → Verify smoke test → Document → Close
```

### Severity guide

| Level | Definition | Response target |
|-------|------------|-----------------|
| **SEV1** | Prod down or data loss risk | Immediate; rollback first |
| **SEV2** | Major feature broken (chat or auth) | < 1 hour |
| **SEV3** | Degraded / staging only | Next business day |

---

## 5. Triage commands

Set environment context first:

```bash
export AWS_PROFILE=amiochat-personal
export AWS_REGION=us-east-1
# Staging example prefix:
PREFIX=amiochat-staging
```

### Dashboard & alarms

```bash
# Open in console: CloudWatch → Dashboards → ${PREFIX}-ops
aws cloudwatch describe-alarms --alarm-name-prefix "${PREFIX}-ops" \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' --output table
```

### REST health

```bash
HTTP_API_URL=$(aws ssm get-parameter --name "/amiochat/staging/http_api_url" \
  --query Parameter.Value --output text 2>/dev/null || terraform output -raw http_api_url)
curl -s "${HTTP_API_URL}/health" | jq .
```

### Recent REST errors (Logs Insights)

Log group: `/aws/lambda/${PREFIX}-rest`

```
fields @timestamp, correlationId, method, path, error, message
| filter level = "error"
| sort @timestamp desc
| limit 30
```

### Recent WS events

Log group: `/aws/lambda/${PREFIX}-ws`

```
fields @timestamp, message, routeKey, connectionId, userId, error
| filter service = "amiochat-ws"
| sort @timestamp desc
| limit 30
```

### DynamoDB (throttling)

Check dashboard **DynamoDB consumed capacity** widget. If throttling suspected:

```
fields @timestamp, message, error
| filter message like /ProvisionedThroughputExceeded|Throttling/
| sort @timestamp desc
| limit 20
```

---

## 6. Rollback decision tree

**Prefer fastest user recovery over root-cause fix during SEV1/SEV2.**

### Application (Amplify)

1. Amplify Console → **Deployments** → last successful build → **Redeploy this version**
2. Wait for build; re-run smoke test checks 1–6

### Infrastructure (Lambda / API)

1. Identify last good commit on `master` (or release tag)
2. Revert or checkout infra + backend changes
3. `terraform apply -var-file=environments/<env>.tfvars`
4. Redeploy Amplify if frontend env vars changed

### When *not* to rollback

- Single-user report with no alarm correlation → investigate first
- OK alarm already received and metrics normal → monitor
- DynamoDB data issue → rollback does not restore data; stop writes and assess

---

## 7. Common incidents

### API 5xx spike

1. Dashboard → HTTP API 5XX + Lambda errors
2. REST logs — filter `level = "error"`
3. If deploy within last hour → rollback Amplify and/or Lambda
4. If DynamoDB throttling → on-demand should auto-scale; check for hot partition or runaway loop

### Messages not delivering

1. Confirm `{prefix}-ops-ws-errors` or integration errors
2. WS logs — expect `ws.authenticated`, `ws.sendMessage`
3. Browser DevTools → WS → `connected` event after `authenticate`
4. Verify Amplify `NEXT_PUBLIC_WS_URL` matches `terraform output websocket_api_url`
5. See Phase 6 notes on post-connect auth (not query-string token)

### Auth / session failures

1. `/users/me` 401/500 in browser
2. Check Cognito app client flows (`ALLOW_USER_SRP_AUTH`)
3. Amplify `AUTH_SESSION_SECRET` set and unchanged across redeploys
4. API routes must use Node runtime on Amplify (see Phase 6 fixes)

### Alarm fatigue (flapping)

1. Check if threshold too low for bursty traffic
2. Increase evaluation periods or thresholds in `infra/terraform/modules/monitoring/`
3. Ensure `treat_missing_data = "notBreaching"` (already set)

---

## 8. Escalation

| Situation | Action |
|-----------|--------|
| Cannot access AWS account | Account root / billing owner |
| Regional AWS outage | [AWS Health Dashboard](https://health.aws.amazon.com/health/status) |
| Cognito / Chime platform issue | AWS Support case |
| Security incident (credential leak) | Rotate keys immediately; review IAM; invalidate Cognito sessions |

---

## 9. Post-incident

Within 48 hours (even for solo projects):

1. **Timeline** — alert time, detect, mitigate, resolve
2. **Root cause** — technical and process gaps
3. **Action items** — runbook update, alarm threshold, test gap
4. Store in GitHub issue or `docs/sdlc/ops/incidents/` (optional)

---

## 10. Useful links

| Resource | Location |
|----------|----------|
| Ops dashboard | CloudWatch → `{prefix}-ops` |
| Phase 6 deploy | [phase-6-deployment.md](../phase-6-deployment.md) |
| Phase 7 logging | [phase-7-operations.md §5](../phase-7-operations.md#5-structured-logging) |
| Smoke test | [staging-prod-checklist §4](./staging-prod-checklist.md#4-post-deploy-smoke-test) |
| Terraform infra | `infra/terraform/` |
