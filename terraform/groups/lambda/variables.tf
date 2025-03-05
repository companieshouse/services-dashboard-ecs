
# ---------------- MANDATORY VARIABLES ----------------
variable "aws_profile" {
  type        = string
  description = "The AWS profile name; used as a prefix for Vault secrets"
}

variable "environment" {
  type        = string
  description = "The environment name to be used when creating AWS resources"
}
variable "stack_name" {
  type        = string
  description = "The stack name to be used"
}

variable "release_bucket_name" {
  type        = string
  description = "The name of the S3 bucket containing the release artifact for the Lambda function"
}
variable "release_artifact_key" {
  type        = string
  description = "Key of the Lambda code object in the S3 bucket"
}

# ---------------- OPTIONAL VARIABLES ----------------
variable "aws_account" {
  type        = string
  description = "The AWS account name"
  default     = "development"
}
variable "aws_region" {
  type        = string
  description = "The AWS region in which resources will be created"
  default     = "eu-west-2"
}


variable "lambda_runtime" {
  type        = string
  description = "The lambda runtime to use for the function"
  default     = "nodejs20.x"
}
variable "lambda_handler_name" {
  type        = string
  description = "The lambda function entrypoint"
  default     = "app.handler"
}


variable "lambda_memory_size" {
  type        = number
  description = "The amount of memory made available to the Lambda function at runtime in megabytes"
  default     = 4096
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "The amount of time the lambda function is allowed to run before being stopped"
  default     = 300
}


variable "lambda_logs_retention_days" {
  type        = number
  description = "The number of days to retain Lambda logs in CloudWatch"
  default     = 7
}
