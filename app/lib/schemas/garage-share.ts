import { z } from 'zod';

export const GarageShareRequestSchema = z.object({
  dayId: z.string().trim().min(1),
  garageOwnerUserId: z.string().trim().min(1),
  garageBookingId: z.string().trim().min(1),
  message: z.string().trim().max(500).optional().default(''),
});

export const GarageShareDecisionSchema = z.object({
  requestId: z.string().trim().min(1),
  status: z.enum(['approved', 'declined', 'cancelled']),
});

export type GarageShareRequestInput = z.infer<typeof GarageShareRequestSchema>;
export type GarageShareDecisionInput = z.infer<typeof GarageShareDecisionSchema>;
