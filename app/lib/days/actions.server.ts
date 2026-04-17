import type { User } from '~/lib/auth/schemas';
import { createManualDay } from '~/lib/db/services/manual-day.server';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import { CreateManualDaySchema } from '~/lib/schemas/manual-day';
import { canCreateManualDays } from './manual-days.server';

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

  return {
    ok: true,
    dayId: day.dayId,
  };
}
