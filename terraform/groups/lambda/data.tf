data "vault_generic_secret" "stack_secrets" {
  path = local.stack_secrets_path
}

data "vault_generic_secret" "service_secrets" {
  path = local.service_secrets_path
}

data "aws_kms_key" "kms_key" {
  key_id = local.kms_alias
}

data "aws_caller_identity" "aws_identity" {}

# Policy to allow Lambda to access SSM Parameter Store
data "aws_iam_policy_document" "ssm_access_policy" {
  statement {
    sid    = "AllowSSMAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParameterHistory"
    ]
    resources = ["*"]
  }
}

# Policy to allow Lambda to access ECS
data "aws_iam_policy_document" "ecs_operations_policy" {
  statement {
    sid    = "AllowECSOperations"
    effect = "Allow"
    actions = [
      "ecs:ListClusters",
      "ecs:ListTasks",
      "ecs:DescribeTasks",
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeClusters",
      "ecs:ListContainerInstances",
      "ecs:DescribeContainerInstances",
    ]
    resources = ["*"]
  }
}

# Policy to allow Lambda to access ECR
data "aws_iam_policy_document" "ecr_operations_policy" {
  statement {
    sid    = "AllowECROperations"
    effect = "Allow"

    actions = [
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
      "ecr:ListImages",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer"
    ]

    resources = ["arn:aws:ecr:${var.aws_region}:${var.ecr_registryId}:repository/*"]
  }

  statement {
    sid    = "ECRAuthToken"
    effect = "Allow"

    actions = [
      "ecr:GetAuthorizationToken"
    ]

    resources = ["*"]
  }
}

data "aws_vpc" "vpc" {
  filter {
    name   = "tag:Name"
    values = [local.vpc_name]
  }
}

#Get application subnet IDs
data "aws_subnets" "application" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.vpc.id]
  }

  filter {
    name   = "tag:Name"
    values = [local.application_subnet_pattern]
  }
}

data "local_file" "daily_load_all" {
  filename = "${local.json_folder}/daily_load_all.json"
}
