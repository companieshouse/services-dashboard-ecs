locals {

  service_name         = "services-dashboard-ecs"
  stack_name           = "rand-pocs-stack"
  lambda_function_name = "${local.service_name}-${var.environment}"
  stack_secrets_path   = "applications/${var.aws_profile}/${var.environment}/${local.stack_name}"
  service_secrets_path = "${local.stack_secrets_path}/services-dashboard"
  ssm_prefix           = "/services-dashboard" # shared by API and WEB

  vpc_name                   = local.vault_secrets["vpc_name"]
  application_subnet_ids     = data.aws_subnets.application.ids
  application_subnet_pattern = local.vault_secrets["application_subnet_pattern"]

  # Secrets
  stack_secrets   = jsondecode(data.vault_generic_secret.stack_secrets.data_json)
  service_secrets = jsondecode(data.vault_generic_secret.service_secrets.data_json)

  # Create a single map of secrets merging "stack" & "service" secrets.
  # Note: in case a secret with the same name is present in "stack" and "service"
  # the "service"'s value will overwrite the "stack"'s value.
  # This allows the normal practice of having (global) secrets as defaults
  # which can be overwritten by service specific needs
  vault_secrets = merge(local.stack_secrets, local.service_secrets)

}
