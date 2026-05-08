import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

const {
  requireUser,
  getByUser,
  getAvailableDaysSnapshot,
  listManualDays,
  listAttendanceByDay,
  getSharedDayPlan,
  loadEventCostSummary,
  listDayNotificationsForDay,
  isBetaFeatureEnabled,
} = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getByUser: vi.fn(),
  getAvailableDaysSnapshot: vi.fn(),
  listManualDays: vi.fn(),
  listAttendanceByDay: vi.fn(),
  getSharedDayPlan: vi.fn(),
  loadEventCostSummary: vi.fn(),
  listDayNotificationsForDay: vi.fn(),
  isBetaFeatureEnabled: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/beta-features/preferences.server', () => ({
  isBetaFeatureEnabled,
}));

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot,
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  bookingStore: {
    getByUser,
  },
  listAttendanceByDay,
}));

vi.mock('~/lib/db/services/cost-splitting.server', () => ({
  loadEventCostSummary,
}));

vi.mock('~/lib/db/services/day-notification.server', () => ({
  listDayNotificationsForDay,
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays,
}));

vi.mock('~/lib/days/shared-plan.server', () => ({
  getSharedDayPlan,
}));

import { loader } from './bookings.$bookingId.briefing';

const booking: BookingRecord = {
  bookingId: 'booking-1',
  userId: 'user-1',
  userName: 'Driver One',
  dayId: 'day-1',
  date: '2026-05-03',
  type: 'race_day',
  status: 'booked',
  circuit: 'Silverstone',
  provider: 'MSV',
  description: 'GT weekend',
  arrivalDateTime: '2026-05-02 20:00:00',
  accommodationStatus: 'booked',
  accommodationName: 'Trackside Hotel',
  bookingReference: 'REF-123',
  accommodationReference: 'HOTEL-7',
  garageBooked: true,
  garageCapacity: 2,
  garageLabel: 'Garage 4',
  notes: 'Quiet room',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

const attendance = {
  attendeeCount: 1,
  attendees: [
    {
      bookingId: 'booking-1',
      userId: 'user-1',
      userName: 'Driver One',
      status: 'booked' as const,
      arrivalDateTime: '2026-05-02 20:00:00',
      accommodationStatus: 'booked' as const,
      accommodationName: 'Trackside Hotel',
      garageBooked: true,
      garageCapacity: 2,
      garageLabel: 'Garage 4',
    },
  ],
  accommodationNames: ['Trackside Hotel'],
  garageOwnerCount: 1,
  garageOpenSpaceCount: 1,
  garageShareOptions: [
    {
      garageBookingId: 'booking-1',
      ownerUserId: 'user-1',
      ownerName: 'Driver One',
      garageLabel: 'Garage 4',
      garageCapacity: 2,
      approvedRequestCount: 0,
      pendingRequestCount: 0,
      openSpaceCount: 1,
      requests: [],
    },
  ],
};

const costSummary = {
  dayId: 'day-1',
  currency: 'GBP' as const,
  availableParticipants: [{ userId: 'user-1', userName: 'Driver One' }],
  groups: [],
  netSettlements: [],
  totalPence: 0,
};

function loadBriefing(params: Record<string, string | undefined> = { bookingId: 'booking-1' }) {
  return loader({
    request: new Request('https://gridstay.app/dashboard/bookings/booking-1/briefing'),
    params,
    context: {},
  } as never) as Promise<Response>;
}

describe('event briefing route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver One',
        role: 'member',
      },
      headers: new Headers(),
    });
    isBetaFeatureEnabled.mockReset();
    isBetaFeatureEnabled.mockResolvedValue(true);
    getByUser.mockReset();
    getByUser.mockResolvedValue(booking);
    getAvailableDaysSnapshot.mockReset();
    getAvailableDaysSnapshot.mockResolvedValue({
      refreshedAt: '2026-04-27T10:00:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'day-1',
          date: '2026-05-03',
          type: 'race_day',
          circuit: 'Silverstone',
          provider: 'MSV',
          description: 'GT weekend',
          bookingUrl: 'https://example.com/book',
          source: {
            sourceType: 'trackdays',
            sourceName: 'msv',
            metadata: {
              availability: 'Spaces',
            },
          },
        },
      ],
    });
    listManualDays.mockReset();
    listManualDays.mockResolvedValue([]);
    listAttendanceByDay.mockReset();
    listAttendanceByDay.mockResolvedValue(attendance);
    getSharedDayPlan.mockReset();
    getSharedDayPlan.mockResolvedValue({
      dayId: 'day-1',
      notes: 'Meet by garage 4.',
      dinnerVenue: 'The Paddock Arms',
      dinnerTime: '19:30',
      dinnerHeadcount: '6',
      dinnerNotes: 'Booking under Grid Stay.',
      updatedByName: 'Driver One',
      updatedAt: '2026-04-27T10:00:00.000Z',
    });
    loadEventCostSummary.mockReset();
    loadEventCostSummary.mockResolvedValue(costSummary);
    listDayNotificationsForDay.mockReset();
    listDayNotificationsForDay.mockResolvedValue([
      {
        notificationId: 'changed-day#1',
        type: 'changed_available_day',
        dayId: 'day-1',
        date: '2026-05-03',
        dayType: 'race_day',
        circuit: 'Silverstone',
        provider: 'MSV',
        description: 'Updated fields: date',
        createdAt: '2026-04-20T10:00:00.000Z',
        isRead: false,
      },
    ]);
  });

  it('returns briefing data for the current user active booking', async () => {
    const response = await loadBriefing();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(isBetaFeatureEnabled).toHaveBeenCalledWith('user-1', 'eventBriefing');
    expect(getByUser).toHaveBeenCalledWith('user-1', 'booking-1');
    expect(listAttendanceByDay).toHaveBeenCalledWith('day-1', undefined, undefined, 'user-1');
    expect(loadEventCostSummary).toHaveBeenCalledWith('day-1', 'user-1', attendance);
    expect(data).toMatchObject({
      booking: {
        bookingId: 'booking-1',
        bookingReference: 'REF-123',
      },
      day: {
        dayId: 'day-1',
        circuit: 'Silverstone',
        bookingUrl: 'https://example.com/book',
        availability: 'Spaces',
      },
      attendance,
      latestUpdates: [
        {
          notificationId: 'changed-day#1',
          description: 'Updated fields: date',
          isRead: false,
        },
      ],
    });
  });

  it('throws not found when the event briefing beta is disabled', async () => {
    isBetaFeatureEnabled.mockResolvedValue(false);

    await expect(loadBriefing()).rejects.toMatchObject({ status: 404 });
    expect(getByUser).not.toHaveBeenCalled();
  });

  it('allows maybe bookings', async () => {
    getByUser.mockResolvedValue({
      ...booking,
      status: 'maybe',
      arrivalDateTime: undefined,
      accommodationStatus: 'looking',
    });

    const response = await loadBriefing();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.booking.status).toBe('maybe');
    expect(data.readinessPrompts.map((prompt: { id: string }) => prompt.id)).toEqual(
      expect.arrayContaining(['confirm-attendance', 'arrival-time', 'accommodation-plan']),
    );
  });

  it('throws not found for missing, other-user, or cancelled bookings', async () => {
    getByUser.mockResolvedValue(null);
    await expect(loadBriefing()).rejects.toMatchObject({ status: 404 });

    getByUser.mockResolvedValue({ ...booking, status: 'cancelled' });
    await expect(loadBriefing()).rejects.toMatchObject({ status: 404 });
  });

  it('falls back to booking details when the day is not in the current feed', async () => {
    getAvailableDaysSnapshot.mockResolvedValue({
      refreshedAt: '2026-04-27T10:00:00.000Z',
      errors: [],
      days: [],
    });

    const response = await loadBriefing();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.day).toMatchObject({
      dayId: 'day-1',
      circuit: 'Silverstone',
      provider: 'MSV',
      description: 'GT weekend',
    });
    expect(data.day.bookingUrl).toBeUndefined();
  });
});
