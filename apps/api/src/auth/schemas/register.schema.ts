
import { z } from 'zod';

export const registerSchema = z.strictObject({
  email: z.email().max(254),

  password: z
    .string()
    .min(12, 'Password must contain at least 12 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
