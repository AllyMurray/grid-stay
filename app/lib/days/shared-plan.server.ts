import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  type DayPlanPersistence,
  dayPlanStore,
  SHARED_DAY_PLAN_SCOPE,
} from '~/lib/db/services/day-plan.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';

const MAX_SHARED_PLAN_NOTES_LENGTH = 1000;
const MAX_SHARED_PLAN_SHORT_FIELD_LENGTH = 120;
const SHARED_PLAN_FIELDS = [
  'notes',
  'dinnerVenue',
  'dinnerTime',
  'dinnerHeadcount',
  'dinnerNotes',
] as const;
type SharedPlanField = (typeof SHARED_PLAN_FIELDS)[number];

export interface SharedDayPlan {
  dayId: string;
  notes: string;
  dinnerVenue: string;
  dinnerTime: string;
  dinnerHeadcount: string;
  dinnerNotes: string;
  updatedByName: string;
  updatedAt: string;
}

export type SharedDayPlanActionResult =
  | {
      ok: true;
      plan: SharedDayPlan | null;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<'dayId' | SharedPlanField, string[]>>;
    };

function toSharedDayPlan(record: {
  dayId: string;
  notes: string;
  dinnerVenue?: string;
  dinnerTime?: string;
  dinnerHeadcount?: string;
  dinnerNotes?: string;
  dinnerPlan?: string;
  updatedByName: string;
  updatedAt: string;
}): SharedDayPlan {
  return {
    dayId: record.dayId,
    notes: record.notes,
    dinnerVenue: record.dinnerVenue ?? '',
    dinnerTime: record.dinnerTime ?? '',
    dinnerHeadcount: record.dinnerHeadcount ?? '',
    dinnerNotes: record.dinnerNotes ?? record.dinnerPlan ?? '',
    updatedByName: record.updatedByName,
    updatedAt: record.updatedAt,
  };
}

function sanitizeNotes(value: FormDataEntryValue | string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

async function dayExists(
  dayId: string,
  loadSnapshot: typeof getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays,
) {
  const [snapshot, manualDays] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
  ]);

  return [...(snapshot?.days ?? []), ...manualDays].some(
    (day) => day.dayId === dayId,
  );
}

export async function getSharedDayPlan(
  dayId: string,
  store: DayPlanPersistence = dayPlanStore,
): Promise<SharedDayPlan | null> {
  const record = await store.get(dayId);
  return record ? toSharedDayPlan(record) : null;
}

export async function setSharedDayPlan(
  input: {
    dayId: string;
    notes: string;
    dinnerVenue?: string;
    dinnerTime?: string;
    dinnerHeadcount?: string;
    dinnerNotes?: string;
    user: Pick<User, 'id' | 'name'>;
  },
  store: DayPlanPersistence = dayPlanStore,
): Promise<SharedDayPlan | null> {
  const notes = sanitizeNotes(input.notes);
  const dinnerVenue = sanitizeNotes(input.dinnerVenue ?? '');
  const dinnerTime = sanitizeNotes(input.dinnerTime ?? '');
  const dinnerHeadcount = sanitizeNotes(input.dinnerHeadcount ?? '');
  const dinnerNotes = sanitizeNotes(input.dinnerNotes ?? '');

  if (
    !notes &&
    !dinnerVenue &&
    !dinnerTime &&
    !dinnerHeadcount &&
    !dinnerNotes
  ) {
    await store.delete(input.dayId);
    return null;
  }

  const existing = await store.get(input.dayId);
  const now = new Date().toISOString();
  const changes = {
    notes,
    dinnerVenue,
    dinnerTime,
    dinnerHeadcount,
    dinnerNotes,
    dinnerPlan: '',
    updatedByUserId: input.user.id,
    updatedByName: input.user.name,
    updatedAt: now,
  };

  if (existing) {
    return toSharedDayPlan(await store.update(input.dayId, changes));
  }

  return toSharedDayPlan(
    await store.create({
      dayId: input.dayId,
      planScope: SHARED_DAY_PLAN_SCOPE,
      ...changes,
      createdAt: now,
    } as Parameters<DayPlanPersistence['create']>[0]),
  );
}

export async function submitSharedDayPlan(
  formData: FormData,
  user: User,
  store: DayPlanPersistence = dayPlanStore,
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
): Promise<SharedDayPlanActionResult> {
  const dayId = sanitizeNotes(formData.get('dayId'));
  const values = Object.fromEntries(
    SHARED_PLAN_FIELDS.map((field) => [
      field,
      sanitizeNotes(formData.get(field)),
    ]),
  ) as Record<SharedPlanField, string>;

  if (!dayId) {
    return {
      ok: false,
      formError: 'Could not save this shared note.',
      fieldErrors: {
        dayId: ['Choose a day before saving a shared note.'],
      },
    };
  }

  const fieldErrors: Partial<Record<SharedPlanField, string[]>> = {};
  const fieldLimits: Record<SharedPlanField, number> = {
    notes: MAX_SHARED_PLAN_NOTES_LENGTH,
    dinnerVenue: MAX_SHARED_PLAN_SHORT_FIELD_LENGTH,
    dinnerTime: MAX_SHARED_PLAN_SHORT_FIELD_LENGTH,
    dinnerHeadcount: 3,
    dinnerNotes: MAX_SHARED_PLAN_NOTES_LENGTH,
  };

  for (const field of SHARED_PLAN_FIELDS) {
    const limit = fieldLimits[field];
    if (values[field].length > limit) {
      fieldErrors[field] = [`Keep this field under ${limit} characters.`];
    }
  }

  if (
    values.dinnerTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.dinnerTime)
  ) {
    fieldErrors.dinnerTime = ['Use a 24-hour time, for example 19:30.'];
  }

  if (
    values.dinnerHeadcount &&
    (!/^\d+$/.test(values.dinnerHeadcount) ||
      Number(values.dinnerHeadcount) < 1 ||
      Number(values.dinnerHeadcount) > 99)
  ) {
    fieldErrors.dinnerHeadcount = ['Use a whole number between 1 and 99.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      formError: 'Could not save this shared note.',
      fieldErrors,
    };
  }

  if (!(await dayExists(dayId, loadSnapshot, loadManualDays))) {
    return {
      ok: false,
      formError: 'This day is no longer available for shared notes.',
      fieldErrors: {
        dayId: ['This day is no longer available for shared notes.'],
      },
    };
  }

  return {
    ok: true,
    plan: await setSharedDayPlan(
      {
        dayId,
        ...values,
        user,
      },
      store,
    ),
  };
}
