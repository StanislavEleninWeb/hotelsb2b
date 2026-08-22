output "kms_key_arn" {
  value = aws_kms_key.main.arn
}

output "kms_key_id" {
  value = aws_kms_key.main.key_id
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "db_username" {
  value = "hotel_app"
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}

output "redis_secret_arn" {
  value = aws_secretsmanager_secret.redis.arn
}

output "redis_auth_token" {
  value     = random_password.redis.result
  sensitive = true
}

output "waf_web_acl_arn" {
  value = aws_wafv2_web_acl.cdn.arn
}

output "third_party_secret_arns" {
  value = { for k, s in aws_secretsmanager_secret.third_party : k => s.arn }
}
