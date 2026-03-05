locals {

  service_name         = "services-dashboard-ecs"
  stack_name           = "dev-tools-stack"
  lambda_function_name = local.service_name
  kms_alias            = "alias/aws/ssm"
  json_folder          = "input_json/${var.aws_profile}/${var.environment}"
  ssm_prefix           = "/${local.service_name}"

  vpc_name                     = local.stack_secrets["vpc_name"]
  lambda_vpc_access_subnet_ids = data.aws_subnets.application.ids
  application_subnet_pattern   = local.stack_secrets["application_subnet_pattern"]

  additional_iam_policies_json = [data.aws_iam_policy_document.ssm_access_policy.json]

  lambda_cloudwatch_event_rules = [
    {
      name                = "${local.lambda_function_name}-${var.environment}-loadall"
      description         = "Trigger Lambda at regular intervals"
      schedule_expression = "cron(55 6-17 ? * MON-FRI *)"
      target_input        = data.local_file.daily_load_all.content
    }
  ]

  # Secrets
  stack_secrets        = data.vault_generic_secret.stack_secrets.data
  stack_secrets_path   = "applications/${var.aws_profile}/${var.environment}/${local.stack_name}"
  service_secrets      = data.vault_generic_secret.service_secrets.data
  service_secrets_path = "${local.stack_secrets_path}/services-dashboard"
}
