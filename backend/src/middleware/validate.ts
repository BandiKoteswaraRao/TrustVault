import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message
      }));
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request payload.',
        details: issues
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Auth validation schemas
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address.').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one digit.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(100)
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address.'),
  password: z.string().min(1, 'Password is required.')
});

export const grantPermissionSchema = z.object({
  granteeEmail: z.string().trim().toLowerCase().email('Valid grantee email is required.'),
  permissionLevel: z.enum(['read', 'download']).default('download')
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty.').max(255),
  description: z.string().max(1000).optional()
});
