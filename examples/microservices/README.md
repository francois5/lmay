# Microservices Architecture Example

This example demonstrates LMAY usage for a complex distributed e-commerce platform built with microservices architecture.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  Load Balancer   │────│   Client Apps   │
│   (Express.js)  │    │     (Nginx)      │    │ (Web/Mobile)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
          │
          ├─────────────────────────────────────────────────────────┐
          │                                                         │
    ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐
    │   User   │  │   Product    │  │    Order     │  │   Payment       │
    │ Service  │  │   Service    │  │   Service    │  │   Service       │
    │(Node.js) │  │  (Python)    │  │    (Go)      │  │  (Node.js)      │
    └──────────┘  └──────────────┘  └──────────────┘  └─────────────────┘
          │              │                │                    │
    ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐
    │ MongoDB  │  │ PostgreSQL   │  │ PostgreSQL   │  │   PostgreSQL    │
    │          │  │ + Redis      │  │ + Redis      │  │                 │
    │          │  │ + Elastic    │  │ + Temporal   │  │                 │
    └──────────┘  └──────────────┘  └──────────────┘  └─────────────────┘
```

## 📁 Project Structure

```
microservices/
├── root.lmay                 # Main microservices documentation
├── docker-compose.yml        # Local development environment
├── api-gateway/              # API Gateway service
│   ├── api-gateway.lmay     # Gateway-specific documentation
│   └── index.js             # Gateway implementation
├── services/                 # Individual microservices
│   ├── user-service/        # User management service
│   │   ├── user-service.lmay
│   │   └── src/
│   ├── product-service/     # Product catalog service
│   │   ├── product-service.lmay
│   │   └── app/
│   ├── order-service/       # Order processing service
│   │   ├── order-service.lmay
│   │   └── internal/
│   ├── payment-service/     # Payment processing
│   └── notification-service/ # Email/SMS notifications
├── shared/                  # Shared libraries and utilities
│   ├── auth/               # Authentication utilities
│   ├── logger/             # Centralized logging
│   ├── metrics/            # Metrics collection
│   └── events/             # Event schemas and handlers
├── infrastructure/         # Infrastructure as Code
│   ├── terraform/          # AWS/GCP infrastructure
│   ├── ansible/           # Configuration management
│   └── monitoring/        # Prometheus, Grafana configs
└── kubernetes/            # K8s deployment manifests
    ├── deployments/
    ├── services/
    └── ingress/
```

## 🚀 Getting Started

### 1. Prerequisites
```bash
# Required tools
docker --version          # Docker 24+
docker-compose --version  # Docker Compose 2+
kubectl version          # Kubernetes CLI (optional)
```

### 2. Local Development Setup
```bash
# Clone and navigate to project
cd examples/microservices

# Start all services with Docker Compose
docker-compose up -d

# Check service health
curl http://localhost:3000/health

# View logs
docker-compose logs -f api-gateway
docker-compose logs -f user-service
```

### 3. Service Endpoints
```bash
# API Gateway (main entry point)
curl http://localhost:3000/health

# Individual services (direct access for development)
curl http://localhost:3001/health  # User Service
curl http://localhost:8000/health  # Product Service
curl http://localhost:8080/health  # Order Service
curl http://localhost:3002/health  # Payment Service
curl http://localhost:8001/health  # Notification Service
```

### 4. Monitoring Dashboard
```bash
# Prometheus metrics
open http://localhost:9090

# Grafana dashboards
open http://localhost:3030  # admin/admin

# Jaeger tracing
open http://localhost:16686

# RabbitMQ management
open http://localhost:15672  # admin/password
```

## 🔧 LMAY Tools Usage

### Generate Complete Documentation
```bash
# Generate LMAY for entire microservices project
node ../../tools/generator/src/cli.js --input . --output .

# Generate for individual services
node ../../tools/generator/src/cli.js --input services/user-service --output services/user-service
node ../../tools/generator/src/cli.js --input services/product-service --output services/product-service
```

### Validate Microservices Documentation
```bash
# Validate main project documentation
node ../../tools/validator/src/cli.js root.lmay --verbose

# Validate entire project structure
node ../../tools/validator/src/cli.js --project . --strict

# Generate SARIF report for CI/CD integration
node ../../tools/validator/src/cli.js --project . --format sarif --output validation-report.sarif

# Validate individual service documentation
node ../../tools/validator/src/cli.js services/user-service/user-service.lmay
```

## 📚 Advanced LMAY Features Demonstrated

### 1. Multi-Level Hierarchy
- **root.lmay** - Main microservices architecture
- **service.lmay** - Individual service documentation
- Clear parent-child relationships across services
- Service discovery and dependency mapping

### 2. Complex Interface Documentation
- **REST APIs** - Internal and external endpoints
- **Message Queues** - Event-driven communication
- **Databases** - Multiple database types per service
- **Service Mesh** - Inter-service communication

### 3. Technology Stack Diversity
- **Node.js** - API Gateway, User Service, Payment Service
- **Python** - Product Service, Notification Service
- **Go** - Order Service with Temporal workflows
- **Multiple Databases** - MongoDB, PostgreSQL, Redis, Elasticsearch

### 4. Deployment and Operations
- **Docker Compose** - Local development
- **Kubernetes** - Production deployment
- **Infrastructure as Code** - Terraform configurations
- **Monitoring Stack** - Prometheus, Grafana, Jaeger

## 🔍 Service Details

### API Gateway (Port 3000)
- **Technology**: Express.js + Redis
- **Role**: Request routing, authentication, rate limiting
- **Features**: JWT auth, circuit breakers, health checks

### User Service (Port 3001)
- **Technology**: Express.js + MongoDB
- **Role**: User management and authentication
- **Features**: JWT tokens, password hashing, user profiles

### Product Service (Port 8000)
- **Technology**: FastAPI + PostgreSQL + Elasticsearch + Redis
- **Role**: Product catalog and search
- **Features**: Full-text search, caching, inventory tracking

### Order Service (Port 8080)
- **Technology**: Go + PostgreSQL + Temporal + Redis
- **Role**: Order processing and workflow management
- **Features**: Saga patterns, state machines, event sourcing

### Payment Service (Port 3002)
- **Technology**: Express.js + PostgreSQL + Stripe
- **Role**: Payment processing and billing
- **Features**: Stripe integration, PCI compliance, webhooks

### Notification Service (Port 8001)
- **Technology**: FastAPI + PostgreSQL + SMTP
- **Role**: Email, SMS, and push notifications
- **Features**: Template engine, delivery tracking, preferences

## 🔄 Event-Driven Architecture

### Event Flow Examples
```
User Registration:
user-service → user.created → notification-service → welcome email

Order Placement:
order-service → order.created → product-service (inventory)
              → payment-service → payment.completed → order.confirmed

Product Updates:
product-service → product.updated → search index update
                → cache invalidation → user notifications
```

### Message Queue Topics
- `user-events` - User lifecycle events
- `product-events` - Product catalog changes
- `order-events` - Order state transitions
- `payment-events` - Payment status updates
- `notification-events` - Delivery confirmations

## 🚢 Deployment

### Docker Compose (Development)
```bash
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose logs -f service    # View service logs
docker-compose exec service bash # Access service container
```

### Kubernetes (Production)
```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/

# Check deployment status
kubectl get pods -n ecommerce

# Scale services
kubectl scale deployment user-service --replicas=3

# View service logs
kubectl logs -f deployment/api-gateway
```

### Infrastructure as Code
```bash
# Provision AWS infrastructure
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# Configure services with Ansible
cd ../ansible
ansible-playbook -i inventory deploy.yml
```

## 📊 Monitoring and Observability

### Metrics Collection
- **Prometheus** - Service metrics and alerting
- **Grafana** - Visualization dashboards
- **Custom metrics** - Business KPIs and SLAs

### Distributed Tracing
- **Jaeger** - Request tracing across services
- **OpenTelemetry** - Instrumentation and data collection
- **Performance profiling** - Bottleneck identification

### Logging Strategy
- **Centralized logging** - ELK stack (Elasticsearch, Logstash, Kibana)
- **Structured logs** - JSON format with correlation IDs
- **Log aggregation** - Cross-service request tracking

## 💡 Best Practices Demonstrated

### Microservices Patterns
- **API Gateway** - Single entry point
- **Service Discovery** - Dynamic service location
- **Circuit Breaker** - Fault tolerance
- **Saga Pattern** - Distributed transactions
- **Event Sourcing** - Audit trail and replay

### LMAY Documentation Patterns
- **Service isolation** - Independent LMAY files per service
- **Interface contracts** - Clear API documentation
- **Dependency mapping** - Service relationship visualization
- **Technology diversity** - Multi-language support

### DevOps Integration
- **CI/CD pipelines** - Automated testing and deployment
- **Infrastructure monitoring** - Health checks and alerting
- **Security scanning** - Vulnerability assessment
- **Performance testing** - Load and stress testing

## 🔒 Security Considerations

### Authentication & Authorization
- **JWT tokens** - Stateless authentication
- **Role-based access** - Service-level permissions
- **API rate limiting** - DDoS protection
- **Input validation** - Data sanitization

### Network Security
- **Service mesh** - mTLS between services
- **API Gateway** - External traffic filtering
- **Network policies** - Kubernetes security
- **Secrets management** - Environment variable encryption

---

*This example showcases enterprise-grade microservices architecture documentation with LMAY, demonstrating complex distributed systems, event-driven communication, and comprehensive operational patterns.*