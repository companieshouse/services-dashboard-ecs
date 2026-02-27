terraform {
  backend "s3" {
  }

  required_version = ">= 1.3.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.72.0, < 6.0"
    }

    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.18.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "secrets" {
  source = "git@github.com:companieshouse/terraform-modules//aws/parameter-store?ref=1.0.363"

  name_prefix = local.service_name
  kms_key_id  = data.aws_kms_key.kms_key.id
  secrets = {
    for k in ["mongo_password", "gh_token"] :
    k => local.service_secrets[k]
  }
}

module "lambda" {
  source = "git@github.com:companieshouse/terraform-modules.git//aws/lambda?ref=1.0.365"

  environment    = var.environment
  function_name  = local.lambda_function_name
  lambda_runtime = var.lambda_runtime
  lambda_handler = var.lambda_handler_name

  lambda_code_s3_bucket = var.release_bucket_name
  lambda_code_s3_key    = var.release_artifact_key

  lambda_memory_size         = var.lambda_memory_size
  lambda_timeout_seconds     = var.lambda_timeout_seconds
  lambda_logs_retention_days = var.lambda_logs_retention_days

  lambda_env_vars = {
    MONGO_PROTOCOL                 = local.service_secrets["mongo_protocol"]
    MONGO_HOST_AND_PORT            = local.service_secrets["mongo_hostandport"]
    MONGO_USER                     = local.service_secrets["mongo_user"]
    MONGO_DB_NAME                  = local.service_secrets["mongo_dbname"]
    MONGO_COLLECTION_PROJECTS      = local.service_secrets["mongo_collection_projects"]
    MONGO_PASSWORD_PARAMSTORE_NAME = "${local.ssm_prefix}/mongo_password"
    GH_TOKEN_PARAMSTORE_NAME       = "${local.ssm_prefix}/gh_token"
    ENV                            = "${var.environment}"
    ECR_REGISTRYID                 = "${var.ecr_registryId}"
  }

  lambda_cloudwatch_event_rules = local.lambda_cloudwatch_event_rules
  additional_policies           = local.additional_iam_policies_json

  lambda_sg_egress_rule = {
    from_port   = -1
    to_port     = -1
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lambda_vpc_access_subnet_ids = local.lambda_vpc_access_subnet_ids
  lambda_vpc_id                = data.aws_vpc.vpc.id
}

resource "aws_vpc_endpoint" "ecs" {
  vpc_id             = data.aws_vpc.vpc.id
  service_name       = "com.amazonaws.${var.aws_region}.ecs"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = local.lambda_vpc_access_subnet_ids
  security_group_ids = [module.lambda.security_group_id]
  tags = {
    Name = "connect-lambda-on-this-vpc-to-ecs"
  }
}

# Create a policy to allow Lambda to access ECS
resource "aws_iam_policy" "ecs_operations_policy" {
  name   = "${local.lambda_function_name}-ecs-operations-policy"
  policy = data.aws_iam_policy_document.ecs_operations_policy.json
}

# Attach the ECS access policy to the Lambda execution role
resource "aws_iam_role_policy_attachment" "ecs_operations_policy_attachment" {
  role = element(split("/", module.lambda.lambda_role_arn), 1)
  # policy_arn = aws_iam_policy.ecs_operations_policy.arn
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# Create a policy to allow Lambda to access ECR
resource "aws_iam_policy" "ecr_operations_policy" {
  name   = "${local.lambda_function_name}-ecr-operations-policy"
  policy = data.aws_iam_policy_document.ecr_operations_policy.json
}

# Attach the ECR access policy to the Lambda execution role
resource "aws_iam_role_policy_attachment" "ecr_operations_policy_attachment" {
  role       = element(split("/", module.lambda.lambda_role_arn), 1)
  policy_arn = aws_iam_policy.ecr_operations_policy.arn
}
