import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  type DayPlanPersistence,
  dayPlanStore,
  SHARED_DAY_PLAN_SCOPE,
} from '~/lib/db/services/day-plan.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';

const MAX_SHARED_PLAN_NOTES_LENGTH = 1000;
const SHARED_PLAN_FIELDS = [
  'notes',
  'dinnerPlan',
  'carShare',
  'checklist',
  'costSplit',
] as const;
type SharedPlanField = (typeof SHARED_PLAN_FIELDS)[number];

export interface SharedDayPlan {
  dayId: string;
  notes: string;
  dinnerPlan: string;
  carShare: string;
  checklist: string;
  costSplit: string;
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
  dinnerPlan?: string;
  carShare?: string;
  checklist?: string;
  costSplit?: string;
  updatedByName: string;
  updatedAt: string;
}): SharedDayPlan {
  return {
    dayId: record.dayId,
    notes: record.notes,
    dinnerPlan: record.dinnerPlan ?? '',
    carShare: record.carShare ?? '',
    checklist: record.checklist ?? '',
    costSplit: record.costSplit ?? '',
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
    dinnerPlan?: string;
    carShare?: string;
    checklist?: string;
    costSplit?: string;
    user: Pick<User, 'id' | 'name'>;
  },
  store: DayPlanPersistence = dayPlanStore,
): Promise<SharedDayPlan | null> {
  const notes = sanitizeNotes(input.notes);
  const dinnerPlan = sanitizeNotes(input.dinnerPlan ?? '');
  const carShare = sanitizeNotes(input.carShare ?? '');
  const checklist = sanitizeNotes(input.checklist ?? '');
  const costSplit = sanitizeNotes(input.costSplit ?? '');

  if (!notes && !dinnerPlan && !carShare && !checklist && !costSplit) {
    await store.delete(input.dayId);
    return null;
  }

  const existing = await store.get(input.dayId);
  const now = new Date().toISOString();
  const changes = {
    notes,
    dinnerPlan,
    carShare,
    checklist,
    costSplit,
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
  for (const field of SHARED_PLAN_FIELDS) {
    if (values[field].length <= MAX_SHARED_PLAN_NOTES_LENGTH) {
      continue;
    }

    fieldErrors[field] = [
      `Keep this field under ${MAX_SHARED_PLAN_NOTES_LENGTH} characters.`,
    ];
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
