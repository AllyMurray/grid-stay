import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';

vi.mock('../entities/event-request.server', () => ({
  EventRequestEntity: {},
}));
vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));
vi.mock('~/lib/db/services/day-notification.server', () => ({
  createAvailableDayNotificationsSafely: vi.fn(),
}));
vi.mock('~/lib/days/series.server', () => ({
  getRaceSeriesDaysForDay: vi.fn(),
}));
vi.mock('~/lib/days/series-subscriptions.server', () => ({
  reconcileSeriesSubscriptionsForDays: vi.fn(),
}));
vi.mock('./manual-day.server', () => ({
  createManualDay: vi.fn(),
  listManagedManualDays: vi.fn(),
  listManualDays: vi.fn(),
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

import type { EventRequestRecord } from '../entities/event-request.server';
import type { ManualDayRecord } from '../entities/manual-day.server';
import {
  approveEventRequest,
  createEventRequest,
  EVENT_REQUEST_SCOPE,
  type EventRequestPersistence,
  listRecentEventRequests,
  rejectEventRequest,
  submitEventRequestAction,
} from './event-request.server';
import type { CreateManualDayOptions } from './manual-day.server';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

const admin = {
  id: 'admin-1',
  name: 'Admin One',
} as const;

function createRequest(
  overrides: Partial<EventRequestRecord> = {},
): EventRequestRecord {
  return {
    requestId: 'request-1',
    requestScope: EVENT_REQUEST_SCOPE,
    status: 'pending',
    date: '2026-05-10',
    type: 'road_drive',
    title: 'Sunday road drive',
    location: 'North Coast 500',
    provider: 'Grid Stay',
    description: 'A group drive.',
    submittedByUserId: user.id,
    submittedByName: user.name,
    submittedByEmail: user.email,
    createdAt: '2026-05-03T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
    ...overrides,
  } as EventRequestRecord;
}

function createMemoryStore(initialItems: EventRequestRecord[] = []) {
  const items = [...initialItems];
  const store: EventRequestPersistence = {
    async create(item) {
      items.push(item);
      return item;
    },
    async update(requestId, changes) {
      const index = items.findIndex((item) => item.requestId === requestId);

      if (index === -1) {
        throw new Error(`Missing event request ${requestId}`);
      }

      items[index] = {
        ...items[index],
        ...changes,
      } as EventRequestRecord;

      return items[index]!;
    },
    async get(requestId) {
      return items.find((item) => item.requestId === requestId) ?? null;
    },
    async listAll() {
      return [...items];
    },
    async listByStatus(status) {
      return items.filter((item) => item.status === status);
    },
  };

  return { items, store };
}

function createApprovalDependencies(
  requestStore: EventRequestPersistence,
  manualDays: ManualDayRecord[] = [],
) {
  const notifyAvailableDays = vi.fn(async () => []);
  const saveManualDay = vi.fn(
    async (
      input: CreateManualDayInput,
      saveUser: Pick<User, 'id'>,
      _store: unknown,
      options?: CreateManualDayOptions,
    ): Promise<ManualDayRecord> => {
      const manualDayId = options?.manualDayId ?? 'manual-day-1';
      const day = {
        ownerUserId: saveUser.id,
        visibilityScope: 'global',
        manualDayId,
        dayId: `manual:${manualDayId}`,
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
      manualDays.push(day);
      return day;
    },
  );

  return {
    requestStore,
    saveManualDay,
    loadManagedManualDays: vi.fn(async () => [...manualDays]),
    loadAvailableManualDays: vi.fn(async () => []),
    loadSnapshot: vi.fn(async () => ({
      refreshedAt: '2026-05-03T09:00:00.000Z',
      days: [],
      errors: [],
    })),
    notifyAvailableDays,
    reconcileSeries: vi.fn(async () => ({
      seriesKey: null,
      seriesName: null,
      subscriptionCount: 0,
      bookingCount: 0,
    })),
  };
}

describe('event request service', () => {
  it('creates a pending event request from form data', async () => {
    const memory = createMemoryStore();
    const formData = new FormData();
    formData.set('date', '2026-06-14');
    formData.set('type', 'road_drive');
    formData.set('title', 'Sunday road drive');
    formData.set('location', 'North Coast 500');
    formData.set('provider', 'Grid Stay');
    formData.set('description', 'A group drive.');
    formData.set('bookingUrl', 'https://example.com/drive');

    const result = await submitEventRequestAction(formData, user, memory.store);

    expect(result).toMatchObject({
      ok: true,
      request: {
        requestScope: EVENT_REQUEST_SCOPE,
        status: 'pending',
        type: 'road_drive',
        location: 'North Coast 500',
        submittedByEmail: 'driver@example.com',
      },
    });
    expect(memory.items).toHaveLength(1);
  });

  it('returns field errors for invalid requests', async () => {
    const memory = createMemoryStore();
    const formData = new FormData();
    formData.set('date', 'not-a-date');
    formData.set('type', 'road_drive');
    formData.set('title', '');
    formData.set('location', '');
    formData.set('provider', 'Grid Stay');

    const result = await submitEventRequestAction(formData, user, memory.store);

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        date: expect.any(Array),
        title: expect.any(Array),
        location: expect.any(Array),
      },
    });
    expect(memory.items).toHaveLength(0);
  });

  it('approves a request into a deterministic manual day', async () => {
    const memory = createMemoryStore([createRequest()]);
    const manualDays: ManualDayRecord[] = [];
    const dependencies = createApprovalDependencies(memory.store, manualDays);

    const result = await approveEventRequest(
      {
        requestId: 'request-1',
        date: '2026-05-10',
        type: 'road_drive',
        circuit: 'North Coast 500',
        provider: 'Grid Stay',
        series: '',
        description: 'Sunday road drive.',
        bookingUrl: '',
      },
      admin,
      dependencies,
    );

    expect(result.request).toMatchObject({
      status: 'approved',
      reviewedByUserId: 'admin-1',
      approvedManualDayId: 'event-request:request-1',
      approvedDayId: 'manual:event-request:request-1',
    });
    expect(result.manualDay).toMatchObject({
      manualDayId: 'event-request:request-1',
      type: 'road_drive',
      circuit: 'North Coast 500',
    });
    expect(dependencies.notifyAvailableDays).toHaveBeenCalledWith([
      expect.objectContaining({
        dayId: 'manual:event-request:request-1',
        type: 'road_drive',
      }),
    ]);
  });

  it('reuses an existing manual day if a previous approval partially completed', async () => {
    const existingManualDay = {
      ownerUserId: 'admin-1',
      visibilityScope: 'global',
      manualDayId: 'event-request:request-1',
      dayId: 'manual:event-request:request-1',
      date: '2026-05-10',
      type: 'road_drive',
      circuit: 'North Coast 500',
      provider: 'Grid Stay',
      description: 'Sunday road drive.',
      createdAt: '2026-05-03T12:00:00.000Z',
      updatedAt: '2026-05-03T12:00:00.000Z',
    } as ManualDayRecord;
    const memory = createMemoryStore([createRequest()]);
    const dependencies = createApprovalDependencies(memory.store, [
      existingManualDay,
    ]);

    await approveEventRequest(
      {
        requestId: 'request-1',
        date: '2026-05-10',
        type: 'road_drive',
        circuit: 'North Coast 500',
        provider: 'Grid Stay',
        series: '',
        description: 'Sunday road drive.',
        bookingUrl: '',
      },
      admin,
      dependencies,
    );

    expect(dependencies.saveManualDay).not.toHaveBeenCalled();
    expect(dependencies.notifyAvailableDays).not.toHaveBeenCalled();
  });

  it('rejects a pending request with an optional note', async () => {
    const memory = createMemoryStore([createRequest()]);

    const request = await rejectEventRequest(
      {
        requestId: 'request-1',
        rejectionReason: 'Duplicate of an existing day.',
      },
      admin,
      memory.store,
    );

    expect(request).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Duplicate of an existing day.',
      reviewedByName: 'Admin One',
    });
  });

  it('lists recent requests newest first', async () => {
    const memory = createMemoryStore([
      createRequest(),
      createRequest({
        requestId: 'request-2',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
    ]);

    await expect(listRecentEventRequests(1, memory.store)).resolves.toEqual([
      expect.objectContaining({ requestId: 'request-2' }),
    ]);
  });

  it('raises a not found response when approving a missing request', async () => {
    const memory = createMemoryStore();
    const dependencies = createApprovalDependencies(memory.store);

    await expect(
      approveEventRequest(
        {
          requestId: 'missing',
          date: '2026-05-10',
          type: 'road_drive',
          circuit: 'North Coast 500',
          provider: 'Grid Stay',
          series: '',
          description: 'Sunday road drive.',
          bookingUrl: '',
        },
        admin,
        dependencies,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('creates records directly from parsed input', async () => {
    const memory = createMemoryStore();

    const request = await createEventRequest(
      {
        date: '2026-06-14',
        type: 'track_day',
        title: 'Club track day',
        location: 'Bedford Autodrome',
        provider: 'Caterham and Lotus 7 Club',
        description: '',
        bookingUrl: '',
      },
      user,
      memory.store,
    );

    expect(request).toMatchObject({
      status: 'pending',
      type: 'track_day',
      title: 'Club track day',
    });
  });
});
