# Copy values from bootstrap outputs after `terraform apply`.
# Usage: terraform init -backend-config=backends/prod.hcl

bucket         = "amiochat-terraform-state-ACCOUNT_ID"
key            = "prod/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "amiochat-terraform-locks"
encrypt        = true
