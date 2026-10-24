import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';

export function createApp() {
  const app = express();

  // 1. HTTP Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", config.CORS_ORIGIN],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      },
      crossOriginEmbedderPolicy: false, // allow cross-origin resource sharing when needed
      xContentTypeOptions: true,
      xFrameOptions: { action: 'deny' },
      xXssProtection: true
    })
  );

  // 2. Restrictive CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          config.CORS_ORIGIN,
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173'
        ];

        if (allowedOrigins.includes(origin) || config.NODE_ENV === 'development') {
          return callback(null, true);
        }

        return callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  // 3. Request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Global Health Check Endpoint (publicly accessible, useful for deployment probes)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'TrustVault Core API',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  // 5. Rate limiting for general API routes
  if (config.NODE_ENV !== 'test') {
    app.use('/api/', globalLimiter);
  }

  // 6. Mount Feature Routes
  app.use('/api/auth', authRoutes);

  // 7. Not Found & Central Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
