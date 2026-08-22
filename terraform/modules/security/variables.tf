variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "waf_rate_limit" {
  description = "Requests per 5-minute window per IP before the rate-based rule blocks."
  type        = number
  default     = 2000
}

variable "third_party_secret_names" {
  description = "Logical names of third-party API-key secrets to pre-create as empty placeholders (real values injected out-of-band, never in TF)."
  type        = list(string)
  default = [
    "elevenlabs-webhook",
    "telnyx-api",
    "stripe-api",
    "stripe-webhook",
  ]
}

variable "recovery_window_days" {
  description = "Secrets Manager deletion recovery window."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
