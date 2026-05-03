import { z } from 'zod';
import { BOOKING_STATUS_VALUES } from '~/lib/constants/enums';

export const AvailableDayTypeSchema = z.enum([
  'race_day',
  'test_day',
  'track_day',
  'road_drive',
]);

export const BookingStatusSchema = z.enum(BOOKING_STATUS_VALUES);

export const CreateBookingSchema = z.object({
  dayId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: AvailableDayTypeSchema,
  circuit: z.string().min(1),
  circuitId: z.string().optional(),
  circuitName: z.string().optional(),
  layout: z.string().optional(),
  circuitKnown: z.boolean().optional(),
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

const GarageBookedSchema = z.preprocess(
  (value) =>
    value === true || value === 'true' || value === 'on' || value === '1',
  z.boolean(),
);

const OptionalMoneySchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().int().nonnegative().optional(),
);

const GarageCapacitySchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().int().min(1).max(20).default(2),
);

export const UpdateBookingSchema = z.object({
  bookingId: z.string().min(1),
  status: BookingStatusSchema,
  bookingReference: z.string().trim().max(120).optional().default(''),
  accommodationName: z.string().trim().max(120).optional().default(''),
  accommodationReference: z.string().trim().max(120).optional().default(''),
  garageBooked: GarageBookedSchema,
  garageCapacity: GarageCapacitySchema,
  garageLabel: z.string().trim().max(120).optional().default(''),
  garageCostTotalPence: OptionalMoneySchema,
  garageCostCurrency: z.string().trim().length(3).optional().or(z.literal('')),
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
