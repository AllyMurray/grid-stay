import type { User } from '~/lib/auth/schemas';
import { getRaceSeriesDaysForDay } from '~/lib/days/series.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  applySharedStaySelection,
  createBooking,
  deleteBooking,
  ensureBookingsForDays,
  updateBooking,
} from '~/lib/db/services/booking.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { upsertSeriesSubscription } from '~/lib/db/services/series-subscription.server';
import type {
  BulkRaceSeriesBookingInput,
  CreateBookingInput,
  DeleteBookingInput,
  SharedStaySelectionInput,
  UpdateBookingInput,
} from '~/lib/schemas/booking';
import {
  BulkRaceSeriesBookingSchema,
  CreateBookingSchema,
  DeleteBookingSchema,
  SharedStaySelectionSchema,
  UpdateBookingSchema,
} from '~/lib/schemas/booking';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type CreateBookingActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateBookingInput>;
    };

type BookingEditorFieldName =
  | keyof UpdateBookingInput
  | keyof DeleteBookingInput;

export type BookingEditorActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<BookingEditorFieldName>;
    };

export type UpdateBookingActionResult = BookingEditorActionResult;
export type DeleteBookingActionResult = BookingEditorActionResult;

export type SharedStaySelectionActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof SharedStaySelectionInput>;
    };

export type BulkRaceSeriesBookingActionResult =
  | {
      ok: true;
      seriesName: string;
      totalCount: number;
      addedCount: number;
      existingCount: number;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof BulkRaceSeriesBookingInput>;
    };

export async function submitCreateBooking(
  formData: FormData,
  user: User,
  saveBooking: typeof createBooking = createBooking,
): Promise<CreateBookingActionResult> {
  const parsed = CreateBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'This day could not be added right now.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await saveBooking(parsed.data, user);
  return { ok: true };
}

export async function submitSharedStaySelection(
  formData: FormData,
  user: User,
  saveSelection: typeof applySharedStaySelection = applySharedStaySelection,
): Promise<SharedStaySelectionActionResult> {
  const parsed = SharedStaySelectionSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this shared stay yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await saveSelection(parsed.data, user);
  return { ok: true };
}

export async function submitBulkRaceSeriesBooking(
  formData: FormData,
  user: User,
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  saveBookings: typeof ensureBookingsForDays = ensureBookingsForDays,
  loadManualDays: typeof listManualDays = listManualDays,
  saveSubscription: typeof upsertSeriesSubscription = upsertSeriesSubscription,
): Promise<BulkRaceSeriesBookingActionResult> {
  const parsed = BulkRaceSeriesBookingSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not add the full race series right now.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const [snapshot, manualDays] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
  ]);
  const days = [...(snapshot?.days ?? []), ...manualDays];

  if (days.length === 0) {
    return {
      ok: false,
      formError:
        'The race calendar is not ready yet. Try again after the next refresh.',
      fieldErrors: {},
    };
  }

  const series = getRaceSeriesDaysForDay(days, parsed.data.dayId);
  if (!series || series.days.length === 0) {
    return {
      ok: false,
      formError: 'This day is not linked to a race series yet.',
      fieldErrors: {},
    };
  }

  const result = await saveBookings(
    series.days.map((day) => ({
      dayId: day.dayId,
      date: day.date,
      type: day.type,
      circuit: day.circuit,
      provider: day.provider,
      description: day.description,
      status: parsed.data.status,
    })),
    parsed.data.status,
    user,
  );
  await saveSubscription({
    userId: user.id,
    seriesKey: series.seriesKey,
    seriesName: series.seriesName,
    status: parsed.data.status,
  });

  return {
    ok: true,
    seriesName: series.seriesName,
    totalCount: series.days.length,
    addedCount: result.addedCount,
    existingCount: result.existingCount,
  };
}

export async function submitBookingUpdate(
  formData: FormData,
  userId: string,
  saveBooking: typeof updateBooking = updateBooking,
): Promise<UpdateBookingActionResult> {
  const parsed = UpdateBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this booking yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await saveBooking(userId, parsed.data);
  return { ok: true };
}

export async function submitBookingDelete(
  formData: FormData,
  userId: string,
  removeBooking: typeof deleteBooking = deleteBooking,
): Promise<DeleteBookingActionResult> {
  const parsed = DeleteBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not delete this booking yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await removeBooking(userId, parsed.data);
  return { ok: true };
}
