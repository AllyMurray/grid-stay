import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';

vi.mock('~/lib/db/services/manual-day.server', () => ({
  createManualDay: vi.fn(),
}));

import { submitCreateManualDay } from './actions.server';

const allowedUser: User = {
  id: 'user-1',
  email: 'allymurray88@gmail.com',
  name: 'Ally Murray',
  picture: 'https://example.com/avatar.png',
  role: 'member',
};

const blockedUser: User = {
  ...allowedUser,
  id: 'user-2',
  email: 'driver@example.com',
};

describe('manual day action helper', () => {
  it('creates a manual day for the allowed account', async () => {
    const formData = new FormData();
    formData.set('date', '2026-03-01');
    formData.set('type', 'track_day');
    formData.set('circuit', 'Donington Park');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('description', 'Pre-season track day');
    formData.set('bookingUrl', 'https://example.com/bookings/pre-season');

    const saveManualDay = vi.fn(async () => ({
      dayId: 'manual:day-1',
    }));

    const result = await submitCreateManualDay(
      formData,
      allowedUser,
      saveManualDay as never,
    );

    expect(result).toEqual({
      ok: true,
      dayId: 'manual:day-1',
    });
    expect(saveManualDay).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-03-01',
        type: 'track_day',
        circuit: 'Donington Park',
      }),
      allowedUser,
    );
  });

  it('rejects manual day creation for other accounts', async () => {
    const formData = new FormData();
    formData.set('date', '2026-03-01');
    formData.set('type', 'track_day');
    formData.set('circuit', 'Donington Park');
    formData.set('provider', 'Caterham Motorsport');

    const result = await submitCreateManualDay(formData, blockedUser);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected manual day creation to be rejected');
    }
    expect(result.formError).toBe('This account cannot add manual days yet.');
  });

  it('returns field errors for an invalid manual day payload', async () => {
    const formData = new FormData();
    formData.set('date', 'invalid-date');
    formData.set('type', 'track_day');
    formData.set('circuit', '');
    formData.set('provider', 'Caterham Motorsport');
    formData.set('bookingUrl', 'notaurl');

    const result = await submitCreateManualDay(formData, allowedUser);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.formError).toBe('Could not save this manual day yet.');
    expect(result.fieldErrors.date?.[0]).toBeDefined();
    expect(result.fieldErrors.circuit?.[0]).toBeDefined();
    expect(result.fieldErrors.bookingUrl?.[0]).toBeDefined();
  });
});
