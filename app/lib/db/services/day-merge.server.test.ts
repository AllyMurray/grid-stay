import { describe, expect, it, vi } from 'vite-plus/test';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '../entities/booking.server';
import type { DayMergeRecord } from '../entities/day-merge.server';
import type { DayPlanRecord } from '../entities/day-plan.server';
import {
  type DayMergePersistence,
  listDayMergeRules,
  migrateMergedDayData,
  upsertDayMerge,
} from './day-merge.server';
import type { GarageShareRequestRecord } from './garage-share-request.server';

vi.mock('../entities/day-merge.server', () => ({
  DayMergeEntity: {},
}));

vi.mock('./booking.server', () => ({
  bookingStore: {},
  syncDayAttendanceSummaries: vi.fn(),
}));

vi.mock('./day-plan.server', () => ({
  dayPlanStore: {},
  SHARED_DAY_PLAN_SCOPE: 'shared',
}));

vi.mock('./garage-share-request.server', () => ({
  garageShareRequestStore: {
    listByDay: vi.fn(async () => []),
    update: vi.fn(),
  },
}));

function createMergeStore(): DayMergePersistence {
  const records = new Map<string, DayMergeRecord>();

  return {
    async put(item) {
      records.set(item.sourceDayId, item);
      return item;
    },
    async delete(sourceDayId) {
      records.delete(sourceDayId);
    },
    async get(sourceDayId) {
      return records.get(sourceDayId) ?? null;
    },
    async listAll() {
      return [...records.values()];
    },
  };
}

const targetDay: AvailableDay = {
  dayId: 'target-day',
  date: '2026-05-10',
  type: 'race_day',
  circuit: 'Snetterton',
  provider: 'Caterham Motorsport',
  description: 'Canonical day',
  source: {
    sourceType: 'caterham',
    sourceName: 'caterham',
  },
};

describe('day merge service', () => {
  it('upserts merge rules and exports feed rules', async () => {
    const store = createMergeStore();

    await upsertDayMerge(
      {
        sourceDayId: 'source-day',
        targetDayId: 'target-day',
        reason: 'Duplicate import',
      },
      { id: 'admin-1' },
      store,
    );

    await expect(listDayMergeRules(store)).resolves.toEqual([
      { sourceDayId: 'source-day', targetDayId: 'target-day' },
    ]);
  });

  it('moves source bookings and shared plans to the target day', async () => {
    const sourceBooking = {
      bookingId: 'source-day',
      userId: 'user-1',
      userName: 'Driver One',
      dayId: 'source-day',
      date: '2026-05-09',
      type: 'race_day',
      status: 'booked',
      circuit: 'Sntterton',
      provider: 'Caterham Motorsport',
      description: 'Duplicate day',
      accommodationName: 'Track Hotel',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as BookingRecord;
    const createdBookings: BookingRecord[] = [];
    const deletedBookings: Array<[string, string]> = [];
    const createdPlans: DayPlanRecord[] = [];
    const deletedPlans: string[] = [];

    const result = await migrateMergedDayData('source-day', targetDay, {
      bookingStore: {
        create: vi.fn(async (item) => {
          createdBookings.push(item);
          return item;
        }),
        update: vi.fn(),
        delete: vi.fn(async (userId, bookingId) => {
          deletedBookings.push([userId, bookingId]);
        }),
        listByUser: vi.fn(),
        findByUserAndDay: vi.fn(async () => null),
        getByUser: vi.fn(),
        listByDay: vi.fn(async (dayId) => (dayId === 'source-day' ? [sourceBooking] : [])),
      },
      planStore: {
        create: vi.fn(async (item) => {
          createdPlans.push(item);
          return item;
        }),
        update: vi.fn(),
        delete: vi.fn(async (dayId) => {
          deletedPlans.push(dayId);
        }),
        get: vi.fn(async (dayId) =>
          dayId === 'source-day'
            ? ({
                dayId,
                planScope: 'shared',
                notes: 'Meet at paddock',
                updatedByUserId: 'user-1',
                updatedByName: 'Driver One',
                createdAt: '2026-04-01T10:00:00.000Z',
                updatedAt: '2026-04-01T10:00:00.000Z',
              } as DayPlanRecord)
            : null,
        ),
        listAll: vi.fn(),
      },
      syncSummaries: vi.fn(),
    });

    expect(result).toMatchObject({
      movedBookingCount: 1,
      mergedBookingCount: 0,
      movedPlan: true,
    });
    expect(createdBookings[0]).toMatchObject({
      bookingId: 'target-day',
      dayId: 'target-day',
      circuit: 'Snetterton',
      accommodationName: 'Track Hotel',
    });
    expect(deletedBookings).toEqual([['user-1', 'source-day']]);
    expect(createdPlans[0]).toMatchObject({
      dayId: 'target-day',
      notes: 'Meet at paddock',
    });
    expect(deletedPlans).toEqual(['source-day']);
  });

  it('moves garage share requests to the target owner and requester bookings', async () => {
    const ownerBooking = {
      bookingId: 'source-day',
      userId: 'owner-1',
      userName: 'Garage Owner',
      dayId: 'source-day',
      date: '2026-05-09',
      type: 'race_day',
      status: 'booked',
      circuit: 'Sntterton',
      provider: 'Caterham Motorsport',
      description: 'Duplicate day',
      garageBooked: true,
      garageCapacity: 3,
      garageLabel: 'Garage 12',
      garageApprovedShareCount: 1,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as BookingRecord;
    const requesterBooking = {
      ...ownerBooking,
      userId: 'requester-1',
      userName: 'Driver Two',
      garageBooked: false,
      garageCapacity: undefined,
      garageLabel: undefined,
      garageApprovedShareCount: undefined,
    } as BookingRecord;
    const garageRequest = {
      requestScope: 'garage-share-request',
      requestId: 'garage-request-1',
      dayId: 'source-day',
      date: '2026-05-09',
      circuit: 'Sntterton',
      provider: 'Caterham Motorsport',
      description: 'Duplicate day',
      garageBookingId: ownerBooking.bookingId,
      garageOwnerUserId: ownerBooking.userId,
      garageOwnerName: ownerBooking.userName,
      requesterUserId: requesterBooking.userId,
      requesterName: requesterBooking.userName,
      requesterBookingId: requesterBooking.bookingId,
      status: 'approved',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as GarageShareRequestRecord;
    const createdBookings: BookingRecord[] = [];
    const updatedGarageRequests: Array<Partial<GarageShareRequestRecord> & { requestId: string }> =
      [];

    await migrateMergedDayData('source-day', targetDay, {
      bookingStore: {
        create: vi.fn(async (item) => {
          createdBookings.push(item);
          return item;
        }),
        update: vi.fn(),
        delete: vi.fn(),
        listByUser: vi.fn(),
        findByUserAndDay: vi.fn(async () => null),
        getByUser: vi.fn(),
        listByDay: vi.fn(async (dayId) =>
          dayId === 'source-day' ? [ownerBooking, requesterBooking] : [],
        ),
      },
      garageShareRequestStore: {
        create: vi.fn(),
        get: vi.fn(),
        listAll: vi.fn(),
        listByOwner: vi.fn(),
        listByDay: vi.fn(async (dayId) => (dayId === 'source-day' ? [garageRequest] : [])),
        update: vi.fn(async (requestId, changes) => {
          updatedGarageRequests.push({ requestId, ...changes });
          return { ...garageRequest, ...changes };
        }),
      },
      planStore: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(async () => null),
        listAll: vi.fn(),
      },
      syncSummaries: vi.fn(),
    });

    expect(createdBookings[0]).toMatchObject({
      bookingId: 'target-day',
      garageBooked: true,
      garageCapacity: 3,
      garageLabel: 'Garage 12',
      garageApprovedShareCount: 1,
    });
    expect(updatedGarageRequests).toContainEqual(
      expect.objectContaining({
        requestId: 'garage-request-1',
        dayId: 'target-day',
        garageBookingId: 'target-day',
        requesterBookingId: 'target-day',
      }),
    );
  });

  it('preserves source garage details when merging into an existing target booking', async () => {
    const sourceBooking = {
      bookingId: 'source-day',
      userId: 'owner-1',
      userName: 'Garage Owner',
      dayId: 'source-day',
      date: '2026-05-09',
      type: 'race_day',
      status: 'booked',
      circuit: 'Sntterton',
      provider: 'Caterham Motorsport',
      description: 'Duplicate day',
      garageBooked: true,
      garageCapacity: 3,
      garageLabel: 'Garage 12',
      garageCostTotalPence: 24000,
      garageCostCurrency: 'GBP',
      garageApprovedShareCount: 1,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as BookingRecord;
    const existingTarget = {
      ...sourceBooking,
      bookingId: 'target-day',
      dayId: 'target-day',
      circuit: 'Snetterton',
      garageBooked: false,
      garageCapacity: undefined,
      garageLabel: undefined,
      garageCostTotalPence: undefined,
      garageCostCurrency: undefined,
      garageApprovedShareCount: undefined,
    } as BookingRecord;
    const updateBooking = vi.fn(async () => existingTarget);

    await migrateMergedDayData('source-day', targetDay, {
      bookingStore: {
        create: vi.fn(),
        update: updateBooking,
        delete: vi.fn(),
        listByUser: vi.fn(),
        findByUserAndDay: vi.fn(async () => existingTarget),
        getByUser: vi.fn(),
        listByDay: vi.fn(async (dayId) => (dayId === 'source-day' ? [sourceBooking] : [])),
      },
      planStore: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(async () => null),
        listAll: vi.fn(),
      },
      syncSummaries: vi.fn(),
    });

    expect(updateBooking).toHaveBeenCalledWith(
      'owner-1',
      'target-day',
      expect.objectContaining({
        garageBooked: true,
        garageCapacity: 3,
        garageLabel: 'Garage 12',
        garageCostTotalPence: 24000,
        garageCostCurrency: 'GBP',
        garageApprovedShareCount: 1,
      }),
    );
  });
});
