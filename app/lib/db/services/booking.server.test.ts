import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const {
  bookingEntityCreateGo,
  bookingEntityCreate,
  bookingEntityDeleteGo,
  bookingEntityDelete,
  bookingEntityPatchGo,
  bookingEntityPatch,
} = vi.hoisted(() => ({
  bookingEntityCreateGo: vi.fn(async () => ({ data: {} })),
  bookingEntityCreate: vi.fn(() => ({
    go: bookingEntityCreateGo,
  })),
  bookingEntityDeleteGo: vi.fn(async () => ({ data: {} })),
  bookingEntityDelete: vi.fn(() => ({
    go: bookingEntityDeleteGo,
  })),
  bookingEntityPatchGo: vi.fn(async () => ({ data: {} })),
  bookingEntityPatch: vi.fn(() => ({
    set: () => ({ go: bookingEntityPatchGo }),
  })),
}));

vi.mock('~/lib/db/entities/booking.server', () => ({
  BookingEntity: {
    create: bookingEntityCreate,
    delete: bookingEntityDelete,
    patch: bookingEntityPatch,
    query: {
      booking: () => ({ go: async () => ({ data: [] }) }),
      byUserDay: () => ({ go: async () => ({ data: [] }) }),
      byDay: () => ({ go: async () => ({ data: [] }) }),
    },
    get: () => ({ go: async () => ({ data: null }) }),
  },
}));

vi.mock('~/lib/db/services/day-attendance-summary.server', () => ({
  dayAttendanceSummaryStore: {
    put: vi.fn(),
  },
}));

vi.mock('./garage-share-request.server', () => ({
  garageShareRequestStore: {
    listByDay: vi.fn(async () => []),
  },
}));

import {
  applySharedStaySelection,
  bookingStore,
  createBooking,
  deleteBooking,
  ensureBookingsForDays,
  listMyBookings,
  summarizeDayAttendances,
  updateBooking,
  updateBookingPrivate,
  updateBookingStay,
} from './booking.server';

function createMemoryStore() {
  const items: Array<Record<string, unknown>> = [];
  const summaries = new Map<
    string,
    {
      attendeeCount: number;
      accommodationNames: string[];
      updatedAt: string;
    }
  >();

  return {
    items,
    summaries,
    store: {
      async create(item: Record<string, unknown>) {
        items.push(item);
        return item;
      },
      async update(userId: string, bookingId: string, changes: Record<string, unknown>) {
        const index = items.findIndex(
          (item) => item.userId === userId && item.bookingId === bookingId,
        );
        const next = { ...items[index], ...changes };
        items[index] = next;
        return next;
      },
      async delete(userId: string, bookingId: string) {
        const index = items.findIndex(
          (item) => item.userId === userId && item.bookingId === bookingId,
        );
        if (index >= 0) {
          items.splice(index, 1);
        }
      },
      async listByUser(userId: string) {
        return items.filter((item) => item.userId === userId);
      },
      async findByUserAndDay(userId: string, dayId: string) {
        return items.find((item) => item.userId === userId && item.dayId === dayId) ?? null;
      },
      async getByUser(userId: string, bookingId: string) {
        return items.find((item) => item.userId === userId && item.bookingId === bookingId) ?? null;
      },
      async listByDay(dayId: string) {
        return items.filter((item) => item.dayId === dayId);
      },
    },
    summaryStore: {
      async put(
        dayId: string,
        overview: { attendeeCount: number; accommodationNames: string[] },
        updatedAt: string,
      ) {
        summaries.set(dayId, { ...overview, updatedAt });
      },
    },
  };
}

const user = {
  id: 'user-1',
  email: 'ally@example.com',
  name: 'Ally Murray',
  picture: 'https://example.com/avatar.png',
  role: 'member' as const,
};

describe('booking service', () => {
  beforeEach(() => {
    vi.useRealTimers();
    bookingEntityCreate.mockClear();
    bookingEntityCreateGo.mockClear();
    bookingEntityDelete.mockClear();
    bookingEntityDeleteGo.mockClear();
    bookingEntityPatch.mockClear();
    bookingEntityPatchGo.mockClear();
  });

  it('uses a valid put response mode when persisting a new booking', async () => {
    const item = {
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      createdAt: '2026-04-15T07:00:00.000Z',
      updatedAt: '2026-04-15T07:00:00.000Z',
    } as const;

    const created = await bookingStore.create(item as never);

    expect(bookingEntityCreate).toHaveBeenCalledWith(item);
    expect(bookingEntityCreateGo).toHaveBeenCalledWith({ response: 'none' });
    expect(created).toEqual(item);
  });

  it('creates a booking and updates the same day instead of duplicating it', async () => {
    const memory = createMemoryStore();

    const created = await createBooking(
      {
        dayId: 'day-1',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Snetterton',
        circuitId: 'snetterton',
        circuitName: 'Snetterton',
        layout: '300',
        circuitKnown: true,
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        status: 'booked',
      },
      user,
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(created.dayId).toBe('day-1');
    expect(created.bookingId).toBe('day-1');
    expect(created.type).toBe('race_day');
    expect(created).toMatchObject({
      circuit: 'Snetterton',
      circuitId: 'snetterton',
      circuitName: 'Snetterton',
      layout: '300',
      circuitKnown: true,
    });
    expect(memory.items).toHaveLength(1);
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: [],
    });

    const updated = await createBooking(
      {
        dayId: 'day-1',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Snetterton',
        circuitId: 'snetterton',
        circuitName: 'Snetterton',
        layout: '300',
        circuitKnown: true,
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        status: 'maybe',
      },
      user,
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(memory.items).toHaveLength(1);
    expect(updated.status).toBe('maybe');
    expect(updated.type).toBe('race_day');
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: [],
    });
  });

  it('deletes a booking and refreshes the shared day summary', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      accommodationName: 'Trackside Hotel',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    await deleteBooking(
      user.id,
      { bookingId: 'booking-1' },
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(memory.items).toHaveLength(0);
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 0,
      accommodationNames: [],
    });
  });

  it('updates private fields and preserves shared accommodation name only in summaries', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    const updated = await updateBooking(
      user.id,
      {
        bookingId: 'booking-1',
        status: 'booked',
        bookingReference: 'ABC123',
        arrivalDateTime: '2026-05-09 20:00:00',
        accommodationStatus: 'booked',
        accommodationName: 'The Paddock Inn',
        accommodationReference: 'HOTEL-9',
        garageBooked: true,
        garageCapacity: 2,
        garageLabel: 'Garage 4',
        notes: 'Late check-in',
      },
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(updated.bookingReference).toBe('ABC123');
    expect(updated.arrivalDateTime).toBe('2026-05-09 20:00:00');
    expect(updated.accommodationReference).toBe('HOTEL-9');
    expect(updated.garageBooked).toBe(true);
    expect(updated.garageCapacity).toBe(2);
    expect(updated.garageLabel).toBe('Garage 4');
    expect(updated.notes).toBe('Late check-in');

    const shared = summarizeDayAttendances(memory.items as never);
    expect(shared.attendeeCount).toBe(1);
    expect(shared.accommodationNames).toEqual(['The Paddock Inn']);
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: ['The Paddock Inn'],
    });
    expect(shared.attendees[0]).toMatchObject({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      status: 'booked',
      arrivalDateTime: '2026-05-09 20:00:00',
      accommodationName: 'The Paddock Inn',
      accommodationStatus: 'booked',
    });
    expect(shared.attendees[0]).not.toHaveProperty('bookingReference');
    expect(shared.attendees[0]).not.toHaveProperty('accommodationReference');
    expect(shared.attendees[0]).not.toHaveProperty('notes');
  });

  it('updates stay details without requiring private fields', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      bookingReference: 'REF-123',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    const updated = await updateBookingStay(
      user.id,
      {
        bookingId: 'booking-1',
        arrivalDateTime: '2026-05-09 20:00:00',
        hotelId: 'hotel-1',
        accommodationName: 'The Paddock Inn',
      },
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(updated.bookingReference).toBe('REF-123');
    expect(updated.hotelId).toBe('hotel-1');
    expect(updated.accommodationName).toBe('The Paddock Inn');
    expect(updated.arrivalDateTime).toBe('2026-05-09 20:00:00');
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: ['The Paddock Inn'],
    });
  });

  it('updates private details without refreshing shared summaries', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      accommodationName: 'The Paddock Inn',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    const updated = await updateBookingPrivate(
      user.id,
      {
        bookingId: 'booking-1',
        bookingReference: 'REF-123',
        accommodationReference: 'HOTEL-9',
        notes: 'Quiet room',
      },
      memory.store as never,
    );

    expect(updated.accommodationName).toBe('The Paddock Inn');
    expect(updated.bookingReference).toBe('REF-123');
    expect(updated.accommodationReference).toBe('HOTEL-9');
    expect(updated.notes).toBe('Quiet room');
    expect(memory.summaries.size).toBe(0);
  });

  it('falls back to legacy same-day arrival times in shared summaries', () => {
    const shared = summarizeDayAttendances([
      {
        bookingId: 'booking-1',
        userId: 'user-1',
        userName: 'Driver One',
        dayId: 'day-1',
        date: '2026-05-10',
        status: 'booked',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        arrivalTime: '08:00',
        createdAt: '2026-04-01T09:00:00.000Z',
        updatedAt: '2026-04-01T09:00:00.000Z',
      },
    ] as never);

    expect(shared.attendees[0]).toMatchObject({
      arrivalDateTime: '2026-05-10 08:00:00',
    });
  });

  it('stores explicit no-hotel plans without treating stale hotel fields as accommodation', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      accommodationStatus: 'booked',
      accommodationName: 'Old Hotel',
      accommodationReference: 'HOTEL-9',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    const updated = await updateBooking(
      user.id,
      {
        bookingId: 'booking-1',
        status: 'booked',
        bookingReference: '',
        arrivalDateTime: undefined,
        accommodationStatus: 'not_required',
        accommodationName: 'Old Hotel',
        accommodationReference: 'HOTEL-9',
        garageBooked: false,
        garageCapacity: 2,
        garageLabel: '',
        notes: '',
      },
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(updated.accommodationStatus).toBe('not_required');
    expect(updated.accommodationName).toBeUndefined();
    expect(updated.accommodationReference).toBeUndefined();

    const shared = summarizeDayAttendances(memory.items as never);
    expect(shared.accommodationNames).toEqual([]);
    expect(shared.attendees[0]).toMatchObject({
      accommodationStatus: 'not_required',
    });
  });

  it('stores track stays without treating stale hotel fields as booked accommodation', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      accommodationStatus: 'booked',
      accommodationName: 'Old Hotel',
      accommodationReference: 'HOTEL-9',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    const updated = await updateBooking(
      user.id,
      {
        bookingId: 'booking-1',
        status: 'booked',
        bookingReference: '',
        arrivalDateTime: undefined,
        accommodationStatus: 'staying_at_track',
        accommodationName: 'TentBox',
        accommodationReference: 'HOTEL-9',
        garageBooked: false,
        garageCapacity: 2,
        garageLabel: '',
        notes: '',
      },
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(updated.accommodationStatus).toBe('staying_at_track');
    expect(updated.accommodationName).toBe('TentBox');
    expect(updated.accommodationReference).toBeUndefined();

    const shared = summarizeDayAttendances(memory.items as never);
    expect(shared.accommodationNames).toEqual([]);
    expect(shared.attendees[0]).toMatchObject({
      accommodationStatus: 'staying_at_track',
    });
  });

  it('summarizes shared garage spaces without counting pending requests as occupied', () => {
    const shared = summarizeDayAttendances(
      [
        {
          bookingId: 'day-1',
          userId: 'owner-1',
          userName: 'Garage Owner',
          dayId: 'day-1',
          date: '2026-05-10',
          type: 'track_day',
          status: 'booked',
          circuit: 'Brands Hatch',
          provider: 'MSV',
          description: 'Open pit lane',
          garageBooked: true,
          garageCapacity: 3,
          garageLabel: 'Garage 4',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z',
        },
        {
          bookingId: 'day-1',
          userId: 'requester-1',
          userName: 'Driver Two',
          dayId: 'day-1',
          date: '2026-05-10',
          type: 'track_day',
          status: 'booked',
          circuit: 'Brands Hatch',
          provider: 'MSV',
          description: 'Open pit lane',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z',
        },
      ] as never,
      [
        {
          requestId: 'request-1',
          requestScope: 'garage-share-request',
          dayId: 'day-1',
          date: '2026-05-10',
          circuit: 'Brands Hatch',
          provider: 'MSV',
          description: 'Open pit lane',
          garageBookingId: 'day-1',
          garageOwnerUserId: 'owner-1',
          garageOwnerName: 'Garage Owner',
          requesterUserId: 'requester-1',
          requesterName: 'Driver Two',
          requesterBookingId: 'day-1',
          status: 'pending',
          createdAt: '2026-04-01T09:00:00.000Z',
          updatedAt: '2026-04-01T09:00:00.000Z',
        },
      ] as never,
      'requester-1',
    );

    expect(shared.garageOwnerCount).toBe(1);
    expect(shared.garageOpenSpaceCount).toBe(2);
    expect(shared.garageShareOptions?.[0]).toMatchObject({
      ownerName: 'Garage Owner',
      garageCapacity: 3,
      openSpaceCount: 2,
      pendingRequestCount: 1,
      myRequestStatus: 'pending',
    });
  });

  it('includes the existing user name when updating a booking status', async () => {
    const existing = {
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    };
    const store = {
      create: vi.fn(),
      listByUser: vi.fn(),
      findByUserAndDay: vi.fn(),
      getByUser: vi.fn(async () => existing),
      listByDay: vi.fn(async () => [existing]),
      update: vi.fn(async (_userId: string, _bookingId: string, changes) => ({
        ...existing,
        ...changes,
      })),
    };
    const summaryStore = {
      put: vi.fn(async () => undefined),
    };

    await updateBooking(
      user.id,
      {
        bookingId: existing.bookingId,
        status: 'maybe',
        bookingReference: '',
        accommodationStatus: 'unknown',
        accommodationName: '',
        accommodationReference: '',
        garageBooked: false,
        garageCapacity: 2,
        garageLabel: '',
        notes: '',
      },
      store as never,
      summaryStore as never,
    );

    expect(store.update).toHaveBeenCalledWith(
      user.id,
      existing.bookingId,
      expect.objectContaining({
        status: 'maybe',
        userName: user.name,
      }),
    );
  });

  it('creates a booking with the chosen accommodation when none exists yet', async () => {
    const memory = createMemoryStore();

    const created = await applySharedStaySelection(
      {
        dayId: 'day-1',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        status: 'booked',
        accommodationName: 'Trackside Hotel',
      },
      user,
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(created.status).toBe('booked');
    expect(created.accommodationName).toBe('Trackside Hotel');
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: ['Trackside Hotel'],
    });
  });

  it('updates an existing cancelled booking when accommodation is selected', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'cancelled',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
      accommodationName: undefined,
    });

    const updated = await applySharedStaySelection(
      {
        dayId: 'day-1',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        status: 'booked',
        accommodationName: 'Trackside Hotel',
      },
      user,
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(updated.status).toBe('booked');
    expect(updated.accommodationName).toBe('Trackside Hotel');
    expect(memory.items).toHaveLength(1);
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: ['Trackside Hotel'],
    });
  });

  it('adds missing bookings in bulk without changing existing statuses or notes', async () => {
    const memory = createMemoryStore();
    memory.items.push({
      bookingId: 'day-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'maybe',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      bookingReference: 'REF-1',
      notes: 'Keep this',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    });

    const result = await ensureBookingsForDays(
      [
        {
          dayId: 'day-1',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Snetterton',
          circuitId: 'snetterton',
          circuitName: 'Snetterton',
          layout: '300',
          circuitKnown: true,
          provider: 'Caterham Motorsport',
          description: 'Round 1 refreshed',
          status: 'booked',
        },
        {
          dayId: 'day-2',
          date: '2026-05-24',
          type: 'race_day',
          circuit: 'Brands Hatch',
          circuitId: 'brands-hatch',
          circuitName: 'Brands Hatch',
          layout: 'Indy',
          circuitKnown: true,
          provider: 'Caterham Motorsport',
          description: 'Round 2',
          status: 'booked',
        },
      ],
      'booked',
      user,
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(result).toEqual({
      addedCount: 1,
      existingCount: 1,
    });
    expect(memory.items).toHaveLength(2);
    expect(memory.items[0]).toMatchObject({
      dayId: 'day-1',
      type: 'race_day',
      status: 'maybe',
      bookingReference: 'REF-1',
      notes: 'Keep this',
      description: 'Round 1 refreshed',
      circuitId: 'snetterton',
      circuitName: 'Snetterton',
      layout: '300',
      circuitKnown: true,
    });
    expect(memory.items[1]).toMatchObject({
      dayId: 'day-2',
      type: 'race_day',
      status: 'booked',
      circuit: 'Brands Hatch',
      circuitId: 'brands-hatch',
      circuitName: 'Brands Hatch',
      layout: 'Indy',
      circuitKnown: true,
    });
    expect(memory.summaries.get('day-2')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: [],
    });
  });

  it('keeps the current status when refreshing existing bulk bookings', async () => {
    const existing = {
      bookingId: 'day-1',
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: 'day-1',
      date: '2026-05-10',
      type: 'race_day',
      status: 'maybe',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-01T09:00:00.000Z',
    };
    const store = {
      create: vi.fn(),
      delete: vi.fn(),
      listByUser: vi.fn(async () => [existing]),
      findByUserAndDay: vi.fn(),
      getByUser: vi.fn(),
      listByDay: vi.fn(async () => [existing]),
      update: vi.fn(async (_userId: string, _bookingId: string, changes) => {
        if (!('status' in changes)) {
          throw new Error('status is required for booking index refreshes');
        }

        return { ...existing, ...changes };
      }),
    };
    const summaryStore = {
      put: vi.fn(async () => undefined),
    };

    await expect(
      ensureBookingsForDays(
        [
          {
            dayId: 'day-1',
            date: '2026-05-10',
            type: 'race_day',
            circuit: 'Snetterton',
            provider: 'Caterham Motorsport',
            description: 'Round 1 refreshed',
            status: 'booked',
          },
        ],
        'booked',
        user,
        store as never,
        summaryStore as never,
      ),
    ).resolves.toEqual({
      addedCount: 0,
      existingCount: 1,
    });

    expect(store.update).toHaveBeenCalledWith(
      user.id,
      existing.bookingId,
      expect.objectContaining({
        description: 'Round 1 refreshed',
        status: 'maybe',
      }),
    );
  });

  it('handles statuses when sorting personal bookings and communal attendance', async () => {
    const memory = createMemoryStore();
    memory.items.push(
      {
        bookingId: 'b',
        userId: user.id,
        userName: user.name,
        dayId: 'day-2',
        date: '2026-05-12',
        status: 'cancelled',
        circuit: 'Croft',
        provider: 'Track host',
        description: 'Day 2',
        createdAt: '1',
        updatedAt: '1',
      },
      {
        bookingId: 'a',
        userId: user.id,
        userName: user.name,
        dayId: 'day-1',
        date: '2026-05-10',
        status: 'maybe',
        circuit: 'Snetterton',
        provider: 'Track host',
        description: 'Day 1',
        createdAt: '1',
        updatedAt: '1',
      },
    );

    const sorted = await listMyBookings(user.id, memory.store as never);
    expect(sorted.map((booking) => booking.bookingId)).toEqual(['a', 'b']);

    const communal = summarizeDayAttendances(memory.items as never);
    expect(communal.attendeeCount).toBe(1);
    expect(communal.attendees).toHaveLength(2);
    expect(communal.attendees.map((attendee) => attendee.status).toSorted()).toEqual([
      'cancelled',
      'maybe',
    ]);
  });
});
