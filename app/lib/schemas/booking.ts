import { z } from 'zod';
import { ACCOMMODATION_STATUS_VALUES } from '~/lib/bookings/accommodation';
import { BOOKING_STATUS_VALUES } from '~/lib/constants/enums';
import { HotelSelectionSchema } from './hotel';

export const AvailableDayTypeSchema = z.enum(['race_day', 'test_day', 'track_day', 'road_drive']);

export const BookingStatusSchema = z.enum(BOOKING_STATUS_VALUES);
export const AccommodationStatusSchema = z.enum(ACCOMMODATION_STATUS_VALUES);

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

export const SharedStaySelectionRequestSchema = CreateBookingRequestSchema.extend({
  accommodationName: z.string().trim().min(1).max(120),
});

export const BulkRaceSeriesBookingSchema = z.object({
  dayId: z.string().min(1),
  status: z.enum(['booked', 'maybe']),
});

export const RaceSeriesSubscriptionBookingSchema = z.object({
  seriesKey: z.string().trim().min(1),
  status: z.enum(['booked', 'maybe']),
});

export const RaceSeriesSubscriptionKeySchema = z.object({
  seriesKey: z.string().trim().min(1),
});

const GarageBookedSchema = z.preprocess(
  (value) => value === true || value === 'true' || value === 'on' || value === '1',
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

const ArrivalDateTimeSchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/,
      'Use a date and time like 2026-05-05 20:00.',
    )
    .optional(),
);

const UpdateBookingBaseSchema = z.object({
  bookingId: z.string().min(1),
  status: BookingStatusSchema,
  bookingReference: z.string().trim().max(120).optional().default(''),
  arrivalDateTime: ArrivalDateTimeSchema,
  accommodationStatus: AccommodationStatusSchema.optional(),
  ...HotelSelectionSchema.shape,
  accommodationName: z.string().trim().max(120).optional().default(''),
  accommodationReference: z.string().trim().max(120).optional().default(''),
  garageBooked: GarageBookedSchema,
  garageCapacity: GarageCapacitySchema,
  garageLabel: z.string().trim().max(120).optional().default(''),
  garageCostTotalPence: OptionalMoneySchema,
  garageCostCurrency: z.string().trim().length(3).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().default(''),
});

function validateBookedAccommodation(
  value: {
    accommodationStatus?: string;
    hotelId?: string;
    hotelName?: string;
    accommodationName?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (
    value.accommodationStatus === 'booked' &&
    !value.hotelId?.trim() &&
    !value.hotelName?.trim() &&
    !value.accommodationName?.trim()
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['accommodationName'],
      message: 'Add the hotel or stay name, or choose a different plan.',
    });
  }
}

export const UpdateBookingSchema = UpdateBookingBaseSchema.superRefine(validateBookedAccommodation);

export const UpdateBookingTripSchema = UpdateBookingBaseSchema.pick({
  bookingId: true,
  status: true,
});

export const UpdateBookingStaySchema = UpdateBookingBaseSchema.pick({
  bookingId: true,
  arrivalDateTime: true,
  accommodationStatus: true,
  hotelId: true,
  hotelName: true,
  hotelAddress: true,
  hotelPostcode: true,
  hotelCountry: true,
  hotelLatitude: true,
  hotelLongitude: true,
  hotelSource: true,
  hotelSourcePlaceId: true,
  hotelAttribution: true,
  accommodationName: true,
}).superRefine(validateBookedAccommodation);

export const UpdateBookingGarageSchema = UpdateBookingBaseSchema.pick({
  bookingId: true,
  garageBooked: true,
  garageCapacity: true,
  garageLabel: true,
  garageCostTotalPence: true,
  garageCostCurrency: true,
});

export const UpdateBookingPrivateSchema = UpdateBookingBaseSchema.pick({
  bookingId: true,
  bookingReference: true,
  accommodationReference: true,
  notes: true,
});

export const DeleteBookingSchema = z.object({
  bookingId: z.string().min(1),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type CreateBookingRequestInput = z.infer<typeof CreateBookingRequestSchema>;
export type SharedStaySelectionInput = z.infer<typeof SharedStaySelectionSchema>;
export type SharedStaySelectionRequestInput = z.infer<typeof SharedStaySelectionRequestSchema>;
export type BulkRaceSeriesBookingInput = z.infer<typeof BulkRaceSeriesBookingSchema>;
export type RaceSeriesSubscriptionBookingInput = z.infer<
  typeof RaceSeriesSubscriptionBookingSchema
>;
export type RaceSeriesSubscriptionKeyInput = z.infer<typeof RaceSeriesSubscriptionKeySchema>;
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;
export type UpdateBookingTripInput = z.infer<typeof UpdateBookingTripSchema>;
export type UpdateBookingStayInput = z.infer<typeof UpdateBookingStaySchema>;
export type UpdateBookingGarageInput = z.infer<typeof UpdateBookingGarageSchema>;
export type UpdateBookingPrivateInput = z.infer<typeof UpdateBookingPrivateSchema>;
export type DeleteBookingInput = z.infer<typeof DeleteBookingSchema>;
