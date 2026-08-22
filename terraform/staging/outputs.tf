output "vpc_id" {
  value = module.network.vpc_id
}

output "alb_dns_name" {
  value = module.compute.alb_dns_name
}

output "ecs_cluster_name" {
  value = module.compute.cluster_name
}

output "cloudfront_domain_name" {
  value = module.cdn.distribution_domain_name
}

output "db_endpoint" {
  value = module.database.endpoint
}

output "redis_endpoint" {
  value = module.cache.primary_endpoint
}

output "assets_bucket" {
  value = module.storage.bucket_id
}

output "db_secret_arn" {
  value = module.security.db_secret_arn
}

output "redis_secret_arn" {
  value = module.security.redis_secret_arn
}
