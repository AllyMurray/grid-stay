import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  type DayPlanPersistence,
  dayPlanStore,
  SHARED_DAY_PLAN_SCOPE,
} from '~/lib/db/services/day-plan.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';

const MAX_SHARED_PLAN_NOTES_LENGTH = 1000;

export interface SharedDayPlan {
  dayId: string;
  notes: string;
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
      fieldErrors: {
        dayId?: string[];
        notes?: string[];
      };
    };

function toSharedDayPlan(record: {
  dayId: string;
  notes: string;
  updatedByName: string;
  updatedAt: string;
}): SharedDayPlan {
  return {
    dayId: record.dayId,
    notes: record.notes,
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
    user: Pick<User, 'id' | 'name'>;
  },
  store: DayPlanPersistence = dayPlanStore,
): Promise<SharedDayPlan | null> {
  const notes = sanitizeNotes(input.notes);

  if (!notes) {
    await store.delete(input.dayId);
    return null;
  }

  const existing = await store.get(input.dayId);
  const now = new Date().toISOString();
  const changes = {
    notes,
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
  const notes = sanitizeNotes(formData.get('notes'));

  if (!dayId) {
    return {
      ok: false,
      formError: 'Could not save this shared note.',
      fieldErrors: {
        dayId: ['Choose a day before saving a shared note.'],
      },
    };
  }

  if (notes.length > MAX_SHARED_PLAN_NOTES_LENGTH) {
    return {
      ok: false,
      formError: 'Could not save this shared note.',
      fieldErrors: {
        notes: [
          `Keep shared notes under ${MAX_SHARED_PLAN_NOTES_LENGTH} characters.`,
        ],
      },
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
        notes,
        user,
      },
      store,
    ),
  };
}
