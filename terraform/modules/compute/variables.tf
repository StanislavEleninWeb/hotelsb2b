variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "certificate_arn" {
  description = "ACM cert ARN for the ALB HTTPS listener. Empty = HTTP-only listener (staging scaffold before DNS/cert exist)."
  type        = string
  default     = ""
}

variable "staff_host_header" {
  description = "Host header routed to the staff app target group."
  type        = string
  default     = "staff.example.com"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
