import type { User } from '~/lib/auth/schemas';
import { createAvailableDayNotificationsSafely } from '~/lib/db/services/day-notification.server';
import {
  type CreateEventRequestInput,
  CreateEventRequestSchema,
} from '~/lib/schemas/event-request';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import {
  EventRequestEntity,
  type EventRequestRecord,
} from '../entities/event-request.server';
import type { ManualDayRecord } from '../entities/manual-day.server';
import { createManualDay, toAvailableManualDay } from './manual-day.server';

export const EVENT_REQUEST_SCOPE = 'event-request';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export interface EventRequestPersistence {
  listAll(): Promise<EventRequestRecord[]>;
}

export type EventRequestActionResult =
  | {
      ok: true;
      message: string;
      day: ManualDayRecord;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateEventRequestInput>;
    };

export const eventRequestStore: EventRequestPersistence = {
  async listAll() {
    const response = await EventRequestEntity.query
      .byScope({ requestScope: EVENT_REQUEST_SCOPE })
      .go();
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

function buildManualDayDescription(input: CreateEventRequestInput) {
  const details = sanitizeOptional(input.description);
  const description = details ? `${input.title}. ${details}` : input.title;
  return description.slice(0, 200);
}

function createManualDayInput(
  input: CreateEventRequestInput,
): CreateManualDayInput {
  return {
    date: input.date,
    type: input.type,
    circuit: input.location,
    provider: input.provider,
    series: '',
    description: buildManualDayDescription(input),
    bookingUrl: input.bookingUrl,
  };
}

export async function submitEventRequestAction(
  formData: FormData,
  user: User,
  dependencies: {
    saveManualDay?: typeof createManualDay;
    notifyAvailableDays?: typeof createAvailableDayNotificationsSafely;
  } = {},
): Promise<EventRequestActionResult> {
  const parsed = CreateEventRequestSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not add this event yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const saveManualDay = dependencies.saveManualDay ?? createManualDay;
  const notifyAvailableDays =
    dependencies.notifyAvailableDays ?? createAvailableDayNotificationsSafely;
  const day = await saveManualDay(createManualDayInput(parsed.data), user);

  await notifyAvailableDays([toAvailableManualDay(day)]);

  return {
    ok: true,
    message: 'Event added to Available Days.',
    day,
  };
}

export async function listRecentEventRequests(
  limit = 100,
  store: EventRequestPersistence = eventRequestStore,
): Promise<EventRequestRecord[]> {
  const requests = await store.listAll();
  return requests.sort(compareEventRequestsNewestFirst).slice(0, limit);
}
