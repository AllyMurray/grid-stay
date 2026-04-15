export const USER_ROLE_VALUES = ['member', 'admin', 'owner'] as const;
export const BOOKING_STATUS_VALUES = ['booked', 'cancelled', 'maybe'] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];
export type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];
