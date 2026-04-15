import { z } from 'zod';
import { BOOKING_STATUS_VALUES } from '~/lib/constants/enums';

export const AvailableDayTypeSchema = z.enum([
  'race_day',
  'test_day',
  'track_day',
]);

export const BookingStatusSchema = z.enum(BOOKING_STATUS_VALUES);

export const CreateBookingSchema = z.object({
  dayId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AvailableDayTypeSchema,
  circuit: z.string().min(1),
  provider: z.string().min(1),
  description: z.string(),
  status: BookingStatusSchema.default('booked'),
});

export const UpdateBookingSchema = z.object({
  bookingId: z.string().min(1),
  status: BookingStatusSchema,
  bookingReference: z.string().trim().max(120).optional().default(''),
  accommodationName: z.string().trim().max(120).optional().default(''),
  accommodationReference: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;
