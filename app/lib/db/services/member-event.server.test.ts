import { describe, expect, it, vi } from 'vite-plus/test';
import type { User } from '~/lib/auth/schemas';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';

vi.mock('~/lib/db/services/day-notification.server', () => ({
  createAvailableDayNotificationsSafely: vi.fn(),
}));
vi.mock('./manual-day.server', () => ({
  createManualDay: vi.fn(),
  toAvailableManualDay: (day: ManualDayRecord) => ({
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    bookingUrl: day.bookingUrl,
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: day.manualDayId,
    },
  }),
}));

import type { ManualDayRecord } from '../entities/manual-day.server';
import { submitMemberEventAction } from './member-event.server';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

function createFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set('date', '2026-06-14');
  formData.set('type', 'road_drive');
  formData.set('title', 'Sunday road drive');
  formData.set('location', 'North Coast 500');
  formData.set('provider', 'Grid Stay');
  formData.set('description', 'A group drive.');
  formData.set('bookingUrl', 'https://example.com/drive');

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

function createManualDayRecord(
  input: CreateManualDayInput,
  owner: Pick<User, 'id'>,
): ManualDayRecord {
  return {
    ownerUserId: owner.id,
    visibilityScope: 'global',
    manualDayId: 'manual-day-1',
    dayId: 'manual:manual-day-1',
    date: input.date,
    type: input.type,
    circuit: input.circuit,
    provider: input.provider,
    series: input.series || undefined,
    description: input.description,
    bookingUrl: input.bookingUrl || undefined,
    createdAt: '2026-05-03T12:00:00.000Z',
    updatedAt: '2026-05-03T12:00:00.000Z',
  } as ManualDayRecord;
}

describe('member-added event service', () => {
  it('adds member-submitted events directly as manual days', async () => {
    const saveManualDay = vi.fn(async (input: CreateManualDayInput, owner: User) =>
      createManualDayRecord(input, owner),
    );
    const notifyAvailableDays = vi.fn(async () => []);

    const result = await submitMemberEventAction(createFormData(), user, {
      saveManualDay,
      notifyAvailableDays,
    });

    expect(result).toMatchObject({
      ok: true,
      message: 'Event added to Available Days.',
      day: {
        dayId: 'manual:manual-day-1',
        type: 'road_drive',
        circuit: 'North Coast 500',
      },
    });
    expect(saveManualDay).toHaveBeenCalledWith(
      {
        date: '2026-06-14',
        type: 'road_drive',
        circuit: 'North Coast 500',
        provider: 'Grid Stay',
        series: '',
        description: 'Sunday road drive. A group drive.',
        bookingUrl: 'https://example.com/drive',
      },
      user,
    );
    expect(notifyAvailableDays).toHaveBeenCalledWith([
      expect.objectContaining({
        dayId: 'manual:manual-day-1',
        type: 'road_drive',
        circuit: 'North Coast 500',
      }),
    ]);
  });

  it('returns field errors for invalid events', async () => {
    const saveManualDay = vi.fn(async (input: CreateManualDayInput, owner: User) =>
      createManualDayRecord(input, owner),
    );
    const notifyAvailableDays = vi.fn(async () => []);
    const result = await submitMemberEventAction(
      createFormData({
        date: 'not-a-date',
        title: '',
        location: '',
      }),
      user,
      {
        saveManualDay,
        notifyAvailableDays,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      formError: 'Could not add this event yet.',
      fieldErrors: {
        date: expect.any(Array),
        title: expect.any(Array),
        location: expect.any(Array),
      },
    });
    expect(saveManualDay).not.toHaveBeenCalled();
    expect(notifyAvailableDays).not.toHaveBeenCalled();
  });

  it('truncates member details to the manual day description limit', async () => {
    const saveManualDay = vi.fn(async (input: CreateManualDayInput, owner: User) =>
      createManualDayRecord(input, owner),
    );
    const longDescription = 'Details '.repeat(60);

    await submitMemberEventAction(
      createFormData({
        description: longDescription,
      }),
      user,
      {
        saveManualDay,
        notifyAvailableDays: vi.fn(async () => []),
      },
    );

    const input = saveManualDay.mock.calls[0]?.[0];
    expect(input?.description).toHaveLength(200);
    expect(input?.description).toMatch(/^Sunday road drive\. Details/);
  });
});
