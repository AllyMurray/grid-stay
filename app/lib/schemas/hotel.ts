import { z } from 'zod';

export const HotelSourceSchema = z.enum(['manual', 'geoapify']);

const OptionalStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const OptionalCoordinateSchema = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.coerce.number().finite().optional(),
);

export const HotelSelectionSchema = z.object({
  hotelId: OptionalStringSchema,
  hotelName: z.string().trim().max(120).optional(),
  hotelAddress: z.string().trim().max(240).optional(),
  hotelPostcode: z.string().trim().max(32).optional(),
  hotelCountry: z.string().trim().max(80).optional(),
  hotelLatitude: OptionalCoordinateSchema,
  hotelLongitude: OptionalCoordinateSchema,
  hotelSource: HotelSourceSchema.optional(),
  hotelSourcePlaceId: OptionalStringSchema,
  hotelAttribution: z.string().trim().max(240).optional(),
});

export const HotelSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});

export const HotelReviewSchema = z.object({
  hotelId: z.string().trim().min(1),
  rating: z.preprocess(
    (value) => (value === '' || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(5).optional(),
  ),
  trailerParking: z.enum(['unknown', 'good', 'limited', 'none']).default('unknown'),
  secureParking: z.enum(['unknown', 'yes', 'mixed', 'no']).default('unknown'),
  lateCheckIn: z.enum(['unknown', 'yes', 'limited', 'no']).default('unknown'),
  parkingNotes: z.string().trim().max(500).optional().default(''),
  generalNotes: z.string().trim().max(1000).optional().default(''),
});

export type HotelSelectionInput = z.infer<typeof HotelSelectionSchema>;
export type HotelSearchQueryInput = z.infer<typeof HotelSearchQuerySchema>;
export type HotelReviewInput = z.infer<typeof HotelReviewSchema>;
