resource "aws_api_gateway_rest_api" "shared_rest_gateway" {
  count       = var.api_gateway_type == "rest" ? 1 : 0
  name        = "api-${var.environment}-${var.project_name}-rest-gateway"
  description = "REST API Gateway for Ecommerce"
}

resource "aws_api_gateway_deployment" "rest_deployment" {
  count       = var.api_gateway_type == "rest" ? 1 : 0
  rest_api_id = aws_api_gateway_rest_api.shared_rest_gateway[0].id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "rest_stage" {
  count         = var.api_gateway_type == "rest" ? 1 : 0
  deployment_id = aws_api_gateway_deployment.rest_deployment[0].id
  rest_api_id   = aws_api_gateway_rest_api.shared_rest_gateway[0].id
  stage_name    = var.environment
  xray_tracing_enabled = true
}
