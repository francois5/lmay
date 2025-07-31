# Global CDN Platform Infrastructure
# Multi-cloud deployment across AWS and GCP with edge locations

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
  
  backend "s3" {
    bucket         = "globalcdn-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# Provider configurations for multi-cloud deployment
provider "aws" {
  region = var.aws_primary_region
  
  default_tags {
    tags = {
      Project     = "global-cdn-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "platform-team"
    }
  }
}

provider "aws" {
  alias  = "us_west"
  region = "us-west-2"
  
  default_tags {
    tags = {
      Project     = "global-cdn-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "platform-team"
    }
  }
}

provider "aws" {
  alias  = "eu_west"
  region = "eu-west-1"
  
  default_tags {
    tags = {
      Project     = "global-cdn-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "platform-team"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_primary_region
}

# Global variables
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "aws_primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_primary_region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

# AWS Infrastructure
module "aws_primary_region" {
  source = "./modules/aws-region"
  
  region      = var.aws_primary_region
  environment = var.environment
  is_primary  = true
  
  # Network configuration
  vpc_cidr = "10.0.0.0/16"
  
  # Kubernetes cluster configuration
  cluster_name    = "globalcdn-primary"
  node_group_size = {
    min     = 3
    max     = 20
    desired = 6
  }
  
  # Edge locations in this region
  edge_locations = [
    {
      city     = "New York"
      capacity = "high"
      az       = "us-east-1a"
    },
    {
      city     = "Virginia"
      capacity = "high"
      az       = "us-east-1b"
    }
  ]
}

module "aws_eu_region" {
  source = "./modules/aws-region"
  
  providers = {
    aws = aws.eu_west
  }
  
  region      = "eu-west-1"
  environment = var.environment
  is_primary  = false
  
  # Network configuration
  vpc_cidr = "10.1.0.0/16"
  
  # Kubernetes cluster configuration
  cluster_name    = "globalcdn-eu"
  node_group_size = {
    min     = 2
    max     = 15
    desired = 4
  }
  
  # Edge locations in this region
  edge_locations = [
    {
      city     = "London"
      capacity = "high"
      az       = "eu-west-1a"
    },
    {
      city     = "Dublin"
      capacity = "medium"
      az       = "eu-west-1b"
    }
  ]
}

# GCP Infrastructure
module "gcp_primary_region" {
  source = "./modules/gcp-region"
  
  project_id  = var.gcp_project_id
  region      = var.gcp_primary_region
  environment = var.environment
  
  # Network configuration
  vpc_cidr = "10.2.0.0/16"
  
  # GKE cluster configuration
  cluster_name = "globalcdn-gcp"
  node_pool_config = {
    min_nodes       = 2
    max_nodes       = 12
    initial_nodes   = 3
    machine_type    = "e2-standard-4"
    disk_size_gb    = 100
    preemptible     = false
  }
  
  # Edge locations in this region
  edge_locations = [
    {
      city     = "Singapore"
      capacity = "medium"
      zone     = "asia-southeast1-a"
    }
  ]
}

# Global networking and CDN
resource "aws_cloudfront_distribution" "global_cdn" {
  origin {
    domain_name = module.aws_primary_region.load_balancer_dns
    origin_id   = "primary-origin"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  # Additional origins for geographic distribution
  origin {
    domain_name = module.aws_eu_region.load_balancer_dns
    origin_id   = "eu-origin"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  # Global cache behavior
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "primary-origin"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = false
      headers      = ["Host", "CloudFront-Viewer-Country"]
      
      cookies {
        forward = "none"
      }
    }
    
    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }
  
  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  # SSL certificate
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.global_cert.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  
  # Custom error pages
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
  
  tags = {
    Name = "global-cdn-distribution"
  }
}

# SSL Certificate for global domain
resource "aws_acm_certificate" "global_cert" {
  domain_name               = "*.globalcdn.com"
  subject_alternative_names = ["globalcdn.com"]
  validation_method         = "DNS"
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = {
    Name = "global-cdn-certificate"
  }
}

# Route 53 hosted zone for global DNS
resource "aws_route53_zone" "global_dns" {
  name = "globalcdn.com"
  
  tags = {
    Name = "global-cdn-dns-zone"
  }
}

# DNS records for geographic routing
resource "aws_route53_record" "api_global" {
  zone_id = aws_route53_zone.global_dns.zone_id
  name    = "api.globalcdn.com"
  type    = "A"
  
  set_identifier = "primary"
  
  alias {
    name                   = aws_cloudfront_distribution.global_cdn.domain_name
    zone_id                = aws_cloudfront_distribution.global_cdn.hosted_zone_id
    evaluate_target_health = false
  }
  
  geolocation_routing_policy {
    continent = "NA"
  }
}

# Global monitoring and observability
module "monitoring_stack" {
  source = "./modules/monitoring"
  
  environment = var.environment
  
  # Prometheus configuration
  prometheus_config = {
    retention_days = 30
    storage_size   = "100Gi"
    replicas       = 2
  }
  
  # Grafana configuration
  grafana_config = {
    admin_password = var.grafana_admin_password
    plugins = [
      "grafana-worldmap-panel",
      "grafana-piechart-panel",
      "grafana-clock-panel"
    ]
  }
  
  # Jaeger tracing configuration
  jaeger_config = {
    storage_type = "elasticsearch"
    retention_days = 7
  }
  
  # Alert manager configuration
  alertmanager_config = {
    slack_webhook_url = var.slack_webhook_url
    pagerduty_key    = var.pagerduty_integration_key
  }
}

# Secrets management with HashiCorp Vault
module "vault_cluster" {
  source = "./modules/vault"
  
  environment = var.environment
  
  # Vault configuration
  vault_config = {
    replicas     = 3
    storage_size = "10Gi"
    auto_unseal  = true
  }
  
  # KMS key for auto-unseal
  kms_key_id = aws_kms_key.vault_unseal.id
  
  # Initial secrets
  initial_secrets = {
    database_passwords = var.database_passwords
    api_keys          = var.external_api_keys
    certificates      = var.ssl_certificates
  }
}

# KMS key for Vault auto-unseal
resource "aws_kms_key" "vault_unseal" {
  description             = "KMS key for Vault auto-unseal"
  deletion_window_in_days = 7
  
  tags = {
    Name = "vault-unseal-key"
  }
}

# Global state outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.global_cdn.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.global_cdn.domain_name
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.global_dns.zone_id
}

output "primary_region_cluster" {
  description = "Primary region EKS cluster information"
  value = {
    name     = module.aws_primary_region.cluster_name
    endpoint = module.aws_primary_region.cluster_endpoint
    region   = var.aws_primary_region
  }
}

output "eu_region_cluster" {
  description = "EU region EKS cluster information"
  value = {
    name     = module.aws_eu_region.cluster_name
    endpoint = module.aws_eu_region.cluster_endpoint
    region   = "eu-west-1"
  }
}

output "gcp_region_cluster" {
  description = "GCP region GKE cluster information"
  value = {
    name     = module.gcp_primary_region.cluster_name
    endpoint = module.gcp_primary_region.cluster_endpoint
    region   = var.gcp_primary_region
  }
}

output "monitoring_endpoints" {
  description = "Monitoring system endpoints"
  value = {
    prometheus = module.monitoring_stack.prometheus_endpoint
    grafana    = module.monitoring_stack.grafana_endpoint
    jaeger     = module.monitoring_stack.jaeger_endpoint
  }
}

output "vault_endpoint" {
  description = "Vault cluster endpoint"
  value       = module.vault_cluster.vault_endpoint
}