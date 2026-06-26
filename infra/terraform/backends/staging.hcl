# Copy values from bootstrap outputs after `terraform apply`.
# Usage: terraform init -backend-config=backends/staging.hcl

bucket         = "amiochat-terraform-state-ACCOUNT_ID"
key            = "staging/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "amiochat-terraform-locks"
encrypt        = true
