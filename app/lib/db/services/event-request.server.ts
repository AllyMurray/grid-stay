import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import { getRaceSeriesDaysForDay } from '~/lib/days/series.server';
import { reconcileSeriesSubscriptionsForDays } from '~/lib/days/series-subscriptions.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { createAvailableDayNotificationsSafely } from '~/lib/db/services/day-notification.server';
import {
  type ApproveEventRequestInput,
  ApproveEventRequestSchema,
  type CreateEventRequestInput,
  CreateEventRequestSchema,
  type RejectEventRequestInput,
  RejectEventRequestSchema,
} from '~/lib/schemas/event-request';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import {
  EventRequestEntity,
  type EventRequestRecord,
} from '../entities/event-request.server';
import type { ManualDayRecord } from '../entities/manual-day.server';
import {
  createManualDay,
  listManagedManualDays,
  listManualDays,
  toAvailableManualDay,
} from './manual-day.server';

export const EVENT_REQUEST_SCOPE = 'event-request';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export interface EventRequestPersistence {
  create(item: EventRequestRecord): Promise<EventRequestRecord>;
  update(
    requestId: string,
    changes: Partial<EventRequestRecord>,
  ): Promise<EventRequestRecord>;
  get(requestId: string): Promise<EventRequestRecord | null>;
  listAll(): Promise<EventRequestRecord[]>;
  listByStatus(
    status: EventRequestRecord['status'],
  ): Promise<EventRequestRecord[]>;
}

export type EventRequestActionResult =
  | {
      ok: true;
      message: string;
      request: EventRequestRecord;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateEventRequestInput>;
    };

type AdminEventRequestFieldName =
  | keyof ApproveEventRequestInput
  | keyof RejectEventRequestInput
  | 'intent';

export type AdminEventRequestActionResult =
  | {
      ok: true;
      intent: 'approveEventRequest';
      message: string;
      request: EventRequestRecord;
      manualDay: ManualDayRecord;
    }
  | {
      ok: true;
      intent: 'rejectEventRequest';
      message: string;
      request: EventRequestRecord;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<AdminEventRequestFieldName>;
    };

export const eventRequestStore: EventRequestPersistence = {
  async create(item) {
    await EventRequestEntity.create(item).go({ response: 'none' });
    return item;
  },
  async update(requestId, changes) {
    const updated = await EventRequestEntity.patch({
      requestId,
      requestScope: EVENT_REQUEST_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async get(requestId) {
    const response = await EventRequestEntity.get({
      requestId,
      requestScope: EVENT_REQUEST_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await EventRequestEntity.query
      .byScope({ requestScope: EVENT_REQUEST_SCOPE })
      .go();
    return response.data;
  },
  async listByStatus(status) {
    const response = await EventRequestEntity.query.byStatus({ status }).go();
    return response.data;
  },
};

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compareEventRequestsNewestFirst(
  left: EventRequestRecord,
  right: EventRequestRecord,
) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.requestId.localeCompare(left.requestId);
}

function createRecord(
  input: CreateEventRequestInput,
  user: User,
  createdAt = new Date().toISOString(),
): EventRequestRecord {
  const record = {
    requestId: ulid(),
    requestScope: EVENT_REQUEST_SCOPE,
    status: 'pending',
    date: input.date,
    type: input.type,
    title: input.title,
    location: input.location,
    provider: input.provider,
    description: input.description,
    submittedByUserId: user.id,
    submittedByName: user.name,
    submittedByEmail: user.email,
    createdAt,
    updatedAt: createdAt,
  } as EventRequestRecord;
  const bookingUrl = sanitizeOptional(input.bookingUrl);
  if (bookingUrl) {
    record.bookingUrl = bookingUrl;
  }

  return record;
}

function createManualDayIdForRequest(requestId: string) {
  return `event-request:${requestId}`;
}

function createNotFoundError() {
  return new Response('Event request not found', { status: 404 });
}

function createInvalidStateError(message: string) {
  return new Response(message, { status: 400 });
}

function requirePendingRequest(request: EventRequestRecord) {
  if (request.status !== 'pending') {
    throw createInvalidStateError(
      'This event request has already been reviewed.',
    );
  }
}

function findExistingManualDay(
  manualDays: ManualDayRecord[],
  requestId: string,
) {
  const manualDayId = createManualDayIdForRequest(requestId);
  return manualDays.find((day) => day.manualDayId === manualDayId) ?? null;
}

async function loadExistingRequest(
  requestId: string,
  store: EventRequestPersistence,
) {
  const request = await store.get(requestId);

  if (!request) {
    throw createNotFoundError();
  }

  return request;
}

async function reconcileApprovedSeriesDay(
  day: ManualDayRecord,
  loadSnapshot: typeof getAvailableDaysSnapshot,
  loadAvailableManualDays: typeof listManualDays,
  reconcileSeries: typeof reconcileSeriesSubscriptionsForDays,
) {
  if (!day.series) {
    return;
  }

  const selectedDay = toAvailableManualDay(day);
  const [snapshot, manualDays] = await Promise.all([
    loadSnapshot(),
    loadAvailableManualDays(),
  ]);
  const allDays = [...(snapshot?.days ?? []), ...manualDays];
  const series = getRaceSeriesDaysForDay(
    allDays.some((entry) => entry.dayId === selectedDay.dayId)
      ? allDays
      : [...allDays, selectedDay],
    selectedDay.dayId,
  );

  if (series) {
    await reconcileSeries(series.days);
  }
}

export async function createEventRequest(
  input: CreateEventRequestInput,
  user: User,
  store: EventRequestPersistence = eventRequestStore,
): Promise<EventRequestRecord> {
  return store.create(createRecord(input, user));
}

export async function submitEventRequestAction(
  formData: FormData,
  user: User,
  store: EventRequestPersistence = eventRequestStore,
): Promise<EventRequestActionResult> {
  const parsed = CreateEventRequestSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not send this event request yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const request = await createEventRequest(parsed.data, user, store);

  return {
    ok: true,
    message: 'Thanks, this event has been sent for admin review.',
    request,
  };
}

export async function approveEventRequest(
  input: ApproveEventRequestInput,
  user: Pick<User, 'id' | 'name'>,
  dependencies: {
    requestStore?: EventRequestPersistence;
    saveManualDay?: typeof createManualDay;
    loadManagedManualDays?: typeof listManagedManualDays;
    loadAvailableManualDays?: typeof listManualDays;
    loadSnapshot?: typeof getAvailableDaysSnapshot;
    notifyAvailableDays?: typeof createAvailableDayNotificationsSafely;
    reconcileSeries?: typeof reconcileSeriesSubscriptionsForDays;
  } = {},
): Promise<{ request: EventRequestRecord; manualDay: ManualDayRecord }> {
  const requestStore = dependencies.requestStore ?? eventRequestStore;
  const saveManualDay = dependencies.saveManualDay ?? createManualDay;
  const loadManagedManualDayRecords =
    dependencies.loadManagedManualDays ?? listManagedManualDays;
  const loadAvailableManualDayRecords =
    dependencies.loadAvailableManualDays ?? listManualDays;
  const loadSnapshot = dependencies.loadSnapshot ?? getAvailableDaysSnapshot;
  const notifyAvailableDays =
    dependencies.notifyAvailableDays ?? createAvailableDayNotificationsSafely;
  const reconcileSeries =
    dependencies.reconcileSeries ?? reconcileSeriesSubscriptionsForDays;
  const request = await loadExistingRequest(input.requestId, requestStore);
  requirePendingRequest(request);

  const manualDayId = createManualDayIdForRequest(request.requestId);
  const existingManualDay = findExistingManualDay(
    await loadManagedManualDayRecords(),
    request.requestId,
  );
  const manualDayInput: CreateManualDayInput = {
    date: input.date,
    type: input.type,
    circuit: input.circuit,
    provider: input.provider,
    series: input.series,
    description: input.description,
    bookingUrl: input.bookingUrl,
  };
  const manualDay =
    existingManualDay ??
    (await saveManualDay(manualDayInput, user as User, undefined, {
      manualDayId,
    }));

  if (!existingManualDay) {
    await notifyAvailableDays([toAvailableManualDay(manualDay)]);
  }

  await reconcileApprovedSeriesDay(
    manualDay,
    loadSnapshot,
    loadAvailableManualDayRecords,
    reconcileSeries,
  );

  const reviewedAt = new Date().toISOString();
  const updated = await requestStore.update(request.requestId, {
    status: 'approved',
    reviewedByUserId: user.id,
    reviewedByName: user.name,
    reviewedAt,
    approvedManualDayId: manualDay.manualDayId,
    approvedDayId: manualDay.dayId,
    updatedAt: reviewedAt,
  });

  return {
    request: updated,
    manualDay,
  };
}

export async function rejectEventRequest(
  input: RejectEventRequestInput,
  user: Pick<User, 'id' | 'name'>,
  store: EventRequestPersistence = eventRequestStore,
): Promise<EventRequestRecord> {
  const request = await loadExistingRequest(input.requestId, store);
  requirePendingRequest(request);

  const reviewedAt = new Date().toISOString();
  const changes: Partial<EventRequestRecord> = {
    status: 'rejected',
    reviewedByUserId: user.id,
    reviewedByName: user.name,
    reviewedAt,
    updatedAt: reviewedAt,
  };
  const rejectionReason = sanitizeOptional(input.rejectionReason);
  if (rejectionReason) {
    changes.rejectionReason = rejectionReason;
  }

  return store.update(request.requestId, changes);
}

function toAdminErrorResult(
  formError: string,
  fieldErrors: FieldErrors<AdminEventRequestFieldName> = {},
): AdminEventRequestActionResult {
  return {
    ok: false,
    formError,
    fieldErrors,
  };
}

export async function submitAdminEventRequestAction(
  formData: FormData,
  user: Pick<User, 'id' | 'name'>,
  dependencies: Parameters<typeof approveEventRequest>[2] & {
    requestStore?: EventRequestPersistence;
  } = {},
): Promise<AdminEventRequestActionResult> {
  const intent = formData.get('intent');
  const requestStore = dependencies.requestStore ?? eventRequestStore;

  try {
    if (intent === 'approveEventRequest') {
      const parsed = ApproveEventRequestSchema.safeParse(
        Object.fromEntries(formData),
      );

      if (!parsed.success) {
        return toAdminErrorResult(
          'Could not approve this event request yet.',
          parsed.error.flatten().fieldErrors,
        );
      }

      const result = await approveEventRequest(parsed.data, user, {
        ...dependencies,
        requestStore,
      });

      return {
        ok: true,
        intent,
        message: 'Event request approved and added to the calendar.',
        ...result,
      };
    }

    if (intent === 'rejectEventRequest') {
      const parsed = RejectEventRequestSchema.safeParse(
        Object.fromEntries(formData),
      );

      if (!parsed.success) {
        return toAdminErrorResult(
          'Could not reject this event request yet.',
          parsed.error.flatten().fieldErrors,
        );
      }

      return {
        ok: true,
        intent,
        message: 'Event request rejected.',
        request: await rejectEventRequest(parsed.data, user, requestStore),
      };
    }
  } catch (error) {
    if (error instanceof Response && error.status === 404) {
      return toAdminErrorResult('This event request no longer exists.', {
        requestId: ['This event request no longer exists.'],
      });
    }
    if (error instanceof Response && error.status === 400) {
      return toAdminErrorResult(await error.text());
    }

    throw error;
  }

  return toAdminErrorResult('This event request action is not supported.');
}

export async function listRecentEventRequests(
  limit = 100,
  store: EventRequestPersistence = eventRequestStore,
): Promise<EventRequestRecord[]> {
  const requests = await store.listAll();
  return requests.sort(compareEventRequestsNewestFirst).slice(0, limit);
}

export async function listPendingEventRequests(
  store: EventRequestPersistence = eventRequestStore,
): Promise<EventRequestRecord[]> {
  const requests = await store.listByStatus('pending');
  return requests.sort(compareEventRequestsNewestFirst);
}
