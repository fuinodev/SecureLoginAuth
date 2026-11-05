import { z } from 'zod';

export const refreshSchema = z.strictObject({
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required')
    .max(512, 'Refresh token is too long'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
