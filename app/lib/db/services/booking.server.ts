import type { User } from '~/lib/auth/schemas';
import {
  hasBookedAccommodation,
  isAccommodationStatus,
  resolveAccommodationStatus,
} from '~/lib/bookings/accommodation';
import type { BookingStatus } from '~/lib/constants/enums';
import { normalizeArrivalDateTime, resolveArrivalDateTime } from '~/lib/dates/arrival';
import type {
  DayAttendanceSummary,
  GarageShareOption,
  SharedAttendee,
  SharedGarageRequest,
} from '~/lib/days/types';
import type {
  BulkRaceSeriesBookingInput,
  CreateBookingInput,
  DeleteBookingInput,
  SharedStaySelectionInput,
  UpdateBookingGarageInput,
  UpdateBookingInput,
  UpdateBookingPrivateInput,
  UpdateBookingStayInput,
  UpdateBookingTripInput,
} from '~/lib/schemas/booking';
import { BookingEntity, type BookingRecord } from '../entities/booking.server';
import type { DayAttendanceOverview } from './day-attendance-summary.server';
import { dayAttendanceSummaryStore } from './day-attendance-summary.server';
import {
  type GarageShareRequestPersistence,
  type GarageShareRequestRecord,
  garageShareRequestStore,
} from './garage-share-request.server';

export interface BookingPersistence {
  create(item: BookingRecord): Promise<BookingRecord>;
  update(
    userId: string,
    bookingId: string,
    changes: Partial<BookingRecord>,
  ): Promise<BookingRecord>;
  delete(userId: string, bookingId: string): Promise<void>;
  listByUser(userId: string): Promise<BookingRecord[]>;
  findByUserAndDay(userId: string, dayId: string): Promise<BookingRecord | null>;
  getByUser(userId: string, bookingId: string): Promise<BookingRecord | null>;
  listByDay(dayId: string): Promise<BookingRecord[]>;
  claimGarageShareSpace?(
    userId: string,
    bookingId: string,
    maxApprovedShareCount: number,
    updatedAt: string,
  ): Promise<BookingRecord | null>;
  releaseGarageShareSpace?(
    userId: string,
    bookingId: string,
    updatedAt: string,
  ): Promise<BookingRecord | null>;
}

export interface BookingSummaryPersistence {
  put(dayId: string, overview: DayAttendanceOverview, updatedAt: string): Promise<void>;
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
  async claimGarageShareSpace(userId, bookingId, maxApprovedShareCount, updatedAt) {
    if (maxApprovedShareCount <= 0) {
      return null;
    }

    try {
      const updated = await BookingEntity.patch({ userId, bookingId })
        .add({ garageApprovedShareCount: 1 })
        .set({ updatedAt })
        .where(
          ({ garageApprovedShareCount, garageBooked, status }, { eq, lt, ne, notExists }) =>
            `${eq(garageBooked, true)} AND ${ne(status, 'cancelled')} AND (${notExists(garageApprovedShareCount)} OR ${lt(garageApprovedShareCount, maxApprovedShareCount)})`,
        )
        .go({ response: 'all_new' });
      return updated.data;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        return null;
      }

      throw error;
    }
  },
  async releaseGarageShareSpace(userId, bookingId, updatedAt) {
    try {
      const updated = await BookingEntity.patch({ userId, bookingId })
        .subtract({ garageApprovedShareCount: 1 })
        .set({ updatedAt })
        .where(({ garageApprovedShareCount }, { gt }) => gt(garageApprovedShareCount, 0))
        .go({ response: 'all_new' });
      return updated.data;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        return null;
      }

      throw error;
    }
  },
};

function isConditionalCheckFailed(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ConditionalCheckFailedException'
  );
}

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function keepsVisibleAccommodationName(accommodationStatus?: string) {
  return (
    isAccommodationStatus(accommodationStatus) &&
    ['booked', 'staying_at_track'].includes(accommodationStatus)
  );
}

function getBookingRefreshChanges(
  existing: BookingRecord,
  input: CreateBookingInput,
  user: User,
  updatedAt: string,
): Partial<BookingRecord> | null {
  const changes: Partial<BookingRecord> = {};

  if (existing.date !== input.date) {
    changes.date = input.date;
  }
  if (existing.type !== input.type) {
    changes.type = input.type;
  }
  if (existing.circuit !== input.circuit) {
    changes.circuit = input.circuit;
  }
  if ((existing.circuitId ?? '') !== (input.circuitId ?? '')) {
    changes.circuitId = input.circuitId;
  }
  if ((existing.circuitName ?? '') !== (input.circuitName ?? '')) {
    changes.circuitName = input.circuitName;
  }
  if ((existing.layout ?? '') !== (input.layout ?? '')) {
    changes.layout = input.layout;
  }
  if ((existing.circuitKnown ?? false) !== (input.circuitKnown ?? false)) {
    changes.circuitKnown = input.circuitKnown;
  }
  if (existing.provider !== input.provider) {
    changes.provider = input.provider;
  }
  if (existing.description !== input.description) {
    changes.description = input.description;
  }
  if (existing.userName !== user.name) {
    changes.userName = user.name;
  }
  if ((existing.userImage ?? '') !== (user.picture ?? '')) {
    changes.userImage = user.picture;
  }

  if (Object.keys(changes).length === 0) {
    return null;
  }

  return {
    ...changes,
    status: existing.status,
    updatedAt,
  };
}

async function syncDayAttendanceSummariesSafely(
  dayIds: string[],
  store: BookingPersistence,
  summaryStore: BookingSummaryPersistence,
  requestStore: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<void> {
  try {
    await syncDayAttendanceSummaries(dayIds, store, summaryStore, requestStore);
  } catch (error) {
    console.error('Failed to refresh booking attendance summaries', {
      dayIds,
      error,
    });
    const { recordAppEventSafely } = await import('~/lib/db/services/app-event.server');
    await recordAppEventSafely({
      category: 'error',
      action: 'booking.attendanceSummary.failed',
      message: 'Failed to refresh booking attendance summaries.',
      subject: {
        type: 'day',
        id: dayIds.join(','),
      },
      metadata: {
        dayIds,
        error: error instanceof Error ? error.message : String(error),
      },
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
      type: input.type,
      status: input.status,
      circuit: input.circuit,
      circuitId: input.circuitId,
      circuitName: input.circuitName,
      layout: input.layout,
      circuitKnown: input.circuitKnown,
      provider: input.provider,
      description: input.description,
      userName: user.name,
      userImage: user.picture,
      updatedAt: now,
    });
    await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
    return updated;
  }

  const created = await store.create({
    bookingId: input.dayId,
    userId: user.id,
    userName: user.name,
    userImage: user.picture,
    dayId: input.dayId,
    date: input.date,
    type: input.type,
    status: input.status,
    circuit: input.circuit,
    circuitId: input.circuitId,
    circuitName: input.circuitName,
    layout: input.layout,
    circuitKnown: input.circuitKnown,
    provider: input.provider,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    bookingReference: undefined,
    arrivalDateTime: undefined,
    arrivalTime: undefined,
    hotelId: undefined,
    accommodationStatus: 'unknown',
    accommodationName: undefined,
    accommodationReference: undefined,
    garageBooked: false,
    garageCapacity: undefined,
    garageLabel: undefined,
    garageCostTotalPence: undefined,
    garageCostCurrency: undefined,
    notes: undefined,
  } as BookingRecord);
  await syncDayAttendanceSummariesSafely([created.dayId], store, summaryStore);
  return created;
}

export async function ensureBookingsForDays(
  inputs: CreateBookingInput[],
  defaultStatus: BulkRaceSeriesBookingInput['status'],
  user: User,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<{
  addedCount: number;
  existingCount: number;
}> {
  const existingBookings = await store.listByUser(user.id);
  const existingByDayId = new Map(existingBookings.map((booking) => [booking.dayId, booking]));
  const now = new Date().toISOString();
  const createdDayIds: string[] = [];
  let addedCount = 0;
  let existingCount = 0;

  for (const input of inputs) {
    const existing = existingByDayId.get(input.dayId);

    if (existing) {
      existingCount += 1;
      const changes = getBookingRefreshChanges(existing, input, user, now);

      if (changes) {
        await store.update(user.id, existing.bookingId, changes);
      }
      continue;
    }

    const created = await store.create({
      bookingId: input.dayId,
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: input.dayId,
      date: input.date,
      type: input.type,
      status: defaultStatus,
      circuit: input.circuit,
      circuitId: input.circuitId,
      circuitName: input.circuitName,
      layout: input.layout,
      circuitKnown: input.circuitKnown,
      provider: input.provider,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      bookingReference: undefined,
      arrivalDateTime: undefined,
      arrivalTime: undefined,
      hotelId: undefined,
      accommodationStatus: 'unknown',
      accommodationName: undefined,
      accommodationReference: undefined,
      garageBooked: false,
      garageCapacity: undefined,
      garageLabel: undefined,
      garageCostTotalPence: undefined,
      garageCostCurrency: undefined,
      notes: undefined,
    } as BookingRecord);
    createdDayIds.push(created.dayId);
    addedCount += 1;
  }

  if (createdDayIds.length > 0) {
    await syncDayAttendanceSummariesSafely(createdDayIds, store, summaryStore);
  }

  return {
    addedCount,
    existingCount,
  };
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

  const accommodationStatus = resolveAccommodationStatus(input);
  const accommodationBooked = hasBookedAccommodation({
    ...input,
    accommodationStatus,
  });
  const updated = await store.update(userId, input.bookingId, {
    status: input.status,
    userName: existing.userName,
    bookingReference: sanitizeOptional(input.bookingReference),
    arrivalDateTime: normalizeArrivalDateTime(input.arrivalDateTime),
    arrivalTime: undefined,
    accommodationStatus,
    hotelId: accommodationBooked ? sanitizeOptional(input.hotelId) : undefined,
    accommodationName: keepsVisibleAccommodationName(accommodationStatus)
      ? sanitizeOptional(input.accommodationName)
      : undefined,
    accommodationReference: accommodationBooked
      ? sanitizeOptional(input.accommodationReference)
      : undefined,
    garageBooked: input.garageBooked,
    garageCapacity: input.garageBooked ? input.garageCapacity : undefined,
    garageLabel: input.garageBooked ? sanitizeOptional(input.garageLabel) : undefined,
    garageCostTotalPence:
      input.garageBooked && input.garageCostTotalPence !== undefined
        ? input.garageCostTotalPence
        : undefined,
    garageCostCurrency:
      input.garageBooked && input.garageCostCurrency ? input.garageCostCurrency : undefined,
    notes: sanitizeOptional(input.notes),
    updatedAt: new Date().toISOString(),
  });
  await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
  return updated;
}

export async function updateBookingTrip(
  userId: string,
  input: UpdateBookingTripInput,
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
    updatedAt: new Date().toISOString(),
  });
  await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
  return updated;
}

export async function updateBookingStay(
  userId: string,
  input: UpdateBookingStayInput,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<BookingRecord> {
  const existing = await store.getByUser(userId, input.bookingId);
  if (!existing) {
    throw new Response('Booking not found', { status: 404 });
  }

  const accommodationStatus = resolveAccommodationStatus(input);
  const accommodationBooked = hasBookedAccommodation({
    ...input,
    accommodationStatus,
  });
  const updated = await store.update(userId, input.bookingId, {
    status: existing.status,
    userName: existing.userName,
    arrivalDateTime: normalizeArrivalDateTime(input.arrivalDateTime),
    arrivalTime: undefined,
    accommodationStatus,
    hotelId: accommodationBooked ? sanitizeOptional(input.hotelId) : undefined,
    accommodationName: keepsVisibleAccommodationName(accommodationStatus)
      ? sanitizeOptional(input.accommodationName)
      : undefined,
    updatedAt: new Date().toISOString(),
  });
  await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
  return updated;
}

export async function updateBookingGarage(
  userId: string,
  input: UpdateBookingGarageInput,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
): Promise<BookingRecord> {
  const existing = await store.getByUser(userId, input.bookingId);
  if (!existing) {
    throw new Response('Booking not found', { status: 404 });
  }

  const updated = await store.update(userId, input.bookingId, {
    status: existing.status,
    userName: existing.userName,
    garageBooked: input.garageBooked,
    garageCapacity: input.garageBooked ? input.garageCapacity : undefined,
    garageLabel: input.garageBooked ? sanitizeOptional(input.garageLabel) : undefined,
    garageCostTotalPence:
      input.garageBooked && input.garageCostTotalPence !== undefined
        ? input.garageCostTotalPence
        : undefined,
    garageCostCurrency:
      input.garageBooked && input.garageCostCurrency ? input.garageCostCurrency : undefined,
    updatedAt: new Date().toISOString(),
  });
  await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
  return updated;
}

export async function updateBookingPrivate(
  userId: string,
  input: UpdateBookingPrivateInput,
  store: BookingPersistence = bookingStore,
): Promise<BookingRecord> {
  const existing = await store.getByUser(userId, input.bookingId);
  if (!existing) {
    throw new Response('Booking not found', { status: 404 });
  }

  return store.update(userId, input.bookingId, {
    status: existing.status,
    userName: existing.userName,
    bookingReference: sanitizeOptional(input.bookingReference),
    accommodationReference: sanitizeOptional(input.accommodationReference),
    notes: sanitizeOptional(input.notes),
    updatedAt: new Date().toISOString(),
  });
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
      type: input.type,
      status: existing.status === 'cancelled' ? input.status : existing.status,
      circuit: input.circuit,
      circuitId: input.circuitId,
      circuitName: input.circuitName,
      layout: input.layout,
      circuitKnown: input.circuitKnown,
      provider: input.provider,
      description: input.description,
      userName: user.name,
      userImage: user.picture,
      accommodationStatus: 'booked',
      accommodationName,
      updatedAt: now,
    });
    await syncDayAttendanceSummariesSafely([updated.dayId], store, summaryStore);
    return updated;
  }

  const created = await store.create({
    bookingId: input.dayId,
    userId: user.id,
    userName: user.name,
    userImage: user.picture,
    dayId: input.dayId,
    date: input.date,
    type: input.type,
    status: input.status,
    circuit: input.circuit,
    circuitId: input.circuitId,
    circuitName: input.circuitName,
    layout: input.layout,
    circuitKnown: input.circuitKnown,
    provider: input.provider,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    bookingReference: undefined,
    arrivalDateTime: undefined,
    arrivalTime: undefined,
    hotelId: undefined,
    accommodationStatus: 'booked',
    accommodationName,
    accommodationReference: undefined,
    garageBooked: false,
    garageCapacity: undefined,
    garageLabel: undefined,
    garageCostTotalPence: undefined,
    garageCostCurrency: undefined,
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
  return bookings.toSorted((left, right) =>
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
    userImage: booking.userImage,
    status: booking.status as BookingStatus,
    arrivalDateTime: resolveArrivalDateTime(booking),
    accommodationStatus: resolveAccommodationStatus(booking),
    accommodationName: booking.accommodationName,
    garageBooked: booking.garageBooked,
    garageCapacity: booking.garageCapacity,
    garageLabel: booking.garageLabel,
  };
}

function getGarageCapacity(booking: BookingRecord): number {
  return Math.max(booking.garageCapacity ?? 2, 1);
}

function toSharedGarageRequest(request: GarageShareRequestRecord): SharedGarageRequest {
  return {
    requestId: request.requestId,
    requesterUserId: request.requesterUserId,
    requesterName: request.requesterName,
    status: request.status,
  };
}

function buildGarageShareOptions(
  bookings: BookingRecord[],
  requests: GarageShareRequestRecord[],
  currentUserId?: string,
): GarageShareOption[] {
  const activeBookings = bookings.filter((booking) => booking.status !== 'cancelled');
  const activeUserIds = new Set(activeBookings.map((booking) => booking.userId));
  const activeGarageBookings = activeBookings.filter((booking) => booking.garageBooked);

  return activeGarageBookings
    .map((booking) => {
      const relatedRequests = requests.filter(
        (request) =>
          request.dayId === booking.dayId &&
          request.garageOwnerUserId === booking.userId &&
          request.garageBookingId === booking.bookingId &&
          activeUserIds.has(request.requesterUserId),
      );
      const visibleRequests = relatedRequests.filter(
        (request) => request.status === 'pending' || request.status === 'approved',
      );
      const approvedRequests = visibleRequests.filter((request) => request.status === 'approved');
      const pendingRequests = visibleRequests.filter((request) => request.status === 'pending');
      const myRequest = currentUserId
        ? relatedRequests
            .filter((request) => request.requesterUserId === currentUserId)
            .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .at(0)
        : undefined;
      const garageCapacity = getGarageCapacity(booking);
      const openSpaceCount = Math.max(garageCapacity - 1 - approvedRequests.length, 0);

      return {
        garageBookingId: booking.bookingId,
        ownerUserId: booking.userId,
        ownerName: booking.userName,
        ownerArrivalDateTime: resolveArrivalDateTime(booking),
        garageLabel: booking.garageLabel,
        garageCapacity,
        approvedRequestCount: approvedRequests.length,
        pendingRequestCount: pendingRequests.length,
        openSpaceCount,
        myRequestId: myRequest?.requestId,
        myRequestStatus: myRequest?.status,
        requests: visibleRequests.map(toSharedGarageRequest),
      };
    })
    .toSorted((left, right) => left.ownerName.localeCompare(right.ownerName));
}

export function summarizeDayAttendances(
  bookings: BookingRecord[],
  requests: GarageShareRequestRecord[] = [],
  currentUserId?: string,
): DayAttendanceSummary {
  const attendees = bookings
    .map(toSharedAttendee)
    .toSorted((left, right) => left.userName.localeCompare(right.userName));
  const activeAttendees = attendees.filter((attendee) => attendee.status !== 'cancelled');

  const accommodationNames = [
    ...new Set(
      activeAttendees
        .filter(hasBookedAccommodation)
        .map((attendee) => attendee.accommodationName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].toSorted((left, right) => left.localeCompare(right));
  const garageShareOptions = buildGarageShareOptions(bookings, requests, currentUserId);

  return {
    attendeeCount: activeAttendees.length,
    attendees,
    accommodationNames,
    garageOwnerCount: garageShareOptions.length,
    garageOpenSpaceCount: garageShareOptions.reduce(
      (count, option) => count + option.openSpaceCount,
      0,
    ),
    garageShareOptions,
  };
}

function toDayAttendanceOverview(summary: DayAttendanceSummary): DayAttendanceOverview {
  return {
    attendeeCount: summary.attendeeCount,
    accommodationNames: summary.accommodationNames,
    garageOwnerCount: summary.garageOwnerCount ?? 0,
    garageOpenSpaceCount: summary.garageOpenSpaceCount ?? 0,
  };
}

export async function syncDayAttendanceSummary(
  dayId: string,
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
  requestStore: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<DayAttendanceOverview> {
  const [bookings, requests] = await Promise.all([
    store.listByDay(dayId),
    requestStore.listByDay(dayId),
  ]);
  const summary = summarizeDayAttendances(bookings, requests);
  const overview = toDayAttendanceOverview(summary);

  await summaryStore.put(dayId, overview, new Date().toISOString());

  return overview;
}

export async function listAttendanceByDay(
  dayId: string,
  store: BookingPersistence = bookingStore,
  requestStore: GarageShareRequestPersistence = garageShareRequestStore,
  currentUserId?: string,
): Promise<DayAttendanceSummary> {
  return listAttendanceByDayIds([dayId], store, requestStore, currentUserId);
}

export async function listAttendanceByDayIds(
  dayIds: string[],
  store: BookingPersistence = bookingStore,
  requestStore: GarageShareRequestPersistence = garageShareRequestStore,
  currentUserId?: string,
): Promise<DayAttendanceSummary> {
  const uniqueDayIds = [...new Set(dayIds)];
  const [bookingsByDay, requestsByDay] = await Promise.all([
    Promise.all(uniqueDayIds.map((dayId) => store.listByDay(dayId))),
    Promise.all(uniqueDayIds.map((dayId) => requestStore.listByDay(dayId))),
  ]);
  const bookings = bookingsByDay.flat();
  const requests = requestsByDay.flat();
  return summarizeDayAttendances(bookings, requests, currentUserId);
}

export async function listAttendanceSummariesForDays(
  dayIds: string[],
  store: BookingPersistence = bookingStore,
  requestStore: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<Map<string, DayAttendanceSummary>> {
  const summaries = await Promise.all(
    dayIds.map(
      async (dayId) => [dayId, await listAttendanceByDay(dayId, store, requestStore)] as const,
    ),
  );
  return new Map(summaries);
}

export async function syncDayAttendanceSummaries(
  dayIds: string[],
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
  requestStore: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<void> {
  const uniqueDayIds = [...new Set(dayIds)];
  await Promise.all(
    uniqueDayIds.map((dayId) => syncDayAttendanceSummary(dayId, store, summaryStore, requestStore)),
  );
}
