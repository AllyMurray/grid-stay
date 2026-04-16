import type { User } from '~/lib/auth/schemas';
import type { BookingStatus } from '~/lib/constants/enums';
import type { DayAttendanceSummary, SharedAttendee } from '~/lib/days/types';
import type {
  CreateBookingInput,
  DeleteBookingInput,
  SharedStaySelectionInput,
  UpdateBookingInput,
} from '~/lib/schemas/booking';
import { BookingEntity, type BookingRecord } from '../entities/booking.server';
import type { DayAttendanceOverview } from './day-attendance-summary.server';
import { dayAttendanceSummaryStore } from './day-attendance-summary.server';

export interface BookingPersistence {
  create(item: BookingRecord): Promise<BookingRecord>;
  update(
    userId: string,
    bookingId: string,
    changes: Partial<BookingRecord>,
  ): Promise<BookingRecord>;
  delete(userId: string, bookingId: string): Promise<void>;
  listByUser(userId: string): Promise<BookingRecord[]>;
  findByUserAndDay(
    userId: string,
    dayId: string,
  ): Promise<BookingRecord | null>;
  getByUser(userId: string, bookingId: string): Promise<BookingRecord | null>;
  listByDay(dayId: string): Promise<BookingRecord[]>;
}

export interface BookingSummaryPersistence {
  put(
    dayId: string,
    overview: DayAttendanceOverview,
    updatedAt: string,
  ): Promise<void>;
}

export const bookingStore: BookingPersistence = {
  async create(item) {
    await BookingEntity.create(item).go({
      response: 'none',
    });
    return item;
  },
  async update(userId, bookingId, changes) {
    const updated = await BookingEntity.patch({ userId, bookingId })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(userId, bookingId) {
    await BookingEntity.delete({ userId, bookingId }).go({
      response: 'none',
    });
  },
  async listByUser(userId) {
    const response = await BookingEntity.query.booking({ userId }).go();
    return response.data;
  },
  async findByUserAndDay(userId, dayId) {
    const response = await BookingEntity.query.byUserDay({ userId }).go();
    return response.data.find((booking) => booking.dayId === dayId) ?? null;
  },
  async getByUser(userId, bookingId) {
    const response = await BookingEntity.get({ userId, bookingId }).go();
    return response.data ?? null;
  },
  async listByDay(dayId) {
    const response = await BookingEntity.query.byDay({ dayId }).go();
    return response.data;
  },
};

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function syncDayAttendanceSummariesSafely(
  dayIds: string[],
  store: BookingPersistence,
  summaryStore: BookingSummaryPersistence,
): Promise<void> {
  try {
    await syncDayAttendanceSummaries(dayIds, store, summaryStore);
  } catch (error) {
    console.error('Failed to refresh booking attendance summaries', {
      dayIds,
      error,
    });
  }
}

export async function createBooking(
  input: CreateBookingInput,
  user: User,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<BookingRecord> {
  const existing = await store.findByUserAndDay(user.id, input.dayId);
  const now = new Date().toISOString();

  if (existing) {
    const updated = await store.update(user.id, existing.bookingId, {
      date: input.date,
      status: input.status,
      circuit: input.circuit,
      provider: input.provider,
      description: input.description,
      userName: user.name,
      userImage: user.picture,
      updatedAt: now,
    });
    await syncDayAttendanceSummariesSafely(
      [updated.dayId],
      store,
      summaryStore,
    );
    return updated;
  }

  const created = await store.create({
    bookingId: input.dayId,
    userId: user.id,
    userName: user.name,
    userImage: user.picture,
    dayId: input.dayId,
    date: input.date,
    status: input.status,
    circuit: input.circuit,
    provider: input.provider,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    bookingReference: undefined,
    accommodationName: undefined,
    accommodationReference: undefined,
    notes: undefined,
  } as BookingRecord);
  await syncDayAttendanceSummariesSafely([created.dayId], store, summaryStore);
  return created;
}

export async function updateBooking(
  userId: string,
  input: UpdateBookingInput,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<BookingRecord> {
  const existing = await store.getByUser(userId, input.bookingId);
  if (!existing) {
    throw new Response('Booking not found', { status: 404 });
  }

  const updated = await store.update(userId, input.bookingId, {
    status: input.status,
    userName: existing.userName,
    bookingReference: sanitizeOptional(input.bookingReference),
    accommodationName: sanitizeOptional(input.accommodationName),
    accommodationReference: sanitizeOptional(input.accommodationReference),
    notes: sanitizeOptional(input.notes),
    updatedAt: new Date().toISOString(),
  });
  await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
  return updated;
}

export async function deleteBooking(
  userId: string,
  input: DeleteBookingInput,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<void> {
  const existing = await store.getByUser(userId, input.bookingId);
  if (!existing) {
    throw new Response('Booking not found', { status: 404 });
  }

  await store.delete(userId, input.bookingId);
  await syncDayAttendanceSummariesSafely([existing.dayId], store, summaryStore);
}

export async function applySharedStaySelection(
  input: SharedStaySelectionInput,
  user: User,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<BookingRecord> {
  const existing = await store.findByUserAndDay(user.id, input.dayId);
  const now = new Date().toISOString();
  const accommodationName = input.accommodationName.trim();

  if (existing) {
    const updated = await store.update(user.id, existing.bookingId, {
      date: input.date,
      status: existing.status === 'cancelled' ? input.status : existing.status,
      circuit: input.circuit,
      provider: input.provider,
      description: input.description,
      userName: user.name,
      userImage: user.picture,
      accommodationName,
      updatedAt: now,
    });
    await syncDayAttendanceSummariesSafely(
      [updated.dayId],
      store,
      summaryStore,
    );
    return updated;
  }

  const created = await store.create({
    bookingId: input.dayId,
    userId: user.id,
    userName: user.name,
    userImage: user.picture,
    dayId: input.dayId,
    date: input.date,
    status: input.status,
    circuit: input.circuit,
    provider: input.provider,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    bookingReference: undefined,
    accommodationName,
    accommodationReference: undefined,
    notes: undefined,
  } as BookingRecord);
  await syncDayAttendanceSummariesSafely([created.dayId], store, summaryStore);
  return created;
}

export async function listMyBookings(
  userId: string,
  store: BookingPersistence = bookingStore,
): Promise<BookingRecord[]> {
  const bookings = await store.listByUser(userId);
  return bookings.sort((left, right) =>
    left.date === right.date
      ? left.circuit.localeCompare(right.circuit)
      : left.date.localeCompare(right.date),
  );
}

function toSharedAttendee(booking: BookingRecord): SharedAttendee {
  return {
    bookingId: booking.bookingId,
    userId: booking.userId,
    userName: booking.userName,
    status: booking.status as BookingStatus,
    accommodationName: booking.accommodationName,
  };
}

export function summarizeDayAttendances(
  bookings: BookingRecord[],
): DayAttendanceSummary {
  const attendees = bookings
    .map(toSharedAttendee)
    .sort((left, right) => left.userName.localeCompare(right.userName));
  const activeAttendees = attendees.filter(
    (attendee) => attendee.status !== 'cancelled',
  );

  const accommodationNames = [
    ...new Set(
      activeAttendees
        .map((attendee) => attendee.accommodationName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return {
    attendeeCount: activeAttendees.length,
    attendees,
    accommodationNames,
  };
}

function toDayAttendanceOverview(
  summary: DayAttendanceSummary,
): DayAttendanceOverview {
  return {
    attendeeCount: summary.attendeeCount,
    accommodationNames: summary.accommodationNames,
  };
}

export async function syncDayAttendanceSummary(
  dayId: string,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<DayAttendanceOverview> {
  const bookings = await store.listByDay(dayId);
  const summary = summarizeDayAttendances(bookings);
  const overview = toDayAttendanceOverview(summary);

  await summaryStore.put(dayId, overview, new Date().toISOString());

  return overview;
}

export async function listAttendanceByDay(
  dayId: string,
  store: BookingPersistence = bookingStore,
): Promise<DayAttendanceSummary> {
  return listAttendanceByDayIds([dayId], store);
}

export async function listAttendanceByDayIds(
  dayIds: string[],
  store: BookingPersistence = bookingStore,
): Promise<DayAttendanceSummary> {
  const bookingsByDay = await Promise.all(
    [...new Set(dayIds)].map((dayId) => store.listByDay(dayId)),
  );
  const bookings = bookingsByDay.flat();
  return summarizeDayAttendances(bookings);
}

export async function listAttendanceSummariesForDays(
  dayIds: string[],
  store: BookingPersistence = bookingStore,
): Promise<Map<string, DayAttendanceSummary>> {
  const summaries = await Promise.all(
    dayIds.map(
      async (dayId) =>
        [dayId, await listAttendanceByDay(dayId, store)] as const,
    ),
  );
  return new Map(summaries);
}

export async function syncDayAttendanceSummaries(
  dayIds: string[],
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<void> {
  const uniqueDayIds = [...new Set(dayIds)];
  await Promise.all(
    uniqueDayIds.map((dayId) =>
      syncDayAttendanceSummary(dayId, store, summaryStore),
    ),
  );
}
