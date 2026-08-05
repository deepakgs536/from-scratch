resource "aws_dynamodb_table" "products" {
  name           = "dynamo-${var.environment}-${var.project_name}-products"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "productId"

  attribute {
    name = "productId"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name               = "CategoryIndex"
    hash_key           = "category"
    projection_type    = "ALL"
  }
}

resource "aws_dynamodb_table" "inventory" {
  name           = "dynamo-${var.environment}-${var.project_name}-inventory"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "productId"

  attribute {
    name = "productId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "carts" {
  name           = "dynamo-${var.environment}-${var.project_name}-carts"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "orders" {
  name           = "dynamo-${var.environment}-${var.project_name}-orders"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name               = "UserOrdersIndex"
    hash_key           = "userId"
    projection_type    = "ALL"
  }
}

resource "aws_dynamodb_table" "payments" {
  name           = "dynamo-${var.environment}-${var.project_name}-payments"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "paymentId"

  attribute {
    name = "paymentId"
    type = "S"
  }

  attribute {
    name = "orderId"
    type = "S"
  }

  global_secondary_index {
    name               = "GSI1"
    hash_key           = "orderId"
    projection_type    = "ALL"
  }
}

resource "aws_dynamodb_table" "analytics" {
  name           = "dynamo-${var.environment}-${var.project_name}-analytics"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  
  attribute {
    name = "SK"
    type = "S"
  }
}

resource "aws_dynamodb_table" "users" {
  name           = "dynamo-${var.environment}-${var.project_name}-users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "notifications" {
  name           = "dynamo-${var.environment}-${var.project_name}-notifications"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}
