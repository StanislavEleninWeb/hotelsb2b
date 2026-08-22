# Remote state in S3 with a DynamoDB lock table (created by terraform/bootstrap).
# Fill in the bucket created by bootstrap. For validation without a backend:
#   terraform init -backend=false
terraform {
  backend "s3" {
    bucket         = "hotel-terraform-state-CHANGE-ME"
    key            = "staging/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "hotel-terraform-locks"
    encrypt        = true
  }
}
