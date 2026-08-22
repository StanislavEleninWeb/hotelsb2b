# ECS Fargate cluster skeleton + ALB in public subnets + app SG + IAM roles.
# Task definitions and services are created by the deploy pipeline (Phase 10);
# this module provides the stable infra they attach to.

locals {
  use_https = var.certificate_arn != ""
  services  = ["web", "api", "staff"]
  ports = {
    web   = 3000
    api   = 4000
    staff = 3001
  }
}

# --- Security groups ---
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "Public ALB: HTTP/HTTPS in, app tier out."
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

# The ONLY 0.0.0.0/0 ingress in the design — public HTTP/HTTPS on the ALB.
# tfsec:ignore:aws-ec2-no-public-ingress-sgr Public web endpoint by design (443).
resource "aws_security_group_rule" "alb_https_in" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
  description       = "Public HTTPS"
}

# tfsec:ignore:aws-ec2-no-public-ingress-sgr Public web endpoint by design (80, redirected to 443).
resource "aws_security_group_rule" "alb_http_in" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
  description       = "Public HTTP (redirected to HTTPS)"
}

resource "aws_security_group_rule" "alb_to_app" {
  type                     = "egress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.app.id
  description              = "ALB to application tasks"
}

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app-sg"
  description = "ECS Fargate tasks: traffic from ALB only."
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-app-sg" })
}

resource "aws_security_group_rule" "app_from_alb" {
  for_each                 = local.ports
  type                     = "ingress"
  from_port                = each.value
  to_port                  = each.value
  protocol                 = "tcp"
  security_group_id        = aws_security_group.app.id
  source_security_group_id = aws_security_group.alb.id
  description              = "From ALB to ${each.key}"
}

# App tier needs outbound for ECR image pulls, AWS APIs, and third-party APIs (Stripe, ElevenLabs) over TLS.
# tfsec:ignore:aws-ec2-no-public-egress-sgr
resource "aws_security_group_rule" "app_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.app.id
  description       = "Outbound for image pulls, AWS APIs, DB/Redis, third-party APIs"
}

# --- ECS cluster ---
resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# --- Per-service CloudWatch log groups ---
# tfsec:ignore:aws-cloudwatch-log-group-customer-key Staging: AWS-managed at-rest encryption. Prod wires the shared CMK.
resource "aws_cloudwatch_log_group" "svc" {
  for_each          = toset(local.services)
  name              = "/ecs/${var.name_prefix}/${each.value}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# --- IAM: task execution role (pull images, write logs, read secrets) ---
data "aws_iam_policy_document" "task_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Application task role (least-privilege app permissions attached per-service later).
resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
  tags               = var.tags
}

# --- ALB ---
# tfsec:ignore:aws-elb-alb-not-public Internet-facing by design (public web + CloudFront origin).
resource "aws_lb" "this" {
  name                       = "${var.name_prefix}-alb"
  load_balancer_type         = "application"
  internal                   = false
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true
  enable_deletion_protection = false
  tags                       = var.tags
}

resource "aws_lb_target_group" "svc" {
  for_each    = local.ports
  name        = "${var.name_prefix}-${each.key}-tg"
  port        = each.value
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = each.key == "api" ? "/api/v1/health" : "/"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = var.tags
}

# HTTPS listener (when a cert exists) — default routes to web.
resource "aws_lb_listener" "https" {
  count             = local.use_https ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.svc["web"].arn
  }
  tags = var.tags
}

# HTTP → redirect to HTTPS when a cert exists.
resource "aws_lb_listener" "http_redirect" {
  count             = local.use_https ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
  tags = var.tags
}

# HTTP-only listener for the pre-cert staging scaffold. Once a cert is supplied,
# the redirect listener above replaces this and all traffic is HTTPS.
# tfsec:ignore:aws-elb-http-not-used Staging-only, before ACM cert/DNS exist.
resource "aws_lb_listener" "http_forward" {
  count             = local.use_https ? 0 : 1
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.svc["web"].arn
  }
  tags = var.tags
}

locals {
  active_listener_arn = local.use_https ? aws_lb_listener.https[0].arn : aws_lb_listener.http_forward[0].arn
}

# /api/* → api target group
resource "aws_lb_listener_rule" "api" {
  listener_arn = local.active_listener_arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.svc["api"].arn
  }
  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
  tags = var.tags
}

# staff host header → staff target group
resource "aws_lb_listener_rule" "staff" {
  listener_arn = local.active_listener_arn
  priority     = 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.svc["staff"].arn
  }
  condition {
    host_header {
      values = [var.staff_host_header]
    }
  }
  tags = var.tags
}
