import { describe, expect, it, vi } from 'vite-plus/test';
import type { User } from '~/lib/auth/schemas';
import type { BookingRecord } from '../entities/booking.server';
import type { GarageShareRequestRecord } from './garage-share-request.server';
import { createGarageShareRequest, updateGarageShareRequestStatus } from './garage-sharing.server';

vi.mock('./booking.server', () => ({
  bookingStore: {},
  syncDayAttendanceSummaries: vi.fn(),
}));

vi.mock('./garage-share-request.server', () => ({
  GARAGE_SHARE_REQUEST_SCOPE: 'garage-share-request',
  garageShareRequestStore: {},
}));

const owner = {
  id: 'owner-1',
  email: 'owner@example.com',
  name: 'Garage Owner',
  role: 'member' as const,
};

const requester: User = {
  id: 'requester-1',
  email: 'requester@example.com',
  name: 'Driver Two',
  picture: '',
  role: 'member',
};

const ownerBooking = {
  bookingId: 'day-1',
  userId: owner.id,
  userName: owner.name,
  dayId: 'day-1',
  date: '2026-05-10',
  type: 'track_day',
  status: 'booked',
  circuit: 'Brands Hatch',
  provider: 'MSV',
  description: 'Open pit lane',
  garageBooked: true,
  garageCapacity: 2,
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
} as BookingRecord;

const requesterBooking = {
  ...ownerBooking,
  userId: requester.id,
  userName: requester.name,
  garageBooked: false,
} as BookingRecord;

function createMemoryDependencies({
  bookings = [ownerBooking, requesterBooking],
  requests = [],
}: {
  bookings?: BookingRecord[];
  requests?: GarageShareRequestRecord[];
} = {}) {
  const requestItems = [...requests];

  return {
    requestItems,
    bookingStore: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listByUser: vi.fn(),
      async findByUserAndDay(userId: string, dayId: string) {
        return (
          bookings.find((booking) => booking.userId === userId && booking.dayId === dayId) ?? null
        );
      },
      async getByUser(userId: string, bookingId: string) {
        return (
          bookings.find(
            (booking) => booking.userId === userId && booking.bookingId === bookingId,
          ) ?? null
        );
      },
      async listByDay(dayId: string) {
        return bookings.filter((booking) => booking.dayId === dayId);
      },
      claimGarageShareSpace: vi.fn(
        async (userId: string, bookingId: string, maxApprovedShareCount: number) => {
          const booking = bookings.find(
            (item) => item.userId === userId && item.bookingId === bookingId,
          );
          const activeUserIds = new Set(
            bookings
              .filter((item) => item.dayId === booking?.dayId)
              .filter((item) => item.status !== 'cancelled')
              .map((item) => item.userId),
          );
          const approvedCount = requestItems.filter(
            (request) =>
              request.garageOwnerUserId === userId &&
              request.garageBookingId === bookingId &&
              request.status === 'approved' &&
              activeUserIds.has(request.requesterUserId),
          ).length;

          if (!booking || approvedCount >= maxApprovedShareCount) {
            return null;
          }

          return {
            ...booking,
            garageApprovedShareCount: approvedCount + 1,
          };
        },
      ),
      releaseGarageShareSpace: vi.fn(async () => ownerBooking),
    },
    requestStore: {
      async create(item: GarageShareRequestRecord) {
        requestItems.push(item);
        return item;
      },
      async update(requestId: string, changes: Partial<GarageShareRequestRecord>) {
        const index = requestItems.findIndex((request) => request.requestId === requestId);
        const next = { ...requestItems[index], ...changes };
        requestItems[index] = next;
        return next;
      },
      async get(requestId: string) {
        return requestItems.find((request) => request.requestId === requestId) ?? null;
      },
      async listByDay(dayId: string) {
        return requestItems.filter((request) => request.dayId === dayId);
      },
      async listByOwner(ownerUserId: string) {
        return requestItems.filter((request) => request.garageOwnerUserId === ownerUserId);
      },
      async listAll() {
        return requestItems;
      },
    },
    syncSummaries: vi.fn(async () => undefined),
  };
}

function createRequest(
  overrides: Partial<GarageShareRequestRecord> = {},
): GarageShareRequestRecord {
  return {
    requestScope: 'garage-share-request',
    requestId: 'request-1',
    dayId: 'day-1',
    date: '2026-05-10',
    circuit: 'Brands Hatch',
    provider: 'MSV',
    description: 'Open pit lane',
    garageBookingId: ownerBooking.bookingId,
    garageOwnerUserId: owner.id,
    garageOwnerName: owner.name,
    requesterUserId: requester.id,
    requesterName: requester.name,
    requesterBookingId: requesterBooking.bookingId,
    status: 'pending',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  } as GarageShareRequestRecord;
}

describe('garage sharing service', () => {
  it('creates a pending request when the requester has an active booking', async () => {
    const memory = createMemoryDependencies();

    const request = await createGarageShareRequest(
      {
        dayId: 'day-1',
        garageOwnerUserId: owner.id,
        garageBookingId: ownerBooking.bookingId,
        message: '',
      },
      requester,
      memory as never,
    );

    expect(request).toMatchObject({
      dayId: 'day-1',
      garageOwnerUserId: owner.id,
      requesterUserId: requester.id,
      status: 'pending',
    });
    expect(memory.requestItems).toHaveLength(1);
    expect(memory.syncSummaries).toHaveBeenCalledWith(['day-1']);
  });

  it('rejects duplicate pending or approved requests', async () => {
    const memory = createMemoryDependencies({
      requests: [createRequest({ status: 'pending' })],
    });

    await expect(
      createGarageShareRequest(
        {
          dayId: 'day-1',
          garageOwnerUserId: owner.id,
          garageBookingId: ownerBooking.bookingId,
          message: '',
        },
        requester,
        memory as never,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('approves a request only while capacity is still available', async () => {
    const pending = createRequest({ requestId: 'pending' });
    const approved = createRequest({
      requestId: 'approved',
      requesterUserId: 'other-user',
      status: 'approved',
    });
    const otherBooking = {
      ...requesterBooking,
      userId: 'other-user',
      userName: 'Driver Three',
    } as BookingRecord;
    const memory = createMemoryDependencies({
      bookings: [ownerBooking, requesterBooking, otherBooking],
      requests: [pending, approved],
    });

    await expect(
      updateGarageShareRequestStatus(
        { requestId: pending.requestId, status: 'approved' },
        owner,
        memory as never,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('does not approve a request when the garage capacity claim fails', async () => {
    const memory = createMemoryDependencies({
      requests: [createRequest()],
    });
    memory.bookingStore.claimGarageShareSpace.mockResolvedValue(null);

    await expect(
      updateGarageShareRequestStatus(
        { requestId: 'request-1', status: 'approved' },
        owner,
        memory as never,
      ),
    ).rejects.toMatchObject({ status: 400 });

    expect(memory.bookingStore.claimGarageShareSpace).toHaveBeenCalledWith(
      owner.id,
      ownerBooking.bookingId,
      1,
      expect.any(String),
    );
    expect(memory.requestItems[0]?.status).toBe('pending');
  });

  it('releases claimed garage capacity when an approved request is cancelled', async () => {
    const memory = createMemoryDependencies({
      requests: [createRequest({ status: 'approved' })],
    });

    await updateGarageShareRequestStatus(
      { requestId: 'request-1', status: 'cancelled' },
      requester,
      memory as never,
    );

    expect(memory.bookingStore.releaseGarageShareSpace).toHaveBeenCalledWith(
      owner.id,
      ownerBooking.bookingId,
      expect.any(String),
    );
  });

  it('lets the owner approve and the requester cancel a request', async () => {
    const memory = createMemoryDependencies({
      requests: [createRequest()],
    });

    const approved = await updateGarageShareRequestStatus(
      { requestId: 'request-1', status: 'approved' },
      owner,
      memory as never,
    );
    expect(approved.status).toBe('approved');

    const cancelled = await updateGarageShareRequestStatus(
      { requestId: 'request-1', status: 'cancelled' },
      requester,
      memory as never,
    );
    expect(cancelled.status).toBe('cancelled');
  });
});
