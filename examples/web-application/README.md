# Web Application Example

This example demonstrates LMAY usage for a full-stack e-commerce web application with React frontend and Express.js backend.

## 🏗️ Project Structure

```
web-application/
├── root.lmay              # Main LMAY documentation
├── client.lmay            # Frontend module documentation
├── server.lmay            # Backend module documentation
├── package.json           # Root package configuration
├── client/                # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/         # Page-level components
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API client services
│   └── package.json
├── server/                # Express.js backend
│   ├── controllers/       # Request handlers
│   ├── models/           # Database schemas
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route definitions
│   └── utils/            # Helper utilities
├── shared/               # Shared code between client/server
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Common utilities
├── tests/               # Test suites
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/           # End-to-end tests
├── scripts/            # Build and deployment scripts
├── docs/              # Project documentation
└── config/            # Configuration files
```

## 🚀 Getting Started

### 1. Installation
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Development
```bash
# Start both client and server in development mode
npm run dev

# Or start separately
npm run server:dev  # Backend on port 3001
npm run client:dev  # Frontend on port 3000
```

### 3. Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:server     # Backend tests
npm run test:client     # Frontend tests
npm run test:e2e        # End-to-end tests
```

### 4. Building and Deployment
```bash
# Build for production
npm run client:build

# Deploy to different environments
npm run deploy development
npm run deploy staging
npm run deploy production
```

## 🔧 LMAY Tools Usage

### Generate LMAY Documentation
```bash
# Generate for the entire project
node ../../tools/generator/src/cli.js --input . --output .

# Generate for specific modules
node ../../tools/generator/src/cli.js --input client --output client
node ../../tools/generator/src/cli.js --input server --output server
```

### Validate LMAY Files
```bash
# Validate main documentation
node ../../tools/validator/src/cli.js root.lmay --verbose

# Validate entire project
node ../../tools/validator/src/cli.js --project . --strict

# Generate SARIF report
node ../../tools/validator/src/cli.js --project . --format sarif --output validation-report.sarif
```

## 📚 Learning Points

### 1. Hierarchical LMAY Structure
- **root.lmay** - Main project documentation
- **client.lmay** - Frontend module with parent reference
- **server.lmay** - Backend module with parent reference
- Clear parent-child relationships using `hierarchy` section

### 2. Complex Architecture Documentation
- MVC pattern identification
- Multiple entry points (server, client, scripts)
- Inter-module dependencies and interfaces
- Technology stack specification

### 3. Interface Documentation
- REST API endpoints
- WebSocket connections
- Database connections
- External service integrations

### 4. Multi-Language Support
- JavaScript, TypeScript, CSS, HTML
- Framework-specific configurations
- Build tool integration

## 🎯 Key Features Demonstrated

### Architecture Patterns
- **MVC Pattern** - Clear separation of concerns
- **Component-Based** - React component architecture
- **API-First** - REST API design
- **Event-Driven** - WebSocket integration

### Best Practices
- Modular LMAY documentation
- Clear interface definitions
- Comprehensive dependency tracking
- Environment-specific configurations

### Advanced LMAY Features
- Module hierarchy with parent references
- Multiple interface types
- Complex dependency relationships
- Deployment environment documentation

## 🔍 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)

### Orders
- `GET /api/orders` - User's orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Order details

### Users
- `GET /api/users/profile` - User profile
- `PUT /api/users/profile` - Update profile

## 🔧 Configuration

### Environment Variables
```bash
# Server
PORT=3001
NODE_ENV=production
DATABASE_URL=mongodb://localhost:27017/ecommerce
JWT_SECRET=your-secret-key

# Client
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_STRIPE_KEY=pk_test_...
```

### Database Setup
```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Seed database
npm run db:seed
```

## 📈 Monitoring and Analytics

The application includes:
- Request logging and metrics
- Error tracking and reporting  
- Performance monitoring
- User analytics
- API usage statistics

---

*This example showcases advanced LMAY features for complex web applications with multiple modules, interfaces, and deployment environments.*