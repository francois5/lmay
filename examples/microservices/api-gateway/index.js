#!/usr/bin/env node
/**
 * API Gateway for E-commerce Microservices
 * Handles routing, authentication, rate limiting, and load balancing
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Redis client for rate limiting and caching
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Service discovery configuration
const services = {
  'user-service': {
    target: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    healthCheck: '/health'
  },
  'product-service': {
    target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:8000',
    healthCheck: '/health'
  },
  'order-service': {
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:8080',
    healthCheck: '/health'
  },
  'payment-service': {
    target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002',
    healthCheck: '/health'
  },
  'notification-service': {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8001',
    healthCheck: '/health'
  }
};

// Middleware setup
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    store: new rateLimit.MemoryStore()
  });
};

const generalLimiter = createRateLimiter(15 * 60 * 1000, 1000, 'Too many requests');
const authLimiter = createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts');
const paymentLimiter = createRateLimiter(60 * 60 * 1000, 20, 'Payment rate limit exceeded');

// Apply general rate limiting
app.use('/api', generalLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  const serviceHealth = {};
  
  for (const [serviceName, config] of Object.entries(services)) {
    try {
      const response = await fetch(`${config.target}${config.healthCheck}`);
      serviceHealth[serviceName] = {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - Date.now()
      };
    } catch (error) {
      serviceHealth[serviceName] = {
        status: 'unreachable',
        error: error.message
      };
    }
  }

  const overallHealth = Object.values(serviceHealth).every(s => s.status === 'healthy');
  
  res.status(overallHealth ? 200 : 503).json({
    status: overallHealth ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: serviceHealth,
    version: '1.0.0'
  });
});

// Authentication routes (proxy to user service)
app.use('/api/auth', authLimiter, createProxyMiddleware({
  target: services['user-service'].target,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/auth'
  },
  onError: (err, req, res) => {
    console.error('Auth service error:', err.message);
    res.status(503).json({ error: 'Authentication service unavailable' });
  }
}));

// User service routes (authenticated)
app.use('/api/users', authenticateToken, createProxyMiddleware({
  target: services['user-service'].target,
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/users'
  },
  onError: (err, req, res) => {
    console.error('User service error:', err.message);
    res.status(503).json({ error: 'User service unavailable' });
  }
}));

// Product service routes (public for catalog, authenticated for management)
app.use('/api/products', (req, res, next) => {
  // Public endpoints for browsing products
  if (req.method === 'GET' && !req.path.includes('/admin')) {
    return next();
  }
  // Authenticated endpoints for product management
  return authenticateToken(req, res, next);
}, createProxyMiddleware({
  target: services['product-service'].target,
  changeOrigin: true,
  pathRewrite: {
    '^/api/products': '/products'
  },
  onError: (err, req, res) => {
    console.error('Product service error:', err.message);
    res.status(503).json({ error: 'Product service unavailable' });
  }
}));

// Order service routes (authenticated)
app.use('/api/orders', authenticateToken, createProxyMiddleware({
  target: services['order-service'].target,
  changeOrigin: true,
  pathRewrite: {
    '^/api/orders': '/orders'
  },
  onError: (err, req, res) => {
    console.error('Order service error:', err.message);
    res.status(503).json({ error: 'Order service unavailable' });
  }
}));

// Payment service routes (authenticated with strict rate limiting)
app.use('/api/payments', authenticateToken, paymentLimiter, createProxyMiddleware({
  target: services['payment-service'].target,
  changeOrigin: true,
  pathRewrite: {
    '^/api/payments': '/payments'
  },
  onError: (err, req, res) => {
    console.error('Payment service error:', err.message);
    res.status(503).json({ error: 'Payment service unavailable' });
  }
}));

// Notification service routes (authenticated)
app.use('/api/notifications', authenticateToken, createProxyMiddleware({
  target: services['notification-service'].target,
  changeOrigin: true,
  pathRewrite: {
    '^/api/notifications': '/notifications'
  },
  onError: (err, req, res) => {
    console.error('Notification service error:', err.message);
    res.status(503).json({ error: 'Notification service unavailable' });
  }
}));

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Gateway error:', error);
  res.status(500).json({
    error: 'Internal gateway error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handler
const shutdown = () => {
  console.log('Shutting down API Gateway...');
  redisClient.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function startServer() {
  try {
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    const server = app.listen(PORT, () => {
      console.log(`🚀 API Gateway running on port ${PORT}`);
      console.log('📋 Available routes:');
      console.log('   GET  /health - Gateway health check');
      console.log('   POST /api/auth/* - Authentication endpoints');
      console.log('   *    /api/users/* - User management (authenticated)');
      console.log('   GET  /api/products/* - Product catalog (public)');
      console.log('   *    /api/orders/* - Order management (authenticated)');
      console.log('   *    /api/payments/* - Payment processing (authenticated)');
      console.log('   *    /api/notifications/* - Notifications (authenticated)');
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start API Gateway:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;