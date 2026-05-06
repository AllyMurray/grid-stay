import { describe, expect, it, vi } from 'vite-plus/test';
import type { DayPlanRecord } from '~/lib/db/entities/day-plan.server';
import type { DayPlanPersistence } from '~/lib/db/services/day-plan.server';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/day-plan.server', () => ({
  SHARED_DAY_PLAN_SCOPE: 'shared',
  dayPlanStore: {},
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

import { setSharedDayPlan, submitSharedDayPlan } from './shared-plan.server';

function createStore(existing: DayPlanRecord | null = null): DayPlanPersistence {
  return {
    create: vi.fn(async (item) => item),
    update: vi.fn(async (_dayId, changes) => ({
      ...(existing as DayPlanRecord),
      ...changes,
    })),
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => existing),
    listAll: vi.fn(async () => (existing ? [existing] : [])),
  };
}

const user = {
  id: 'user-1',
  name: 'Driver One',
  email: 'driver@example.com',
  image: '',
  role: 'member' as const,
};

describe('shared day plan notes', () => {
  it('creates a shared day plan note', async () => {
    const store = createStore();

    const plan = await setSharedDayPlan(
      {
        dayId: 'day-1',
        notes: '  Book dinner near the circuit. ',
        dinnerPlan: '  19:30 at pub ',
        carShare: ' Meet at services ',
        user,
      },
      store,
    );

    expect(plan).toMatchObject({
      dayId: 'day-1',
      notes: 'Book dinner near the circuit.',
      dinnerPlan: '19:30 at pub',
      carShare: 'Meet at services',
      checklist: '',
      costSplit: '',
      updatedByName: 'Driver One',
    });
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dayId: 'day-1',
        planScope: 'shared',
        notes: 'Book dinner near the circuit.',
        dinnerPlan: '19:30 at pub',
        carShare: 'Meet at services',
        updatedByUserId: 'user-1',
      }),
    );
  });

  it('keeps a shared plan when any planning field is present', async () => {
    const store = createStore();

    await expect(
      setSharedDayPlan(
        {
          dayId: 'day-1',
          notes: '   ',
          checklist: 'Bring awning',
          user,
        },
        store,
      ),
    ).resolves.toMatchObject({
      dayId: 'day-1',
      notes: '',
      checklist: 'Bring awning',
    });
    expect(store.create).toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('deletes the shared plan when all fields are blank', async () => {
    const store = createStore();

    await expect(
      setSharedDayPlan(
        {
          dayId: 'day-1',
          notes: '   ',
          user,
        },
        store,
      ),
    ).resolves.toBeNull();
    expect(store.delete).toHaveBeenCalledWith('day-1');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('validates the selected day before saving from a form', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('notes', 'Meet at 08:30');
    formData.set('dinnerPlan', 'Pub at 19:30');
    const store = createStore();

    const result = await submitSharedDayPlan(
      formData,
      user,
      store,
      async () => ({
        refreshedAt: '2026-04-27T10:00:00.000Z',
        errors: [],
        days: [
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
            },
          },
        ],
      }),
      async () => [],
    );

    expect(result.ok).toBe(true);
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Meet at 08:30',
        dinnerPlan: 'Pub at 19:30',
      }),
    );
  });

  it('rejects notes for days that are no longer available', async () => {
    const formData = new FormData();
    formData.set('dayId', 'missing-day');
    formData.set('notes', 'Meet at 08:30');

    const result = await submitSharedDayPlan(
      formData,
      user,
      createStore(),
      async () => ({
        refreshedAt: '2026-04-27T10:00:00.000Z',
        errors: [],
        days: [],
      }),
      async () => [],
    );

    expect(result).toEqual({
      ok: false,
      formError: 'This day is no longer available for shared notes.',
      fieldErrors: {
        dayId: ['This day is no longer available for shared notes.'],
      },
    });
  });
});
