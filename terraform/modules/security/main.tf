# Shared KMS key, generated secrets, and the CloudFront-scoped WAF web ACL.
# The WAF must live in us-east-1 for CLOUDFRONT scope, so this module requires a
# provider alias `aws.us_east_1` supplied by the caller.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

data "aws_caller_identity" "current" {}

# --- Shared KMS key for at-rest encryption (RDS, Redis, S3, Secrets) ---
resource "aws_kms_key" "main" {
  description             = "${var.name_prefix} shared encryption key"
  enable_key_rotation     = true
  deletion_window_in_days = 7
  tags                    = var.tags
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.name_prefix}-main"
  target_key_id = aws_kms_key.main.key_id
}

# --- Generated credentials stored in Secrets Manager ---
resource "random_password" "db" {
  length  = 32
  special = false # RDS master password disallows several special chars; keep it simple.
}

resource "random_password" "redis" {
  length  = 48
  special = false # ElastiCache auth token: alnum only.
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.name_prefix}/db/credentials"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({ username = "hotel_app", password = random_password.db.result })
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "${var.name_prefix}/redis/auth"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({ auth_token = random_password.redis.result })
}

# --- Third-party API key placeholders (empty; real values injected out-of-band) ---
resource "aws_secretsmanager_secret" "third_party" {
  for_each                = toset(var.third_party_secret_names)
  name                    = "${var.name_prefix}/third-party/${each.value}"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = var.recovery_window_days
  tags                    = var.tags
}

# --- WAF web ACL for CloudFront (us-east-1) ---
resource "aws_wafv2_web_acl" "cdn" {
  provider    = aws.us_east_1
  name        = "${var.name_prefix}-cdn-waf"
  description = "CloudFront WAF: managed SQLi/common rules + IP rate limit."
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 0
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-common"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-sqli"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-sqli"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-cdn-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}
