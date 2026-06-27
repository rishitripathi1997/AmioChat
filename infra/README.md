# AmioChat — Terraform Infrastructure

Infrastructure as code for AmioChat using **Terraform** (team standard).

## Layout

```
infra/terraform/
├── main.tf              # Root module — wires all resources
├── variables.tf
├── outputs.tf
├── versions.tf
├── terraform.tfvars.example
├── backend.tf.example   # Remote state (S3 + DynamoDB lock)
└── modules/
    ├── cognito/
    ├── dynamodb/
    ├── s3/
    ├── http_api/
    ├── websocket_api/
    └── lambda/
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://aws.amazon.com/cli/) configured (`aws configure`)
- AWS account with permissions for Cognito, DynamoDB, S3, API Gateway, Lambda, IAM

## Personal AWS account (recommended for AmioChat)

Use a **dedicated CLI profile** so AmioChat never touches your company account.

### 1. In your personal AWS account (AWS Console)

1. Sign in at https://console.aws.amazon.com (personal account).
2. **IAM** → **Users** → **Create user** (e.g. `amiochat-terraform`).
3. Attach policy: `AdministratorAccess` for dev (or a tighter custom policy later).
4. **Security credentials** → **Create access key** → **CLI**.
5. Save **Access key ID** and **Secret access key** (shown once).

### 2. On your Mac — add a CLI profile

```bash
aws configure --profile amiochat-personal
```

| Prompt | Value |
|--------|--------|
| AWS Access Key ID | from step 1 |
| AWS Secret Access Key | from step 1 |
| Default region | `us-east-1` |
| Default output format | `json` |

Verify (must show your **personal** account ID, not `174941398104`):

```bash
aws sts get-caller-identity --profile amiochat-personal
```

### 3. Point Terraform at the personal profile

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# ensure terraform.tfvars contains:
#   aws_profile = "amiochat-personal"
```

Or one-off without editing files:

```bash
AWS_PROFILE=amiochat-personal terraform plan
```

### 4. Keep work and personal separate

| Context | Profile | Account |
|---------|---------|---------|
| Company work | `AWS__ADMIN-174941398104` | `174941398104` |
| **AmioChat** | **`amiochat-personal`** | your personal account |

Unset company profile in shells used for AmioChat:

```bash
unset AWS_PROFILE AWS_DEFAULT_PROFILE
export AWS_PROFILE=amiochat-personal
```

---

## Quick start (local state — dev only)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit if needed
terraform init
terraform plan
terraform apply
```

## Remote state (staging / prod)

1. Bootstrap once (creates S3 bucket + DynamoDB lock table):

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
```

2. Copy bucket/table names into `backends/staging.hcl` and `backends/prod.hcl`.
3. Init main stack with remote backend:

```bash
cd ../
terraform init -backend-config=backends/staging.hcl
```

See [Phase 6 Deployment](../docs/sdlc/phase-6-deployment.md) for the full runbook.

## Environments

Use separate var files or workspaces:

| Environment | Var file | Region |
|-------------|----------|--------|
| dev | `terraform.tfvars` | us-east-1 |
| staging | `environments/staging.tfvars` | us-east-1 |
| prod | `environments/prod.tfvars` | us-east-1 |

```bash
terraform plan -var-file=environments/staging.tfvars
```

## Modules (baseline — Phase 4.1b)

| Module | Resources |
|--------|-----------|
| `cognito` | User pool + web app client |
| `dynamodb` | Single-table design with GSI1-Email |
| `s3` | Private media bucket + CORS |
| `lambda` | REST + WebSocket placeholder functions |
| `http_api` | API Gateway HTTP API → REST Lambda |
| `websocket_api` | WebSocket API ($connect, $disconnect, $default) |

Phase **4.2** complete: JWT authorizers, real Lambda bundles, Chime IAM, SSM parameters. Phase **4.3** adds Cognito PostConfirmation trigger and web auth flows.

## Apply (includes Lambda build)

Terraform runs `npm run build:backend` automatically before packaging Lambdas.

```bash
cd infra/terraform
terraform plan    # builds backend + shows changes
terraform apply
```

After apply, read config from SSM:

```bash
aws ssm get-parameters-by-path --path /amiochat/dev --recursive --profile amiochat-personal
```

## Related docs

- [Phase 2 Architecture](../docs/sdlc/phase-2-architecture.md)
- [Phase 4 Implementation](../docs/sdlc/phase-4-implementation.md)
- [Phase 6 Deployment](../docs/sdlc/phase-6-deployment.md)
- [Phase 7 Operations](../docs/sdlc/phase-7-operations.md)
- [Staging/prod checklist](../docs/sdlc/ops/staging-prod-checklist.md)
- [On-call runbook](../docs/sdlc/ops/on-call-runbook.md)
- [DynamoDB schema](../docs/sdlc/design/dynamodb-schema.md)
