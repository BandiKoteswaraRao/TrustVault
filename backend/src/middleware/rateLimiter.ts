import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// Global API rate limiter
export const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Global request rate limit exceeded. Please try again later.'
  }
});

// Strict rate limiter for sensitive authentication endpoints (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
  }
});
