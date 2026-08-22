# Production environment — SAME modules as staging, but Multi-AZ RDS, HA Redis,
# one NAT per AZ, larger instances, deletion protection on.
# STUB: scaffolded, not applied. Wire real domain/cert/state values first.

locals {
  name_prefix = "hotel-${var.environment}"
  common_tags = {
    Project     = "hotel-booking"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "security" {
  source      = "../modules/security"
  name_prefix = local.name_prefix
  tags        = local.common_tags
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

module "network" {
  source               = "../modules/network"
  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  single_nat_gateway   = false # prod: one NAT per AZ (HA)
  tags                 = local.common_tags
}

module "compute" {
  source            = "../modules/compute"
  name_prefix       = local.name_prefix
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  certificate_arn   = var.alb_certificate_arn
  staff_host_header = var.domain_name != "" ? "staff.${var.domain_name}" : "staff.example.com"
  tags              = local.common_tags
}

module "database" {
  source                     = "../modules/database"
  name_prefix                = local.name_prefix
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  ingress_security_group_ids = [module.compute.app_security_group_id]
  kms_key_arn                = module.security.kms_key_arn
  db_username                = module.security.db_username
  db_password                = module.security.db_password
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  multi_az                   = true # prod: Multi-AZ
  backup_retention_days      = 30
  deletion_protection        = true
  tags                       = local.common_tags
}

module "cache" {
  source                     = "../modules/cache"
  name_prefix                = local.name_prefix
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  ingress_security_group_ids = [module.compute.app_security_group_id]
  kms_key_arn                = module.security.kms_key_arn
  auth_token                 = module.security.redis_auth_token
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_clusters # prod: HA
  tags                       = local.common_tags
}

module "storage" {
  source      = "../modules/storage"
  name_prefix = local.name_prefix
  bucket_name = var.assets_bucket_name
  kms_key_arn = module.security.kms_key_arn
  tags        = local.common_tags
}

module "cdn" {
  source                             = "../modules/cdn"
  name_prefix                        = local.name_prefix
  alb_dns_name                       = module.compute.alb_dns_name
  assets_bucket_id                   = module.storage.bucket_id
  assets_bucket_arn                  = module.storage.bucket_arn
  assets_bucket_regional_domain_name = module.storage.bucket_regional_domain_name
  web_acl_arn                        = module.security.waf_web_acl_arn
  alb_origin_protocol_policy         = var.alb_certificate_arn != "" ? "https-only" : "http-only"
  domain_name                        = var.domain_name
  acm_certificate_arn                = var.acm_certificate_arn
  route53_zone_id                    = var.route53_zone_id
  tags                               = local.common_tags
}
