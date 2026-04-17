import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';

vi.mock('~/lib/db/services/booking.server', () => ({
  applySharedStaySelection: vi.fn(),
  createBooking: vi.fn(),
  deleteBooking: vi.fn(),
  ensureBookingsForDays: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

import type { AvailableDay } from '~/lib/days/types';
import {
  submitBookingDelete,
  submitBookingUpdate,
  submitBulkRaceSeriesBooking,
  submitCreateBooking,
  submitSharedStaySelection,
} from './actions.server';

const user: User = {
  id: 'user-1',
  email: 'ally@example.com',
  name: 'Ally Murray',
  picture: 'https://example.com/avatar.png',
  role: 'member',
};

describe('booking action helpers', () => {
  it('accepts an empty description when creating a booking', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('date', '2026-05-10');
    formData.set('type', 'race_day');
    formData.set('circuit', 'Snetterton');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('description', '');
    formData.set('status', 'booked');

    const saveBooking = vi.fn(async () => ({
      bookingId: 'booking-1',
    }));

    const result = await submitCreateBooking(
      formData,
      user,
      saveBooking as never,
    );

    expect(result).toEqual({ ok: true });
    expect(saveBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        dayId: 'day-1',
        description: '',
        status: 'booked',
      }),
      user,
    );
  });

  it('accepts maybe status when creating a booking', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('date', '2026-05-10');
    formData.set('type', 'race_day');
    formData.set('circuit', 'Snetterton');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('description', '');
    formData.set('status', 'maybe');

    const saveBooking = vi.fn(async () => ({
      bookingId: 'booking-1',
    }));

    const result = await submitCreateBooking(
      formData,
      user,
      saveBooking as never,
    );

    expect(result).toEqual({ ok: true });
    expect(saveBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        dayId: 'day-1',
        status: 'maybe',
      }),
      user,
    );
  });

  it('returns field errors instead of throwing for an invalid create payload', async () => {
    const formData = new FormData();
    formData.set('date', 'not-a-date');
    formData.set('type', 'race_day');
    formData.set('circuit', 'Snetterton');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('description', 'Round 1');
    formData.set('status', 'booked');

    const result = await submitCreateBooking(formData, user);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.formError).toBe('This day could not be added right now.');
    expect(result.fieldErrors.dayId?.[0]).toBeDefined();
    expect(result.fieldErrors.date?.[0]).toBeDefined();
  });

  it('returns field errors instead of throwing for an invalid update payload', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');
    formData.set('status', 'booked');
    formData.set('notes', 'x'.repeat(1001));

    const result = await submitBookingUpdate(formData, user.id);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.formError).toBe('Could not save this booking yet.');
    expect(result.fieldErrors.notes?.[0]).toBeDefined();
  });

  it('passes the booking id through when deleting a booking', async () => {
    const formData = new FormData();
    formData.set('bookingId', 'booking-1');

    const removeBooking = vi.fn(async () => undefined);

    const result = await submitBookingDelete(
      formData,
      user.id,
      removeBooking as never,
    );

    expect(result).toEqual({ ok: true });
    expect(removeBooking).toHaveBeenCalledWith(user.id, {
      bookingId: 'booking-1',
    });
  });

  it('returns field errors instead of throwing for an invalid delete payload', async () => {
    const result = await submitBookingDelete(new FormData(), user.id);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.formError).toBe('Could not delete this booking yet.');
    expect(result.fieldErrors.bookingId?.[0]).toBeDefined();
  });

  it('passes the selected shared stay through when joining from available days', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('date', '2026-05-10');
    formData.set('type', 'race_day');
    formData.set('circuit', 'Snetterton');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('description', 'Round 1');
    formData.set('status', 'booked');
    formData.set('accommodationName', 'Trackside Hotel');

    const saveSelection = vi.fn(async () => ({
      bookingId: 'booking-1',
    }));

    const result = await submitSharedStaySelection(
      formData,
      user,
      saveSelection as never,
    );

    expect(result).toEqual({ ok: true });
    expect(saveSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        dayId: 'day-1',
        accommodationName: 'Trackside Hotel',
      }),
      user,
    );
  });

  it('returns field errors instead of throwing for an invalid shared stay payload', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('date', '2026-05-10');
    formData.set('type', 'race_day');
    formData.set('circuit', 'Snetterton');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('description', 'Round 1');
    formData.set('status', 'booked');
    formData.set('accommodationName', '');

    const result = await submitSharedStaySelection(formData, user);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.formError).toBe('Could not save this shared stay yet.');
    expect(result.fieldErrors.accommodationName?.[0]).toBeDefined();
  });

  it('adds all rounds from the linked race series', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('status', 'booked');

    const snapshotDays: AvailableDay[] = [
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
          metadata: {
            series: 'Caterham Academy',
          },
        },
      },
      {
        dayId: 'day-2',
        date: '2026-05-24',
        type: 'race_day',
        circuit: 'Brands Hatch',
        provider: 'Caterham Motorsport',
        description: 'Round 2',
        source: {
          sourceType: 'caterham',
          sourceName: 'caterham',
          metadata: {
            series: 'Caterham Academy',
          },
        },
      },
      {
        dayId: 'day-3',
        date: '2026-06-10',
        type: 'race_day',
        circuit: 'Donington Park',
        provider: 'Caterham Motorsport',
        description: 'Round 3',
        source: {
          sourceType: 'caterham',
          sourceName: 'caterham',
          metadata: {
            series: 'Caterham 310R',
          },
        },
      },
    ];

    const saveBookings = vi.fn(async () => ({
      addedCount: 1,
      existingCount: 1,
    }));

    const result = await submitBulkRaceSeriesBooking(
      formData,
      user,
      async () => ({
        days: snapshotDays,
        errors: [],
        refreshedAt: '2026-04-17T09:00:00.000Z',
      }),
      saveBookings as never,
    );

    expect(result).toEqual({
      ok: true,
      seriesName: 'Caterham Academy',
      totalCount: 2,
      addedCount: 1,
      existingCount: 1,
    });
    expect(saveBookings).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          dayId: 'day-1',
          circuit: 'Snetterton',
        }),
        expect.objectContaining({
          dayId: 'day-2',
          circuit: 'Brands Hatch',
        }),
      ],
      'booked',
      user,
    );
  });

  it('returns a form error when the selected day is not linked to a race series', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('status', 'booked');

    const result = await submitBulkRaceSeriesBooking(
      formData,
      user,
      async () => ({
        days: [
          {
            dayId: 'day-1',
            date: '2026-05-10',
            type: 'track_day',
            circuit: 'Snetterton',
            provider: 'MSV Trackdays',
            description: 'Open pit lane',
            source: {
              sourceType: 'trackdays',
              sourceName: 'msv',
            },
          },
        ],
        errors: [],
        refreshedAt: '2026-04-17T09:00:00.000Z',
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected race series failure');
    }
    expect(result.formError).toBe(
      'This day is not linked to a race series yet.',
    );
  });
});
