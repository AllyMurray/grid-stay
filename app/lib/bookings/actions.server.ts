import type { User } from '~/lib/auth/schemas';
import {
  hasBookedAccommodation,
  resolveAccommodationStatus,
} from '~/lib/bookings/accommodation';
import { normalizeAvailableDayCircuit } from '~/lib/days/aggregation.server';
import { getRaceSeriesDaysForDay } from '~/lib/days/series.server';
import type { AvailableDay } from '~/lib/days/types';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  applySharedStaySelection,
  createBooking,
  deleteBooking,
  ensureBookingsForDays,
  updateBooking,
} from '~/lib/db/services/booking.server';
import {
  createOrUpdateHotelFromSelection,
  getHotelById,
  upsertHotelReview,
} from '~/lib/db/services/hotel.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { upsertSeriesSubscription } from '~/lib/db/services/series-subscription.server';
import { queueHotelSummaryRefreshSafely } from '~/lib/hotels/summary-queue.server';
import type {
  BulkRaceSeriesBookingInput,
  CreateBookingInput,
  CreateBookingRequestInput,
  DeleteBookingInput,
  SharedStaySelectionRequestInput,
  UpdateBookingInput,
} from '~/lib/schemas/booking';
import {
  BulkRaceSeriesBookingSchema,
  CreateBookingRequestSchema,
  DeleteBookingSchema,
  SharedStaySelectionRequestSchema,
  UpdateBookingSchema,
} from '~/lib/schemas/booking';
import { HotelReviewSchema } from '~/lib/schemas/hotel';

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type CreateBookingActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof CreateBookingRequestInput>;
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

export type HotelReviewActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<
        | 'hotelId'
        | 'rating'
        | 'trailerParking'
        | 'secureParking'
        | 'lateCheckIn'
        | 'parkingNotes'
        | 'generalNotes'
      >;
    };

export type SharedStaySelectionActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<keyof SharedStaySelectionRequestInput>;
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

async function resolveBookableDay(
  dayId: string,
  loadSnapshot: typeof getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays,
): Promise<AvailableDay | null> {
  const [snapshot, manualDays] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
  ]);
  const days = [...(snapshot?.days ?? []), ...manualDays];
  const day = days.find((entry) => entry.dayId === dayId);
  return day ? normalizeAvailableDayCircuit(day) : null;
}

function toCreateBookingInput(
  day: AvailableDay,
  status: CreateBookingInput['status'],
): CreateBookingInput {
  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    ...(day.circuitId ? { circuitId: day.circuitId } : {}),
    ...(day.circuitName ? { circuitName: day.circuitName } : {}),
    ...(day.layout ? { layout: day.layout } : {}),
    ...(day.circuitKnown !== undefined
      ? { circuitKnown: day.circuitKnown }
      : {}),
    provider: day.provider,
    description: day.description,
    status,
  };
}

export async function submitCreateBooking(
  formData: FormData,
  user: User,
  saveBooking: typeof createBooking = createBooking,
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
): Promise<CreateBookingActionResult> {
  const parsed = CreateBookingRequestSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'This day could not be added right now.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const day = await resolveBookableDay(
    parsed.data.dayId,
    loadSnapshot,
    loadManualDays,
  );

  if (!day) {
    return {
      ok: false,
      formError: 'This day is no longer available to add.',
      fieldErrors: {
        dayId: ['This day is no longer available to add.'],
      },
    };
  }

  await saveBooking(toCreateBookingInput(day, parsed.data.status), user);
  return { ok: true };
}

export async function submitSharedStaySelection(
  formData: FormData,
  user: User,
  saveSelection: typeof applySharedStaySelection = applySharedStaySelection,
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
): Promise<SharedStaySelectionActionResult> {
  const parsed = SharedStaySelectionRequestSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this accommodation yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const day = await resolveBookableDay(
    parsed.data.dayId,
    loadSnapshot,
    loadManualDays,
  );

  if (!day) {
    return {
      ok: false,
      formError: 'This day is no longer available to update.',
      fieldErrors: {
        dayId: ['This day is no longer available to update.'],
      },
    };
  }

  await saveSelection(
    {
      ...toCreateBookingInput(day, parsed.data.status),
      accommodationName: parsed.data.accommodationName,
    },
    user,
  );
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
  const days = [...(snapshot?.days ?? []), ...manualDays].map(
    normalizeAvailableDayCircuit,
  );

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
      ...(day.circuitId ? { circuitId: day.circuitId } : {}),
      ...(day.circuitName ? { circuitName: day.circuitName } : {}),
      ...(day.layout ? { layout: day.layout } : {}),
      ...(day.circuitKnown !== undefined
        ? { circuitKnown: day.circuitKnown }
        : {}),
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
  resolveHotel: typeof createOrUpdateHotelFromSelection = createOrUpdateHotelFromSelection,
): Promise<UpdateBookingActionResult> {
  const parsed = UpdateBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this booking yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const bookingUpdate = {
    ...parsed.data,
    accommodationStatus: resolveAccommodationStatus(parsed.data),
  };
  const accommodationBooked = hasBookedAccommodation(bookingUpdate);
  const hotel = accommodationBooked
    ? await resolveHotel(bookingUpdate, userId)
    : null;
  await saveBooking(userId, {
    ...bookingUpdate,
    hotelId: hotel?.hotelId,
    accommodationName: accommodationBooked
      ? (hotel?.name ?? bookingUpdate.accommodationName)
      : '',
  });
  return { ok: true };
}

export async function submitHotelReview(
  formData: FormData,
  user: User,
): Promise<HotelReviewActionResult> {
  const parsed = HotelReviewSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not save this hotel feedback yet.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const hotel = await getHotelById(parsed.data.hotelId);
  if (!hotel) {
    return {
      ok: false,
      formError: 'Choose or save a hotel before adding feedback.',
      fieldErrors: {
        hotelId: ['Choose or save a hotel before adding feedback.'],
      },
    };
  }

  await upsertHotelReview(parsed.data, user);
  await queueHotelSummaryRefreshSafely(parsed.data.hotelId);
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
