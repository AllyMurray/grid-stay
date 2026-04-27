import { describe, expect, it, vi } from 'vitest';
import type { AuthUserRecord } from '~/lib/auth/members.server';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { SeriesSubscriptionRecord } from '~/lib/db/entities/series-subscription.server';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  ensureBookingsForDays: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

vi.mock('~/lib/db/services/member-profile.server', () => ({
  setMemberDisplayName: vi.fn(),
}));

vi.mock('~/lib/db/services/series-subscription.server', () => ({
  seriesSubscriptionStore: {
    delete: vi.fn(),
    listByUser: vi.fn(),
    update: vi.fn(),
  },
  upsertSeriesSubscription: vi.fn(),
}));

import {
  buildAdminSeriesOptions,
  getAdminMemberProfile,
  submitAdminMemberAction,
} from './member-management.server';

const member: AuthUserRecord = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  image: 'https://example.com/driver.png',
  role: 'member',
};

const academyDays: AvailableDay[] = [
  {
    dayId: 'day-1',
    date: '2026-05-10',
    type: 'race_day',
    circuit: 'Snetterton',
    provider: 'Caterham Motorsport',
    description: 'Round 1',
    source: {
      sourceType: 'caterham',
      sourceName: 'caterham',
      metadata: { series: 'Caterham Academy' },
    },
  },
  {
    dayId: 'manual:test-day',
    date: '2026-04-01',
    type: 'test_day',
    circuit: 'Donington Park',
    provider: 'Caterham Motorsport',
    description: 'Official test day',
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      metadata: { series: 'Caterham Academy' },
    },
  },
];

const booking: BookingRecord = {
  bookingId: 'booking-1',
  userId: 'user-1',
  userName: 'Driver One',
  userImage: 'https://example.com/driver.png',
  dayId: 'day-1',
  date: '2026-05-10',
  status: 'booked',
  circuit: 'Snetterton',
  provider: 'Caterham Motorsport',
  bookingReference: 'PRIVATE-REF',
  description: 'Round 1',
  accommodationName: 'Trackside Hotel',
  accommodationReference: 'PRIVATE-HOTEL',
  notes: 'Private notes',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

const subscription: SeriesSubscriptionRecord = {
  userId: 'user-1',
  seriesKey: 'caterham-academy',
  seriesName: 'Caterham Academy',
  status: 'maybe',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
} as SeriesSubscriptionRecord;

describe('admin member management helpers', () => {
  it('builds series options from scraped and manual days', () => {
    expect(buildAdminSeriesOptions(academyDays)).toEqual([
      {
        seriesKey: 'caterham-academy',
        seriesName: 'Caterham Academy',
        dayCount: 2,
      },
    ]);
  });

  it('returns a sanitized member profile without private booking fields', async () => {
    const profile = await getAdminMemberProfile('user-1', {
      loadMember: async () => member,
      loadBookings: async () => [booking],
      loadSubscriptions: async () => [subscription],
      today: '2026-04-01',
    });

    expect(profile).toMatchObject({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver One',
      authName: 'Driver One',
      bookings: [
        {
          bookingId: 'booking-1',
          accommodationName: 'Trackside Hotel',
        },
      ],
      subscriptions: [
        {
          seriesKey: 'caterham-academy',
          status: 'maybe',
        },
      ],
    });
    expect(profile.bookings[0]).not.toHaveProperty('bookingReference');
    expect(profile.bookings[0]).not.toHaveProperty('accommodationReference');
    expect(profile.bookings[0]).not.toHaveProperty('notes');
  });

  it('updates a member display-name override', async () => {
    const formData = new FormData();
    formData.set('intent', 'updateDisplayName');
    formData.set('displayName', '  Adam Mann  ');
    const saveDisplayName = vi.fn(async () => null);

    const result = await submitAdminMemberAction(
      formData,
      'user-1',
      { id: 'admin-1' },
      {
        loadMember: async () => member,
        saveDisplayName: saveDisplayName as never,
      },
    );

    expect(result).toEqual({
      ok: true,
      message: 'Display name updated.',
    });
    expect(saveDisplayName).toHaveBeenCalledWith({
      userId: 'user-1',
      displayName: 'Adam Mann',
      updatedByUserId: 'admin-1',
    });
  });

  it('adds a series to a member and backfills missing bookings', async () => {
    const formData = new FormData();
    formData.set('intent', 'addSeries');
    formData.set('seriesKey', 'caterham-academy');
    formData.set('status', 'booked');

    const saveBookings = vi.fn(async () => ({
      addedCount: 1,
      existingCount: 1,
    }));
    const saveSubscription = vi.fn(async () => subscription);

    const result = await submitAdminMemberAction(
      formData,
      'user-1',
      { id: 'admin-1' },
      {
        loadMember: async () => member,
        loadSnapshot: async () => ({
          days: [academyDays[0]!],
          errors: [],
          refreshedAt: '2026-04-01T10:00:00.000Z',
        }),
        loadManualDays: async () => [academyDays[1]!],
        saveBookings: saveBookings as never,
        saveSubscription: saveSubscription as never,
      },
    );

    expect(result).toEqual({
      ok: true,
      message: 'Caterham Academy added to Driver One.',
      addedCount: 1,
      existingCount: 1,
    });
    expect(saveBookings).toHaveBeenCalledWith(
      [
        expect.objectContaining({ dayId: 'manual:test-day' }),
        expect.objectContaining({ dayId: 'day-1' }),
      ],
      'booked',
      expect.objectContaining({
        id: 'user-1',
        email: 'driver@example.com',
      }),
    );
    expect(saveSubscription).toHaveBeenCalledWith({
      userId: 'user-1',
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      status: 'booked',
    });
  });

  it('updates an existing series subscription status', async () => {
    const formData = new FormData();
    formData.set('intent', 'updateSeries');
    formData.set('seriesKey', 'caterham-academy');
    formData.set('status', 'maybe');
    const updateSubscription = vi.fn(async () => subscription);

    const result = await submitAdminMemberAction(
      formData,
      'user-1',
      { id: 'admin-1' },
      {
        loadMember: async () => member,
        updateSubscription,
      },
    );

    expect(result).toEqual({
      ok: true,
      message: 'Series subscription updated.',
    });
    expect(updateSubscription).toHaveBeenCalledWith(
      'user-1',
      'caterham-academy',
      expect.objectContaining({
        status: 'maybe',
        updatedAt: expect.any(String),
      }),
    );
  });

  it('removes a series subscription without deleting bookings', async () => {
    const formData = new FormData();
    formData.set('intent', 'removeSeries');
    formData.set('seriesKey', 'caterham-academy');
    const deleteSubscription = vi.fn(async () => undefined);
    const saveBookings = vi.fn();

    const result = await submitAdminMemberAction(
      formData,
      'user-1',
      { id: 'admin-1' },
      {
        loadMember: async () => member,
        deleteSubscription,
        saveBookings: saveBookings as never,
      },
    );

    expect(result).toEqual({
      ok: true,
      message: 'Series subscription removed.',
    });
    expect(deleteSubscription).toHaveBeenCalledWith(
      'user-1',
      'caterham-academy',
    );
    expect(saveBookings).not.toHaveBeenCalled();
  });
});
