# Staging & production ops checklist

**Project:** AmioChat  
**Last updated:** 2026-06-27  
**Related:** [Phase 7 operations](../phase-7-operations.md) · [On-call runbook](./on-call-runbook.md) · [Phase 6 deployment](../phase-6-deployment.md)

Use these checklists when standing up, deploying to, or maintaining **staging** and **prod**. Resource names follow `{project_name}-{environment}` (e.g. `amiochat-staging-rest`, dashboard `amiochat-staging-ops`).

---

## 1. First-time environment setup

Complete once per environment (staging or prod).

### Bootstrap & Terraform

- [ ] Remote state bootstrapped (`infra/terraform/bootstrap/`) — S3 bucket + DynamoDB lock table
- [ ] `backends/<env>.hcl` updated with bucket name and state key
- [ ] `environments/<env>.tfvars` reviewed (`environment`, `web_app_origins`, `alarm_emails`)
- [ ] `terraform init -backend-config=backends/<env>.hcl`
- [ ] `terraform apply -var-file=environments/<env>.tfvars` succeeds
- [ ] Terraform outputs saved (or in SSM under `/amiochat/<env>/`)

### Amplify

- [ ] Amplify app connected to GitHub repo and target branch
- [ ] Environment variables set from `terraform output amplify_environment_variables`
- [ ] `AUTH_SESSION_SECRET` set (long random string; secret in Amplify if available)
- [ ] First Amplify deploy succeeds
- [ ] Amplify URL added to `web_app_origins` in tfvars → **re-apply Terraform** (CORS + S3)

### Monitoring & alerts

- [ ] `alarm_emails` set in tfvars for staging/prod
- [ ] Terraform apply creates SNS topic `{prefix}-ops-alarms`
- [ ] All SNS email subscriptions **Confirmed** (not `PendingConfirmation`)
- [ ] CloudWatch dashboard `{prefix}-ops` opens and shows metrics

### GitHub (CI/CD)

- [ ] `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` secrets configured
- [ ] Deploy workflow: plan on infra PRs; apply via manual dispatch only
- [ ] Prod: GitHub **environment protection** enabled (required reviewers) before apply

---

## 2. Pre-deploy checklist

Run before every staging or prod deploy.

### Code & CI

- [ ] Target branch merged; PR approved
- [ ] CI green (typecheck, Vitest, Playwright, build)
- [ ] No open P0/P1 bugs for the release scope
- [ ] Changelog or release notes updated (if applicable)

### Infrastructure (if Terraform changed)

- [ ] `terraform plan -var-file=environments/<env>.tfvars` reviewed
- [ ] No unexpected destroys on DynamoDB, Cognito, or stateful resources
- [ ] Lambda zip rebuild expected (backend code changes)
- [ ] Staging plan applied and smoke-tested before prod (prod only)

### Frontend (if web app changed)

- [ ] Amplify env vars still match current Terraform outputs
- [ ] `NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_API_URL` correct for environment
- [ ] No breaking auth/session changes without migration plan

### Comms

- [ ] Stakeholders notified if prod deploy is user-visible
- [ ] On-call contact confirmed for deploy window (prod)

---

## 3. Deploy steps

### Infrastructure

```bash
cd infra/terraform
export AWS_PROFILE=amiochat-personal   # or CI deploy user

terraform init -backend-config=backends/staging.hcl   # or prod.hcl
terraform plan  -var-file=environments/staging.tfvars
terraform apply -var-file=environments/staging.tfvars
```

Or: **GitHub Actions → Deploy → Run workflow → environment: staging | prod**

### Frontend

1. Update Amplify env vars if Terraform outputs changed (`npm run print:deploy-env staging`)
2. Trigger Amplify redeploy (push to branch or **Redeploy this version**)

---

## 4. Post-deploy smoke test

Run immediately after every deploy. Full steps in [Phase 6 §8](../phase-6-deployment.md#8-post-deploy-smoke-test).

| # | Check | Pass criteria |
|---|--------|---------------|
| 1 | REST health | `curl -s "$HTTP_API_URL/health"` → `status: ok` |
| 2 | Register / sign in | Cognito flow completes; lands on `/chat` |
| 3 | Profile bootstrap | `/users/me` returns 200 in DevTools |
| 4 | User search | Second user findable; conversation opens |
| 5 | WebSocket | WS status **connected** (not stuck on Connecting) |
| 6 | Real-time message | User A sends → User B receives live; delivery ticks update |
| 7 | Voice call (optional) | Outbound call connects; accept/end works |

**Staging:** run full checklist.  
**Prod:** at minimum checks 1–6; add 7 before major calling changes.

---

## 5. Periodic ops (weekly / monthly)

### Weekly (5 min)

- [ ] CloudWatch dashboard `{prefix}-ops` — no sustained error spikes
- [ ] All alarms in **OK** state (CloudWatch → Alarms)
- [ ] Amplify last deploy status **Succeeded**
- [ ] AWS Cost Explorer — spend within expected range (< $200/mo MVP target)

### Monthly (15 min)

- [ ] Review Lambda error logs (Logs Insights — see Phase 7 §5)
- [ ] Confirm SNS subscriptions still `Confirmed`
- [ ] Rotate review: IAM deploy user keys (if not using OIDC)
- [ ] Verify Terraform state bucket versioning enabled
- [ ] Re-run smoke test on staging after dependency updates

### After incidents

- [ ] Post-incident note in repo or issue (what happened, root cause, follow-up)
- [ ] Update runbook if steps were wrong or missing

---

## 6. Environment quick reference

| Item | Staging | Prod |
|------|---------|------|
| tfvars | `environments/staging.tfvars` | `environments/prod.tfvars` |
| Backend | `backends/staging.hcl` | `backends/prod.hcl` |
| State key | `staging/terraform.tfstate` | `prod/terraform.tfstate` |
| SSM path | `/amiochat/staging` | `/amiochat/prod` |
| Name prefix | `amiochat-staging` | `amiochat-prod` |
| Deploy approval | Team review | Manual dispatch + GitHub env protection |
| Smoke test depth | Full | Full (min 1–6 every deploy) |

---

## 7. Rollback triggers

Roll back without debate if any of these occur within 30 minutes of a deploy:

- `/health` returns non-200
- Sign-in or session persistence broken for all users
- WebSocket connections fail for all users
- Sustained HTTP 5xx alarm (> 10 in 5 min)
- Message delivery broken between two test accounts

See [on-call runbook § Rollback](./on-call-runbook.md#6-rollback-decision-tree).
