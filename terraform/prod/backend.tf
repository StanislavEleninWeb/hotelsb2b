# Remote state in S3 with a DynamoDB lock table (created by terraform/bootstrap).
# STUB: prod is scaffolded but NOT applied. Fill in before first use.
#   terraform init -backend=false   # to validate only
terraform {
  backend "s3" {
    bucket         = "hotel-terraform-state-CHANGE-ME"
    key            = "prod/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "hotel-terraform-locks"
    encrypt        = true
  }
}
