output "state_bucket_name" {
  description = "S3 bucket for Terraform remote state"
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table_name" {
  description = "DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "aws_region" {
  description = "Region where bootstrap resources were created"
  value       = var.aws_region
}

output "backend_config_snippet" {
  description = "Example backend.hcl values — copy into backends/staging.hcl and prod.hcl"
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.terraform_state.id}"
    region         = "${var.aws_region}"
    dynamodb_table = "${aws_dynamodb_table.terraform_locks.name}"
    encrypt        = true
  EOT
}
