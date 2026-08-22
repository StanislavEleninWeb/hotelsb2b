variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ingress_security_group_ids" {
  description = "Security groups allowed to reach Redis (the ECS app SG)."
  type        = list(string)
}

variable "kms_key_arn" {
  type = string
}

variable "auth_token" {
  description = "Redis AUTH token (from the security module)."
  type        = string
  sensitive   = true
}

variable "node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  description = "1 for staging (single node), 2+ for prod (HA with automatic failover)."
  type        = number
  default     = 1
}

variable "engine_version" {
  type    = string
  default = "7.1"
}

variable "tags" {
  type    = map(string)
  default = {}
}
