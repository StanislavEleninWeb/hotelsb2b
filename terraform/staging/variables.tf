variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.10.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["eu-west-1a", "eu-west-1b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.10.0.0/24", "10.10.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.10.10.0/24", "10.10.11.0/24"]
}

variable "assets_bucket_name" {
  description = "Globally-unique S3 bucket name for assets/uploads."
  type        = string
}

variable "domain_name" {
  description = "Primary domain. Empty for the default CloudFront domain (staging)."
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "us-east-1 ACM cert ARN for the CloudFront custom domain (optional)."
  type        = string
  default     = ""
}

variable "alb_certificate_arn" {
  description = "Regional ACM cert ARN for the ALB HTTPS listener (optional in staging)."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone id (optional; empty skips DNS records)."
  type        = string
  default     = ""
}
