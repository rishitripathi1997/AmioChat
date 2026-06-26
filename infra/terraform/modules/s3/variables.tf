variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "cors_allow_origins" {
  description = "Browser origins allowed for S3 media uploads"
  type        = list(string)
}
