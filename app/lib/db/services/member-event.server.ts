import type { User } from '~/lib/auth/schemas';
import { createAvailableDayNotificationsSafely } from '~/lib/db/services/day-notification.server';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import {
  type CreateMemberEventInput,
  CreateMemberEventSchema,
} from '~/lib/schemas/member-event';
import type { ManualDayRecord } from '../entities/manual-day.server';
import { createManualDay, toAvailableManualDay } from './manual-day.server';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type MemberEventActionResult =
  | {
      ok: true;
      message: string;
      day: ManualDayRecord;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateMemberEventInput>;
    };

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildManualDayDescription(input: CreateMemberEventInput) {
  const details = sanitizeOptional(input.description);
  const description = details ? `${input.title}. ${details}` : input.title;
  return description.slice(0, 200);
}

function createManualDayInput(
  input: CreateMemberEventInput,
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

export async function submitMemberEventAction(
  formData: FormData,
  user: User,
  dependencies: {
    saveManualDay?: typeof createManualDay;
    notifyAvailableDays?: typeof createAvailableDayNotificationsSafely;
  } = {},
): Promise<MemberEventActionResult> {
  const parsed = CreateMemberEventSchema.safeParse(
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
