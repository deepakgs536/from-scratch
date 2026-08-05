resource "aws_sns_topic" "product_events" {
  name = "sns-${var.environment}-${var.project_name}-product-events"
}

resource "aws_sns_topic" "inventory_events" {
  name = "sns-${var.environment}-${var.project_name}-inventory-events"
}

resource "aws_sns_topic" "order_events" {
  name = "sns-${var.environment}-${var.project_name}-order-events"
}

resource "aws_sns_topic" "payment_events" {
  name = "sns-${var.environment}-${var.project_name}-payment-events"
}

resource "aws_sqs_queue" "order_queue" {
  name = "sqs-${var.environment}-${var.project_name}-order-queue"
}

resource "aws_sns_topic" "user_events" {
  name = "sns-${var.environment}-${var.project_name}-user-events"
}

resource "aws_sqs_queue" "analytics_queue" {
  name = "sqs-${var.environment}-${var.project_name}-analytics-queue"
}

resource "aws_sqs_queue" "inventory_queue" {
  name = "sqs-${var.environment}-${var.project_name}-inventory-queue"
}

resource "aws_sqs_queue" "payment_queue" {
  name = "sqs-${var.environment}-${var.project_name}-payment-queue"
}

resource "aws_sqs_queue" "user_queue" {
  name = "sqs-${var.environment}-${var.project_name}-user-queue"
}

# --- SUBSCRIPTIONS ---

# Subscriptions for Product Events
resource "aws_sns_topic_subscription" "product_to_analytics" {
  topic_arn = aws_sns_topic.product_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.analytics_queue.arn
}
resource "aws_sns_topic_subscription" "product_to_inventory" {
  topic_arn = aws_sns_topic.product_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.inventory_queue.arn
}

# Subscriptions for Inventory Events
resource "aws_sns_topic_subscription" "inventory_to_analytics" {
  topic_arn = aws_sns_topic.inventory_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.analytics_queue.arn
}

# Subscriptions for Payment Events
resource "aws_sns_topic_subscription" "payment_to_order" {
  topic_arn = aws_sns_topic.payment_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.order_queue.arn
}
resource "aws_sns_topic_subscription" "payment_to_inventory" {
  topic_arn = aws_sns_topic.payment_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.inventory_queue.arn
}

# Subscriptions for User Events
resource "aws_sns_topic_subscription" "user_to_user_queue" {
  topic_arn = aws_sns_topic.user_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.user_queue.arn
}

# Subscriptions for Order Events
resource "aws_sns_topic_subscription" "order_to_inventory" {
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.inventory_queue.arn
}
resource "aws_sns_topic_subscription" "order_to_payment" {
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.payment_queue.arn
}

# --- QUEUE POLICIES (Allow SNS to write to SQS) ---

resource "aws_sqs_queue_policy" "analytics_queue_policy" {
  queue_url = aws_sqs_queue.analytics_queue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.analytics_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = [
              aws_sns_topic.product_events.arn,
              aws_sns_topic.inventory_events.arn
            ]
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "inventory_queue_policy" {
  queue_url = aws_sqs_queue.inventory_queue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.inventory_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = [
              aws_sns_topic.product_events.arn,
              aws_sns_topic.payment_events.arn,
              aws_sns_topic.order_events.arn
            ]
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "order_queue_policy" {
  queue_url = aws_sqs_queue.order_queue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.order_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.payment_events.arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "payment_queue_policy" {
  queue_url = aws_sqs_queue.payment_queue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.payment_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.order_events.arn
          }
        }
      }
    ]
  })
}

resource "aws_sqs_queue_policy" "user_queue_policy" {
  queue_url = aws_sqs_queue.user_queue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.user_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.user_events.arn
          }
        }
      }
    ]
  })
}

# --- NOTIFICATION QUEUE ---
resource "aws_sqs_queue" "notification_queue" {
  name = "sqs-${var.environment}-${var.project_name}-notification-queue"
}

resource "aws_sns_topic_subscription" "order_to_notification" {
  topic_arn = aws_sns_topic.order_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.notification_queue.arn
}

resource "aws_sqs_queue_policy" "notification_queue_policy" {
  queue_url = aws_sqs_queue.notification_queue.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "sns.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.notification_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.order_events.arn
          }
        }
      }
    ]
  })
}

# --- EVENT SOURCE MAPPINGS ---
resource "aws_lambda_event_source_mapping" "sqs_triggers" {
  for_each = {
    analytics    = aws_sqs_queue.analytics_queue.arn
    inventory    = aws_sqs_queue.inventory_queue.arn
    order        = aws_sqs_queue.order_queue.arn
    payment      = aws_sqs_queue.payment_queue.arn
    user         = aws_sqs_queue.user_queue.arn
    notification = aws_sqs_queue.notification_queue.arn
  }

  event_source_arn = each.value
  function_name    = aws_lambda_function.service_lambda[each.key].arn
  batch_size       = 10
}
