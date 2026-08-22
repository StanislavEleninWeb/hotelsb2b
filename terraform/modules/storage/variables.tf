variable "name_prefix" {
  description = "Prefix for all resource names."
  type        = string
}

variable "bucket_name" {
  description = "Globally-unique name for the assets/uploads bucket."
  type        = string
}

variable "kms_key_arn" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
