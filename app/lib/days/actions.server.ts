import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { createAvailableDayNotificationsSafely } from '~/lib/db/services/day-notification.server';
import {
  createManualDay,
  listManualDays,
  toAvailableManualDay,
} from '~/lib/db/services/manual-day.server';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import { CreateManualDaySchema } from '~/lib/schemas/manual-day';
import { canCreateManualDays } from './manual-days.server';
import { getRaceSeriesDaysForDay } from './series.server';
import { reconcileSeriesSubscriptionsForDays } from './series-subscriptions.server';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type CreateManualDayActionResult =
  | {
      ok: true;
      dayId: string;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateManualDayInput>;
    };

export async function submitCreateManualDay(
  formData: FormData,
  user: User,
  saveManualDay: typeof createManualDay = createManualDay,
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
  reconcileSeries: typeof reconcileSeriesSubscriptionsForDays = reconcileSeriesSubscriptionsForDays,
  notifyAvailableDays: typeof createAvailableDayNotificationsSafely = createAvailableDayNotificationsSafely,
): Promise<CreateManualDayActionResult> {
  if (!canCreateManualDays(user)) {
    return {
      ok: false,
      formError: 'This account cannot add manual days yet.',
      fieldErrors: {},
    };
  }

  const parsed = CreateManualDaySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this manual day yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const day = await saveManualDay(parsed.data, user);
  const selectedDay = toAvailableManualDay(day);
  await notifyAvailableDays([selectedDay]);

  if (day.series) {
    const [snapshot, manualDays] = await Promise.all([
      loadSnapshot(),
      loadManualDays(),
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

  return {
    ok: true,
    dayId: day.dayId,
  };
}
