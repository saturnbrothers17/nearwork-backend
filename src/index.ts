import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/environment';
import { initSocketIO } from './config/socket';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
export const io = initSocketIO(server);

// Security Headers & CORS
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000, // Generous limit for development & pair programming
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === 'localhost' || process.env.NODE_ENV !== 'production',
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api', limiter);

// Root & Landing Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 NearWork Backend API is Online & Operational',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: ENV.PORT,
    endpoints: {
      health: `http://localhost:${ENV.PORT}/health`,
      apiBase: `http://localhost:${ENV.PORT}/api/v1`,
      services: `http://localhost:${ENV.PORT}/api/v1/services`,
      categories: `http://localhost:${ENV.PORT}/api/v1/services/categories`
    },
    applications: {
      customerApp: 'http://localhost:3100',
      workerPartnerApp: 'http://localhost:3101',
      adminDashboard: 'http://localhost:3102'
    }
  });
});

app.get('/api', (req, res) => {
  res.redirect('/api/v1');
});

app.get('/api/v1', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NearWork v1 REST API Base',
    availableEndpoints: [
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/register/customer',
      'POST /api/v1/auth/register/worker',
      'GET  /api/v1/services',
      'GET  /api/v1/services/categories',
      'POST /api/v1/bookings',
      'GET  /api/v1/bookings/:id',
      'POST /api/v1/payments/cash',
      'POST /api/v1/payments/order',
      'GET  /api/v1/worker/jobs',
      'GET  /api/v1/worker/profile',
      'GET  /api/v1/customer/bookings',
      'GET  /api/v1/customer/profile'
    ]
  });
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'NearWork Core API'
  });
});

// API Routes
app.use('/api/v1', apiRouter);

// Centralized Error Handling Middleware
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(ENV.PORT, () => {
    console.log(`🚀 NearWork Backend Server running on port ${ENV.PORT}`);
    console.log(`📡 Socket.IO initialized for real-time tracking`);
    console.log(`🔗 API Base: http://localhost:${ENV.PORT}/api/v1`);
  });
}

export { app, server };
export default app;
