import { z } from 'zod';
import type { User } from '~/lib/auth/schemas';
import { normalizeAvailableDayCircuit } from '~/lib/days/aggregation.server';
import type { AvailableDay } from '~/lib/days/types';
import type { DayMergeRecord } from '~/lib/db/entities/day-merge.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  deleteDayMerge,
  listDayMerges,
  migrateMergedDayData,
  upsertDayMerge,
} from '~/lib/db/services/day-merge.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';

const DayMergeSchema = z.object({
  sourceDayId: z.string().trim().min(1, 'Choose the duplicate source day.'),
  targetDayId: z.string().trim().min(1, 'Choose the day to keep.'),
  reason: z.string().trim().max(200).optional().default(''),
});

const DeleteDayMergeSchema = z.object({
  sourceDayId: z.string().trim().min(1),
});

type DayMergeField = 'sourceDayId' | 'targetDayId' | 'reason';

export interface AdminDayMergeOption {
  dayId: string;
  label: string;
  date: string;
  circuit: string;
  provider: string;
}

export interface AdminDayMergeRule extends DayMergeRecord {
  sourceLabel?: string;
  targetLabel?: string;
}

export interface AdminDayMergesReport {
  days: AdminDayMergeOption[];
  merges: AdminDayMergeRule[];
}

export type AdminDayMergeActionResult =
  | {
      ok: true;
      message: string;
      movedBookingCount?: number;
      mergedBookingCount?: number;
      movedPlan?: boolean;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<DayMergeField, string[] | undefined>>;
    };

export interface AdminDayMergeActionDependencies {
  loadSnapshot?: typeof getAvailableDaysSnapshot;
  loadManualDays?: typeof listManualDays;
  saveMerge?: typeof upsertDayMerge;
  removeMerge?: typeof deleteDayMerge;
  migrate?: typeof migrateMergedDayData;
}

function compareDays(left: AvailableDay, right: AvailableDay) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }
  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }
  return left.dayId.localeCompare(right.dayId);
}

function formatDayLabel(day: AvailableDay) {
  return `${day.date} • ${day.circuit} • ${day.provider} • ${day.description}`;
}

function toDayOption(day: AvailableDay): AdminDayMergeOption {
  return {
    dayId: day.dayId,
    label: formatDayLabel(day),
    date: day.date,
    circuit: day.circuit,
    provider: day.provider,
  };
}

function formError(
  formErrorMessage: string,
  fieldErrors: Partial<Record<DayMergeField, string[] | undefined>> = {},
): AdminDayMergeActionResult {
  return {
    ok: false,
    formError: formErrorMessage,
    fieldErrors,
  };
}

async function loadMergeDays(
  loadSnapshot: typeof getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays,
): Promise<AvailableDay[]> {
  const [snapshot, manualDays] = await Promise.all([loadSnapshot(), loadManualDays()]);

  return [...(snapshot?.days ?? []), ...manualDays]
    .map(normalizeAvailableDayCircuit)
    .toSorted(compareDays);
}

export async function loadAdminDayMergesReport(
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
  loadMerges: typeof listDayMerges = listDayMerges,
): Promise<AdminDayMergesReport> {
  const [days, merges] = await Promise.all([
    loadMergeDays(loadSnapshot, loadManualDays),
    loadMerges(),
  ]);
  const labelsByDayId = new Map(days.map((day) => [day.dayId, formatDayLabel(day)]));

  return {
    days: days.map(toDayOption),
    merges: merges.map((merge) => ({
      ...merge,
      sourceLabel: labelsByDayId.get(merge.sourceDayId),
      targetLabel: labelsByDayId.get(merge.targetDayId),
    })),
  };
}

export async function submitAdminDayMergeAction(
  formData: FormData,
  user: Pick<User, 'id'>,
  dependencies: AdminDayMergeActionDependencies = {},
): Promise<AdminDayMergeActionResult> {
  const intent = formData.get('intent');

  if (intent === 'deleteMerge') {
    const parsed = DeleteDayMergeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return formError('Could not remove this merge rule.', parsed.error.flatten().fieldErrors);
    }

    await (dependencies.removeMerge ?? deleteDayMerge)(parsed.data.sourceDayId);
    return {
      ok: true,
      message: 'Day merge removed.',
    };
  }

  if (intent !== 'saveMerge') {
    return formError('This day merge action is not supported.');
  }

  const parsed = DayMergeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return formError('Could not save this day merge.', parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.sourceDayId === parsed.data.targetDayId) {
    return formError('Choose two different days.', {
      targetDayId: ['Choose a different target day.'],
    });
  }

  const days = await loadMergeDays(
    dependencies.loadSnapshot ?? getAvailableDaysSnapshot,
    dependencies.loadManualDays ?? listManualDays,
  );
  const sourceDay = days.find((day) => day.dayId === parsed.data.sourceDayId);
  const targetDay = days.find((day) => day.dayId === parsed.data.targetDayId);

  if (!sourceDay || !targetDay) {
    return formError('Both days must still exist before they can be merged.');
  }

  await (dependencies.saveMerge ?? upsertDayMerge)(parsed.data, user);
  const migration = await (dependencies.migrate ?? migrateMergedDayData)(
    sourceDay.dayId,
    targetDay,
  );

  return {
    ok: true,
    message: 'Day merge saved and existing plans migrated.',
    ...migration,
  };
}
