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

const EventRequestIdSchema = z
  .string()
  .trim()
  .min(1, 'Event request id is required.');

const OptionalUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .default('')
  .refine((value) => !value || isValidUrl(value), {
    message: 'Enter a full http:// or https:// URL',
  });

export const CreateEventRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AvailableDayTypeSchema.default('track_day'),
  title: z.string().trim().min(3).max(120),
  location: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(''),
  bookingUrl: OptionalUrlSchema,
});

export const ApproveEventRequestSchema = z.object({
  requestId: EventRequestIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AvailableDayTypeSchema,
  circuit: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  series: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().max(200).optional().default(''),
  bookingUrl: OptionalUrlSchema,
});

export const RejectEventRequestSchema = z.object({
  requestId: EventRequestIdSchema,
  rejectionReason: z.string().trim().max(500).optional().default(''),
});

export type CreateEventRequestInput = z.infer<typeof CreateEventRequestSchema>;
export type ApproveEventRequestInput = z.infer<
  typeof ApproveEventRequestSchema
>;
export type RejectEventRequestInput = z.infer<typeof RejectEventRequestSchema>;
