import type { AccommodationStatus } from '~/lib/bookings/accommodation';
import type { BookingStatus } from '~/lib/constants/enums';

export type AvailableDayType = 'race_day' | 'test_day' | 'track_day' | 'road_drive';

export interface AvailableDay {
  dayId: string;
  date: string;
  type: AvailableDayType;
  circuit: string;
  circuitId?: string;
  circuitName?: string;
  layout?: string;
  circuitKnown?: boolean;
  provider: string;
  description: string;
  bookingUrl?: string;
  source: {
    sourceType: 'caterham' | 'testing' | 'trackdays' | 'manual';
    sourceName: string;
    externalId?: string;
    metadata?: Record<string, string | undefined>;
  };
}

export interface SharedAttendee {
  bookingId: string;
  userId: string;
  userName: string;
  userImage?: string;
  status: BookingStatus;
  arrivalDateTime?: string;
  arrivalTime?: string;
  accommodationStatus?: AccommodationStatus;
  accommodationName?: string;
  garageBooked?: boolean;
  garageCapacity?: number;
  garageLabel?: string;
}

export type GarageShareRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface SharedGarageRequest {
  requestId: string;
  requesterUserId: string;
  requesterName: string;
  status: GarageShareRequestStatus;
}

export interface GarageShareOption {
  garageBookingId: string;
  ownerUserId: string;
  ownerName: string;
  ownerArrivalDateTime?: string;
  ownerArrivalTime?: string;
  garageLabel?: string;
  garageCapacity: number;
  approvedRequestCount: number;
  pendingRequestCount: number;
  openSpaceCount: number;
  myRequestId?: string;
  myRequestStatus?: GarageShareRequestStatus;
  requests: SharedGarageRequest[];
}

export interface DayAttendanceSummary {
  attendeeCount: number;
  attendees: SharedAttendee[];
  accommodationNames: string[];
  garageOwnerCount?: number;
  garageOpenSpaceCount?: number;
  garageShareOptions?: GarageShareOption[];
}

export interface DaySourceError {
  source: string;
  message: string;
}

export interface AvailableDaysResult {
  days: AvailableDay[];
  errors: DaySourceError[];
}
