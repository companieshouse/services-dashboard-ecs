data "vault_generic_secret" "stack_secrets" {
  path = "applications/${var.vault_stack_path}"
}

data "vault_generic_secret" "service_secrets" {
  path = "applications/${var.vault_service_path}"
}

# Policy to attach to the IAM role for the Lambda function
data "aws_iam_policy_document" "lambda_trust" {
  statement {
    sid    = "LambdaCanAssumeThisRole"
    effect = "Allow"
    actions = [
      "sts:AssumeRole"
    ]
    principals {
      type = "Service"
      identifiers = [
        "lambda.amazonaws.com"
      ]
    }
  }
}

# allow to write logs to CloudWatch
data "aws_iam_policy_document" "lambda_policy" {
  statement {
    sid    = "AllowLambdaToWriteLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = [
      "arn:aws:logs:*:*:*"
    ]
  }

  statement {
    sid    = "AllowLambdaVpcAccess"
    effect = "Allow"
    actions = [
      "ec2:CreateNetworkInterface",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DeleteNetworkInterface"
    ]
    resources = ["*"]
  }
}

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


data "aws_vpc" "vpc" {
  filter {
    name   = "tag:Name"
    values = [local.vpc_name]
  }
}

#Get application subnet IDs
data "aws_subnets" "application" {
  filter {
    name   = "tag:Name"
    values = [local.application_subnet_pattern]
  }
}