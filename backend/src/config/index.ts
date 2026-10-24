import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from project root or backend folder
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // fallback to current dir .env

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  USE_PGLITE: z.string().optional().default('false'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('trustvault_super_secret_jwt_key_at_least_32_characters_12345'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  STORAGE_DIR: z.string().default('storage/uploads'),
  MAX_FILE_SIZE_BYTES: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().default(10),
  AUDIT_HMAC_SECRET: z.string().optional().default('trustvault_audit_hmac_secret_anchor_key_32_chars')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const config = parsed.data;
