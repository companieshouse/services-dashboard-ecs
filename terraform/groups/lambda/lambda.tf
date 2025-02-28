
# Create an IAM role for the Lambda function
resource "aws_iam_role" "lambda_execution_role" {
  name               = "${local.lambda_function_name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
}

# To attach the managed policy: AWSLambdaVPCAccessExecutionRole,
# (which contains the required permissions for VPC access).
resource "aws_iam_role_policy_attachment" "vpc_access_policy_attachment" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Create a policy to attach to the IAM role for the Lambda function
resource "aws_iam_role_policy" "lambda_execution_role_policy" {
  name = "${local.lambda_function_name}-log-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = data.aws_iam_policy_document.lambda_policy.json
}


# Create a policy to allow Lambda to access SSM Parameter Store
resource "aws_iam_policy" "ssm_access_policy" {
  name        = "${local.lambda_function_name}-access-policy"
  description = "Policy to allow Lambda access to SSM Parameter Store"

  policy = data.aws_iam_policy_document.ssm_access_policy.json
}

# Attach the SSM access policy to the Lambda execution role
resource "aws_iam_role_policy_attachment" "ssm_policy_attachment" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.ssm_access_policy.arn
}

# SSM Parameters
resource "aws_ssm_parameter" "secrets" {

  name  = "${local.ssm_prefix}/mongo.password.secret"
  value = local.vault_secrets["mongo.password"]
  type  = "SecureString"
}


# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/${local.lambda_function_name}"
  retention_in_days = var.lambda_logs_retention_days
}

# Create a policy to allow Lambda to access ECS
resource "aws_iam_policy" "ecs_operations_policy" {
  name   = "${local.lambda_function_name}-ecs-operations-policy"
  policy = data.aws_iam_policy_document.ecs_operations_policy.json
}

# Attach the ECS access policy to the Lambda execution role
resource "aws_iam_role_policy_attachment" "ecs_operations_policy_attachment" {
  role       = aws_iam_role.lambda_execution_role.name
  # policy_arn = aws_iam_policy.ecs_operations_policy.arn
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_lambda_function" "python_test" {
  depends_on = [aws_cloudwatch_log_group.lambda_log_group, aws_vpc_endpoint.ecs]

  function_name = "python_test_ecs"
  role          = aws_iam_role.lambda_execution_role.arn

  s3_bucket = var.release_bucket_name
  s3_key    = "python_test_ecs.zip"

  handler = "lambda_function.lambda_handler"
  runtime = "python3.8"

  vpc_config {
    subnet_ids         = local.application_subnet_ids
    security_group_ids = [aws_security_group.services_dashboard_lambda_sg.id]
  }
}

# Create the Lambda function
resource "aws_lambda_function" "node_lambda" {
  depends_on = [aws_cloudwatch_log_group.lambda_log_group, aws_vpc_endpoint.ecs]

  function_name = local.lambda_function_name
  role          = aws_iam_role.lambda_execution_role.arn

  s3_bucket = var.release_bucket_name
  s3_key    = var.release_artifact_key

  handler = var.lambda_handler_name
  runtime = var.lambda_runtime

  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout_seconds

  environment {
    variables = {
      MONGO_PROTOCOL                 = local.vault_secrets["mongo.protocol"]
      MONGO_HOST_AND_PORT            = local.vault_secrets["mongo.hostandport"]
      MONGO_USER                     = local.vault_secrets["mongo.user"]
      MONGO_PASSWORD_PARAMSTORE_NAME = "${local.ssm_prefix}/mongo.password.secret"
      MONGO_DB_NAME                  = local.vault_secrets["mongo.dbname"]
      MONGO_COLLECTION_PROJECTS      = local.vault_secrets["mongo.collection.projects"]
      ENV                            = "${var.environment}"
    }
  }

  tags = {
    Name        = local.lambda_function_name
    Environment = var.environment
  }
  vpc_config {
    subnet_ids         = local.application_subnet_ids
    security_group_ids = [aws_security_group.services_dashboard_lambda_sg.id]
  }
}

# Create a CloudWatch Event Rule to trigger the Lambda function at scheduled intervals
resource "aws_cloudwatch_event_rule" "daily_load_all" {
  name                = "${local.lambda_function_name}-loadall"
  description         = "Trigger Lambda at regular intervals"
  schedule_expression = "cron(0 7 ? * MON-FRI *)"
}

# Create a CloudWatch Event Target to trigger the Lambda function
resource "aws_cloudwatch_event_target" "lambda_target" {
  rule = aws_cloudwatch_event_rule.daily_load_all.name
  arn  = aws_lambda_function.node_lambda.arn

  input = jsonencode({
    "action" : "scan"
  })
}
# Allow the CloudWatch Event Rule to trigger the Lambda function
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeToInvokeLambda"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.node_lambda.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_load_all.arn
}

// Add a VPC endpoint to allow the Lambda function to access ECS
resource "aws_vpc_endpoint" "ecs" {
  vpc_id       = data.aws_vpc.vpc.id
  service_name = "com.amazonaws.${var.aws_region}.ecs"
  vpc_endpoint_type = "Interface"
  subnet_ids   = local.application_subnet_ids
  security_group_ids = [aws_security_group.services_dashboard_lambda_sg.id]
  tags = {
    Name = "connect-lambda-on-this-vpc-to-ecs"
  }
}

resource "aws_security_group" "services_dashboard_lambda_sg" {
  name        = "${local.lambda_function_name}-lambda-sg"
  description = "Security group for Lambda function access to VPC resources"
  vpc_id      = data.aws_vpc.vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # temporary for testing
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # temporary for testing
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.lambda_function_name}-lambda"
    Environment = var.environment
  }
}