import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import type { GarageShareDecisionInput, GarageShareRequestInput } from '~/lib/schemas/garage-share';
import type { BookingRecord } from '../entities/booking.server';
import {
  type BookingPersistence,
  bookingStore,
  syncDayAttendanceSummaries,
} from './booking.server';
import {
  GARAGE_SHARE_REQUEST_SCOPE,
  type GarageShareRequestPersistence,
  type GarageShareRequestRecord,
  garageShareRequestStore,
} from './garage-share-request.server';

export type { GarageShareRequestRecord };

export interface UserGarageShareRequest extends GarageShareRequestRecord {
  isIncoming: boolean;
  isOutgoing: boolean;
}

export interface GarageSharingDependencies {
  bookingStore?: BookingPersistence;
  requestStore?: GarageShareRequestPersistence;
  syncSummaries?: typeof syncDayAttendanceSummaries;
}

function isActiveBooking(booking?: BookingRecord | null) {
  return Boolean(booking && booking.status !== 'cancelled');
}

function isOpenRequest(request: GarageShareRequestRecord) {
  return request.status === 'pending' || request.status === 'approved';
}

function getGarageCapacity(booking: BookingRecord) {
  return Math.max(booking.garageCapacity ?? 2, 1);
}

function getShareableGarageSpaceCount(booking: BookingRecord) {
  return Math.max(getGarageCapacity(booking) - 1, 0);
}

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function loadOwnerGarageBooking(
  input: Pick<GarageShareRequestInput, 'dayId' | 'garageOwnerUserId' | 'garageBookingId'>,
  bookings: BookingPersistence,
): Promise<BookingRecord | null> {
  const ownerBooking = await bookings.getByUser(input.garageOwnerUserId, input.garageBookingId);

  if (
    ownerBooking?.dayId !== input.dayId ||
    !ownerBooking.garageBooked ||
    !isActiveBooking(ownerBooking)
  ) {
    return null;
  }

  return ownerBooking;
}

function countApprovedRequests(
  requests: GarageShareRequestRecord[],
  activeUserIds: Set<string>,
  excludingRequestId?: string,
) {
  return requests.filter(
    (request) =>
      request.requestId !== excludingRequestId &&
      request.status === 'approved' &&
      activeUserIds.has(request.requesterUserId),
  ).length;
}

async function getOpenGarageSpaces(
  ownerBooking: BookingRecord,
  bookings: BookingPersistence,
  requests: GarageShareRequestPersistence,
  excludingRequestId?: string,
) {
  const [dayBookings, dayRequests] = await Promise.all([
    bookings.listByDay(ownerBooking.dayId),
    requests.listByDay(ownerBooking.dayId),
  ]);
  const activeUserIds = new Set(
    dayBookings
      .filter((booking) => booking.status !== 'cancelled')
      .map((booking) => booking.userId),
  );
  const approvedRequestCount = countApprovedRequests(
    dayRequests.filter(
      (request) =>
        request.garageOwnerUserId === ownerBooking.userId &&
        request.garageBookingId === ownerBooking.bookingId,
    ),
    activeUserIds,
    excludingRequestId,
  );

  return Math.max(getGarageCapacity(ownerBooking) - 1 - approvedRequestCount, 0);
}

export async function createGarageShareRequest(
  input: GarageShareRequestInput,
  user: User,
  dependencies: GarageSharingDependencies = {},
): Promise<GarageShareRequestRecord> {
  const bookings = dependencies.bookingStore ?? bookingStore;
  const requests = dependencies.requestStore ?? garageShareRequestStore;
  const ownerBooking = await loadOwnerGarageBooking(input, bookings);

  if (!ownerBooking) {
    throw new Response('Garage is no longer available to share.', {
      status: 400,
    });
  }

  if (ownerBooking.userId === user.id) {
    throw new Response('You cannot request your own garage.', { status: 400 });
  }

  const requesterBooking = await bookings.findByUserAndDay(user.id, input.dayId);
  if (!isActiveBooking(requesterBooking)) {
    throw new Response('Add this day to your bookings before requesting space.', {
      status: 400,
    });
  }

  const existingRequests = await requests.listByDay(input.dayId);
  const duplicate = existingRequests.find(
    (request) =>
      request.garageOwnerUserId === ownerBooking.userId &&
      request.garageBookingId === ownerBooking.bookingId &&
      request.requesterUserId === user.id &&
      isOpenRequest(request),
  );
  if (duplicate) {
    throw new Response('You already have an active request for this garage.', {
      status: 400,
    });
  }

  if ((await getOpenGarageSpaces(ownerBooking, bookings, requests)) <= 0) {
    throw new Response('This garage no longer has a free space.', {
      status: 400,
    });
  }

  const now = new Date().toISOString();
  const request = await requests.create({
    requestScope: GARAGE_SHARE_REQUEST_SCOPE,
    requestId: ulid(),
    dayId: ownerBooking.dayId,
    date: ownerBooking.date,
    circuit: ownerBooking.circuit,
    provider: ownerBooking.provider,
    description: ownerBooking.description,
    garageBookingId: ownerBooking.bookingId,
    garageOwnerUserId: ownerBooking.userId,
    garageOwnerName: ownerBooking.userName,
    requesterUserId: user.id,
    requesterName: user.name,
    requesterBookingId: requesterBooking!.bookingId,
    status: 'pending',
    message: sanitizeOptional(input.message),
    garageCostSharePence: undefined,
    garageCostCurrency: undefined,
    createdAt: now,
    updatedAt: now,
  } as GarageShareRequestRecord);

  await (dependencies.syncSummaries ?? syncDayAttendanceSummaries)([request.dayId]);
  return request;
}

export async function updateGarageShareRequestStatus(
  input: GarageShareDecisionInput,
  user: Pick<User, 'id'>,
  dependencies: GarageSharingDependencies = {},
): Promise<GarageShareRequestRecord> {
  const bookings = dependencies.bookingStore ?? bookingStore;
  const requests = dependencies.requestStore ?? garageShareRequestStore;
  const existing = await requests.get(input.requestId);
  const now = new Date().toISOString();

  if (!existing) {
    throw new Response('Garage share request not found.', { status: 404 });
  }

  const isOwner = existing.garageOwnerUserId === user.id;
  const isRequester = existing.requesterUserId === user.id;
  if (!isOwner && !isRequester) {
    throw new Response('You cannot update this garage share request.', {
      status: 403,
    });
  }

  if ((input.status === 'approved' || input.status === 'declined') && !isOwner) {
    throw new Response('Only the garage owner can approve or decline.', {
      status: 403,
    });
  }

  const isApproval = input.status === 'approved';
  const needsGarageSpaceClaim = isApproval && existing.status !== 'approved';
  const releasesGarageSpace = existing.status === 'approved' && !isApproval;
  let claimedGarageSpace = false;

  if (needsGarageSpaceClaim) {
    if (existing.status !== 'pending') {
      throw new Response('This garage request is no longer pending.', {
        status: 400,
      });
    }

    const [ownerBooking, requesterBooking] = await Promise.all([
      bookings.getByUser(existing.garageOwnerUserId, existing.garageBookingId),
      bookings.getByUser(existing.requesterUserId, existing.requesterBookingId),
    ]);

    if (!isActiveBooking(requesterBooking)) {
      throw new Response('Requester no longer has an active booking.', {
        status: 400,
      });
    }

    if (!ownerBooking?.garageBooked || !isActiveBooking(ownerBooking)) {
      throw new Response('Garage is no longer available to share.', {
        status: 400,
      });
    }

    if (!bookings.claimGarageShareSpace) {
      throw new Error('Booking store does not support garage capacity claims.');
    }

    const claimed = await bookings.claimGarageShareSpace(
      ownerBooking.userId,
      ownerBooking.bookingId,
      getShareableGarageSpaceCount(ownerBooking),
      now,
    );

    if (!claimed) {
      throw new Response('This garage no longer has a free space.', {
        status: 400,
      });
    }

    claimedGarageSpace = true;
  } else if (isApproval) {
    const ownerBooking = await bookings.getByUser(
      existing.garageOwnerUserId,
      existing.garageBookingId,
    );
    if (!ownerBooking?.garageBooked || !isActiveBooking(ownerBooking)) {
      throw new Response('Garage is no longer available to share.', {
        status: 400,
      });
    }

    if ((await getOpenGarageSpaces(ownerBooking, bookings, requests, existing.requestId)) <= 0) {
      throw new Response('This garage no longer has a free space.', {
        status: 400,
      });
    }
  }

  let updated: GarageShareRequestRecord;
  try {
    updated = await requests.update(existing.requestId, {
      status: input.status,
      decidedAt:
        input.status === 'approved' || input.status === 'declined' ? now : existing.decidedAt,
      decidedByUserId:
        input.status === 'approved' || input.status === 'declined'
          ? user.id
          : existing.decidedByUserId,
      updatedAt: now,
    });
  } catch (error) {
    if (claimedGarageSpace && bookings.releaseGarageShareSpace) {
      await bookings.releaseGarageShareSpace(
        existing.garageOwnerUserId,
        existing.garageBookingId,
        now,
      );
    }

    throw error;
  }

  if (releasesGarageSpace && bookings.releaseGarageShareSpace) {
    await bookings.releaseGarageShareSpace(
      existing.garageOwnerUserId,
      existing.garageBookingId,
      now,
    );
  }

  await (dependencies.syncSummaries ?? syncDayAttendanceSummaries)([updated.dayId]);
  return updated;
}

export async function listGarageShareRequestsForUser(
  userId: string,
  store: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<UserGarageShareRequest[]> {
  const records = await store.listAll();
  return records
    .filter((request) => request.garageOwnerUserId === userId || request.requesterUserId === userId)
    .map((request) => ({
      ...request,
      isIncoming: request.garageOwnerUserId === userId,
      isOutgoing: request.requesterUserId === userId,
    }));
}

export async function listPendingIncomingGarageShareRequests(
  userId: string,
  store: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<GarageShareRequestRecord[]> {
  const records = await store.listByOwner(userId);
  return records.filter((request) => request.status === 'pending');
}

export async function countPendingIncomingGarageShareRequests(
  userId: string,
  store: GarageShareRequestPersistence = garageShareRequestStore,
): Promise<number> {
  return (await listPendingIncomingGarageShareRequests(userId, store)).length;
}
