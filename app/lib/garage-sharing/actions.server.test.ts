import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';

vi.mock('~/lib/db/services/garage-sharing.server', () => ({
  createGarageShareRequest: vi.fn(),
  updateGarageShareRequestStatus: vi.fn(),
}));

import {
  submitGarageShareDecision,
  submitGarageShareRequest,
} from './actions.server';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  picture: '',
  role: 'member',
};

describe('garage sharing action helpers', () => {
  it('passes a valid garage request through to the service', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('garageOwnerUserId', 'owner-1');
    formData.set('garageBookingId', 'day-1');

    const saveRequest = vi.fn(async () => ({ requestId: 'request-1' }));

    await expect(
      submitGarageShareRequest(formData, user, saveRequest as never),
    ).resolves.toEqual({ ok: true });
    expect(saveRequest).toHaveBeenCalledWith(
      {
        dayId: 'day-1',
        garageOwnerUserId: 'owner-1',
        garageBookingId: 'day-1',
        message: '',
      },
      user,
    );
  });

  it('returns field errors for invalid garage request payloads', async () => {
    const result = await submitGarageShareRequest(new FormData(), user);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.formError).toBe('Could not send this garage request yet.');
    expect(result.fieldErrors.dayId?.[0]).toBeDefined();
  });

  it('passes garage request decisions through to the service', async () => {
    const formData = new FormData();
    formData.set('requestId', 'request-1');
    formData.set('status', 'approved');
    const saveDecision = vi.fn(async () => ({ requestId: 'request-1' }));

    await expect(
      submitGarageShareDecision(formData, user, saveDecision as never),
    ).resolves.toEqual({ ok: true });
    expect(saveDecision).toHaveBeenCalledWith(
      { requestId: 'request-1', status: 'approved' },
      user,
    );
  });
});
