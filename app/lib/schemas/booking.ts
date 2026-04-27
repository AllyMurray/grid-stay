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

export const CreateBookingRequestSchema = z.object({
  dayId: z.string().min(1),
  status: BookingStatusSchema.default('booked'),
});

export const SharedStaySelectionSchema = CreateBookingSchema.extend({
  accommodationName: z.string().trim().min(1).max(120),
});

export const SharedStaySelectionRequestSchema =
  CreateBookingRequestSchema.extend({
    accommodationName: z.string().trim().min(1).max(120),
  });

export const BulkRaceSeriesBookingSchema = z.object({
  dayId: z.string().min(1),
  status: z.enum(['booked', 'maybe']),
});

export const UpdateBookingSchema = z.object({
  bookingId: z.string().min(1),
  status: BookingStatusSchema,
  bookingReference: z.string().trim().max(120).optional().default(''),
  accommodationName: z.string().trim().max(120).optional().default(''),
  accommodationReference: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const DeleteBookingSchema = z.object({
  bookingId: z.string().min(1),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type CreateBookingRequestInput = z.infer<
  typeof CreateBookingRequestSchema
>;
export type SharedStaySelectionInput = z.infer<
  typeof SharedStaySelectionSchema
>;
export type SharedStaySelectionRequestInput = z.infer<
  typeof SharedStaySelectionRequestSchema
>;
export type BulkRaceSeriesBookingInput = z.infer<
  typeof BulkRaceSeriesBookingSchema
>;
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;
export type DeleteBookingInput = z.infer<typeof DeleteBookingSchema>;
