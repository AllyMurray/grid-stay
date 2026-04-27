import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/auth/member-invites.server', () => ({
  listMemberInvites: vi.fn(),
}));
vi.mock('~/lib/auth/members.server', () => ({
  listAdminSiteMembers: vi.fn(),
}));
vi.mock('~/lib/calendar/feed.server', () => ({
  calendarFeedStore: {
    listByUser: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));
vi.mock('~/lib/db/services/booking.server', () => ({
  listMyBookings: vi.fn(),
}));
vi.mock('~/lib/db/services/day-plan.server', () => ({
  dayPlanStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManagedManualDays: vi.fn(),
}));
vi.mock('~/lib/db/services/series-subscription.server', () => ({
  seriesSubscriptionStore: {
    listByUser: vi.fn(),
  },
}));
vi.mock('~/lib/db/entities/booking.server', () => ({
  BookingEntity: {},
}));
vi.mock('~/lib/db/entities/calendar-feed.server', () => ({
  CalendarFeedEntity: {},
}));
vi.mock('~/lib/db/entities/day-plan.server', () => ({
  DayPlanEntity: {},
}));
vi.mock('~/lib/db/entities/manual-day.server', () => ({
  ManualDayEntity: {},
}));
vi.mock('~/lib/db/entities/member-invite.server', () => ({
  MemberInviteEntity: {},
}));
vi.mock('~/lib/db/entities/series-subscription.server', () => ({
  SeriesSubscriptionEntity: {},
}));

import type { CalendarFeedRecord } from '~/lib/db/entities/calendar-feed.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import {
  createAdminDataExport,
  summarizeAdminDataExport,
} from './export.server';

describe('admin data export', () => {
  it('collects production data and redacts calendar feed tokens', async () => {
    const booking = {
      bookingId: 'day-1',
      userId: 'user-1',
      userName: 'Driver One',
      dayId: 'day-1',
      date: '2026-05-01',
      status: 'booked',
      circuit: 'Silverstone',
      provider: 'MSV',
      description: 'Testing',
      bookingReference: 'PRIVATE-BOOKING',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as BookingRecord;
    const feed = {
      tokenHash: 'hash-1',
      token: 'plain-token',
      tokenHint: 'in-token',
      feedScope: 'schedule',
      userId: 'user-1',
      includeMaybe: true,
      includeStay: true,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as CalendarFeedRecord;

    const dataExport = await createAdminDataExport({
      now: new Date('2026-04-27T10:00:00.000Z'),
      loadMembers: async () => [
        {
          id: 'user-1',
          name: 'Driver One',
          email: 'driver@example.com',
          role: 'member',
          activeTripsCount: 1,
          sharedStayCount: 0,
          nextTrip: undefined,
        },
      ],
      loadMemberInvites: async () => [],
      loadBookings: async () => [booking],
      loadAvailableDaysSnapshot: async () => ({
        refreshedAt: '2026-04-27T09:00:00.000Z',
        days: [],
        errors: [],
      }),
      loadManualDays: async () => [],
      loadSharedDayPlans: async () => [],
      loadSeriesSubscriptions: async () => [],
      loadCalendarFeeds: async () => [feed],
    });

    expect(dataExport.exportedAt).toBe('2026-04-27T10:00:00.000Z');
    expect(dataExport.bookings).toEqual([booking]);
    expect(dataExport.calendarFeeds).toEqual([
      expect.objectContaining({
        tokenHash: 'hash-1',
        tokenHint: 'in-token',
        hasLegacyPlaintextToken: true,
      }),
    ]);
    expect(JSON.stringify(dataExport.calendarFeeds)).not.toContain(
      'plain-token',
    );
    expect(summarizeAdminDataExport(dataExport)).toMatchObject({
      memberCount: 1,
      bookingCount: 1,
      calendarFeedCount: 1,
    });
  });
});
