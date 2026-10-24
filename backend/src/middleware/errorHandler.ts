import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log full stack trace internally
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  const statusNameMap: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests'
  };

  // Never expose internal stack traces or database error details to clients in production
  const responsePayload = {
    error: statusNameMap[statusCode] || (isClientError ? 'Request Error' : 'Internal Server Error'),
    message: isClientError ? err.message : 'An unexpected error occurred. Please try again later.',
    ...(config.NODE_ENV === 'development' && !isClientError ? { stack: err.stack } : {})
  };

  res.status(statusCode).json(responsePayload);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist.`
  });
}
