import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bookingEntityCreateGo,
  bookingEntityCreate,
  bookingEntityPatchGo,
  bookingEntityPatch,
} = vi.hoisted(() => ({
  bookingEntityCreateGo: vi.fn(async () => ({ data: {} })),
  bookingEntityCreate: vi.fn(() => ({
    go: bookingEntityCreateGo,
  })),
  bookingEntityPatchGo: vi.fn(async () => ({ data: {} })),
  bookingEntityPatch: vi.fn(() => ({
    set: () => ({ go: bookingEntityPatchGo }),
  })),
}));

vi.mock('~/lib/db/entities/booking.server', () => ({
  BookingEntity: {
    create: bookingEntityCreate,
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

import {
  bookingStore,
  createBooking,
  listMyBookings,
  summarizeDayAttendances,
  updateBooking,
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
      async update(
        userId: string,
        bookingId: string,
        changes: Record<string, unknown>,
      ) {
        const index = items.findIndex(
          (item) => item.userId === userId && item.bookingId === bookingId,
        );
        const next = { ...items[index], ...changes };
        items[index] = next;
        return next;
      },
      async listByUser(userId: string) {
        return items.filter((item) => item.userId === userId);
      },
      async findByUserAndDay(userId: string, dayId: string) {
        return (
          items.find(
            (item) => item.userId === userId && item.dayId === dayId,
          ) ?? null
        );
      },
      async getByUser(userId: string, bookingId: string) {
        return (
          items.find(
            (item) => item.userId === userId && item.bookingId === bookingId,
          ) ?? null
        );
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
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        status: 'booked',
      },
      user,
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(created.dayId).toBe('day-1');
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
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
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
        accommodationName: 'The Paddock Inn',
        accommodationReference: 'HOTEL-9',
        notes: 'Late check-in',
      },
      memory.store as never,
      memory.summaryStore as never,
    );

    expect(updated.bookingReference).toBe('ABC123');
    expect(updated.accommodationReference).toBe('HOTEL-9');
    expect(updated.notes).toBe('Late check-in');

    const shared = summarizeDayAttendances(memory.items as never);
    expect(shared.attendeeCount).toBe(1);
    expect(shared.accommodationNames).toEqual(['The Paddock Inn']);
    expect(memory.summaries.get('day-1')).toMatchObject({
      attendeeCount: 1,
      accommodationNames: ['The Paddock Inn'],
    });
    expect(shared.attendees[0]).toEqual({
      bookingId: 'booking-1',
      userId: user.id,
      userName: user.name,
      status: 'booked',
      accommodationName: 'The Paddock Inn',
    });
    expect(shared.attendees[0]).not.toHaveProperty('bookingReference');
    expect(shared.attendees[0]).not.toHaveProperty('accommodationReference');
    expect(shared.attendees[0]).not.toHaveProperty('notes');
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
        accommodationName: '',
        accommodationReference: '',
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
    expect(communal.attendees[0].status).toBe('maybe');
  });
});
