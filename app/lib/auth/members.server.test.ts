import { describe, expect, it } from 'vitest';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { listSiteMembers } from './members.server';

const userRecords = [
  {
    id: 'user-1',
    email: 'ally@example.com',
    name: 'Ally Murray',
    image: 'https://example.com/ally.png',
    role: 'owner' as const,
  },
  {
    id: 'user-2',
    email: 'driver@example.com',
    name: 'Driver Two',
    role: 'member' as const,
  },
  {
    id: 'user-3',
    email: 'new@example.com',
    name: 'New Member',
    role: 'member' as const,
  },
];

const bookingsByUser: Record<string, BookingRecord[]> = {
  'user-1': [
    {
      bookingId: 'booking-1',
      userId: 'user-1',
      userName: 'Ally Murray',
      userImage: 'https://example.com/ally.png',
      dayId: 'day-1',
      date: '2026-05-03',
      status: 'booked',
      circuit: 'Silverstone',
      provider: 'MSV',
      bookingReference: 'REF-123',
      description: 'GT weekend',
      accommodationName: 'Trackside Hotel',
      accommodationReference: 'HOTEL-7',
      notes: 'Quiet room',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ],
  'user-2': [
    {
      bookingId: 'booking-2',
      userId: 'user-2',
      userName: 'Driver Two',
      userImage: '',
      dayId: 'day-2',
      date: '2026-05-05',
      status: 'maybe',
      circuit: 'Donington Park',
      provider: 'MSV Car Trackdays',
      description: 'Track evening',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
    {
      bookingId: 'booking-3',
      userId: 'user-2',
      userName: 'Driver Two',
      userImage: '',
      dayId: 'day-3',
      date: '2026-04-01',
      status: 'booked',
      circuit: 'Brands Hatch',
      provider: 'MSV',
      description: 'Past event',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    },
    {
      bookingId: 'booking-4',
      userId: 'user-2',
      userName: 'Driver Two',
      userImage: '',
      dayId: 'day-4',
      date: '2026-06-01',
      status: 'cancelled',
      circuit: 'Snetterton',
      provider: 'MSV',
      description: 'Cancelled event',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ],
  'user-3': [],
};

describe('listSiteMembers', () => {
  it('returns members sorted by next trip and summarizes active plans', async () => {
    const members = await listSiteMembers(
      async () => userRecords,
      async (userId) => bookingsByUser[userId] ?? [],
      '2026-04-16',
    );

    expect(members).toHaveLength(3);
    expect(members[0]).toMatchObject({
      id: 'user-1',
      name: 'Ally Murray',
      role: 'owner',
      activeTripsCount: 1,
      sharedStayCount: 1,
      nextTrip: {
        date: '2026-05-03',
        circuit: 'Silverstone',
      },
    });
    expect(members[1]).toMatchObject({
      id: 'user-2',
      name: 'Driver Two',
      activeTripsCount: 1,
      sharedStayCount: 0,
      nextTrip: {
        date: '2026-05-05',
        circuit: 'Donington Park',
      },
    });
    expect(members[2]).toMatchObject({
      id: 'user-3',
      name: 'New Member',
      activeTripsCount: 0,
      sharedStayCount: 0,
      nextTrip: undefined,
    });
  });
});
