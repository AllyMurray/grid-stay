import { z } from 'zod';
import { AvailableDayTypeSchema } from './booking';

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const OptionalUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .default('')
  .refine((value) => !value || isValidUrl(value), {
    message: 'Enter a full http:// or https:// URL',
  });

export const CreateMemberEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AvailableDayTypeSchema.default('track_day'),
  title: z.string().trim().min(3).max(120),
  location: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(''),
  bookingUrl: OptionalUrlSchema,
});

export type CreateMemberEventInput = z.infer<typeof CreateMemberEventSchema>;
