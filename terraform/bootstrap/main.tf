# Remote-state backend bootstrap. Run this ONCE per AWS account before the
# staging/prod environments (which use these as their S3 backend). Uses a local
# backend itself to avoid the chicken-and-egg problem.
#
#   cd terraform/bootstrap && terraform init && terraform apply

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "state_bucket_name" {
  type = string
}

variable "lock_table_name" {
  type    = string
  default = "hotel-terraform-locks"
}

provider "aws" {
  region = var.aws_region
}

# tfsec:ignore:aws-s3-enable-bucket-logging State bucket; access is audited via CloudTrail, not S3 access logs.
# tfsec:ignore:aws-s3-encryption-customer-key Bootstrap runs before the shared CMK exists; AWS-managed SSE-KMS.
resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name
  tags   = { Purpose = "terraform-remote-state" }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# tfsec:ignore:aws-s3-encryption-customer-key
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    # Bootstrap runs before the shared CMK exists; AWS-managed SSE-KMS.
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# tfsec:ignore:aws-dynamodb-table-customer-key Lock table holds only ephemeral lock IDs; AWS-managed encryption suffices.
resource "aws_dynamodb_table" "locks" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
  server_side_encryption {
    enabled = true
  }
  point_in_time_recovery {
    enabled = true
  }
  tags = { Purpose = "terraform-state-lock" }
}

output "state_bucket" {
  value = aws_s3_bucket.state.id
}

output "lock_table" {
  value = aws_dynamodb_table.locks.name
}
