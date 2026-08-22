variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name used as the dynamic origin."
  type        = string
}

variable "assets_bucket_id" {
  type = string
}

variable "assets_bucket_arn" {
  type = string
}

variable "assets_bucket_regional_domain_name" {
  type = string
}

variable "web_acl_arn" {
  description = "CloudFront-scoped WAF web ACL ARN (from the security module)."
  type        = string
}

variable "alb_origin_protocol_policy" {
  description = "How CloudFront connects to the ALB origin. https-only once the ALB has a cert."
  type        = string
  default     = "https-only"
}

variable "domain_name" {
  description = "Primary domain (e.g. hotel.example.com). Empty = use the default CloudFront domain/cert (staging scaffold)."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM cert in us-east-1 for the custom domain. Required only when domain_name is set."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone id for the domain. Empty = skip DNS records."
  type        = string
  default     = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}
