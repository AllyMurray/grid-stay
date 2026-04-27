import type { BookingStatus } from '~/lib/constants/enums';

export type AvailableDayType = 'race_day' | 'test_day' | 'track_day';

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
  status: BookingStatus;
  accommodationName?: string;
}

export interface DayAttendanceSummary {
  attendeeCount: number;
  attendees: SharedAttendee[];
  accommodationNames: string[];
}

export interface DaySourceError {
  source: string;
  message: string;
}

export interface AvailableDaysResult {
  days: AvailableDay[];
  errors: DaySourceError[];
}
