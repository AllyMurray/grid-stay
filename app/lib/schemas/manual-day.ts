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

export const CreateManualDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AvailableDayTypeSchema,
  circuit: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  series: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().max(200).default(''),
  bookingUrl: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .default('')
    .refine((value) => !value || isValidUrl(value), {
      message: 'Enter a full http:// or https:// URL',
    }),
});

export type CreateManualDayInput = z.infer<typeof CreateManualDaySchema>;
