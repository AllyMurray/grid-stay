import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';

vi.mock('~/lib/db/services/booking.server', () => ({
  createBooking: vi.fn(),
  updateBooking: vi.fn(),
}));

import { submitBookingUpdate, submitCreateBooking } from './actions.server';

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
});
