import { describe, expect, it, vi } from 'vite-plus/test';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import {
  getSiteMemberBookedDays,
  getSiteMemberById,
  listAdminSiteMembers,
  listSiteMembers,
  submitMemberDayBooking,
} from './members.server';

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
      type: 'race_day',
      status: 'booked',
      circuit: 'Silverstone',
      circuitId: 'silverstone',
      circuitName: 'Silverstone',
      layout: 'GP',
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
      type: 'track_day',
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
      type: 'race_day',
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
      type: 'test_day',
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

const acceptedInvites = [
  {
    inviteEmail: 'driver@example.com',
    status: 'accepted' as const,
  },
  {
    inviteEmail: 'new@example.com',
    status: 'accepted' as const,
  },
];

describe('listSiteMembers', () => {
  it('returns members sorted by next trip and summarizes active plans', async () => {
    const members = await listSiteMembers(
      async () => userRecords,
      async (userId) => bookingsByUser[userId] ?? [],
      '2026-04-16',
      async () => [],
      async () => acceptedInvites,
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
    expect(members[0]).not.toHaveProperty('email');
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

  it('includes email addresses only in the admin member directory', async () => {
    const members = await listAdminSiteMembers(
      async () => userRecords,
      async (userId) => bookingsByUser[userId] ?? [],
      '2026-04-16',
      async () => [],
      async () => acceptedInvites,
    );

    expect(members[0]).toMatchObject({
      id: 'user-1',
      email: 'ally@example.com',
    });
  });

  it('uses admin display-name overrides without exposing public emails', async () => {
    const members = await listSiteMembers(
      async () => userRecords,
      async (userId) => bookingsByUser[userId] ?? [],
      '2026-04-16',
      async () => [
        {
          userId: 'user-2',
          displayName: 'Adam Mann',
        },
      ],
      async () => acceptedInvites,
    );

    expect(members[1]).toMatchObject({
      id: 'user-2',
      name: 'Adam Mann',
    });
    expect(members[1]).not.toHaveProperty('email');
  });

  it('keeps the auth name when returning a member with an override', async () => {
    const member = await getSiteMemberById(
      'user-2',
      async () => userRecords,
      async () => ({
        userId: 'user-2',
        displayName: 'Adam Mann',
      }),
      async () => acceptedInvites,
    );

    expect(member).toMatchObject({
      id: 'user-2',
      authName: 'Driver Two',
      displayName: 'Adam Mann',
      name: 'Adam Mann',
    });
  });

  it('does not include signed-in users who have not accepted an invite', async () => {
    const members = await listSiteMembers(
      async () => userRecords,
      async (userId) => bookingsByUser[userId] ?? [],
      '2026-04-16',
      async () => [],
      async () => [acceptedInvites[0]!],
    );

    expect(members.map((member) => member.id)).toEqual(['user-1', 'user-2']);
  });

  it('includes Google users whose Gmail address matches an accepted invite alias', async () => {
    const members = await listSiteMembers(
      async () => [
        {
          id: 'user-4',
          email: 'newdriver@gmail.com',
          name: 'New Driver',
          role: 'member' as const,
        },
      ],
      async () => [],
      '2026-04-16',
      async () => [],
      async () => [
        {
          inviteEmail: 'new.driver@googlemail.com',
          status: 'accepted' as const,
        },
      ],
    );

    expect(members.map((member) => member.id)).toEqual(['user-4']);
  });

  it('returns public booked days for a member without private booking fields', async () => {
    const result = await getSiteMemberBookedDays(
      'user-1',
      async () => userRecords,
      async (userId) => bookingsByUser[userId] ?? [],
      '2026-04-16',
      async () => null,
      async () => acceptedInvites,
    );

    expect(result?.member).toMatchObject({
      id: 'user-1',
      name: 'Ally Murray',
    });
    expect(result?.days).toEqual([
      {
        dayId: 'day-1',
        date: '2026-05-03',
        type: 'race_day',
        status: 'booked',
        circuit: 'Silverstone',
        circuitId: 'silverstone',
        circuitName: 'Silverstone',
        layout: 'GP',
        provider: 'MSV',
        description: 'GT weekend',
        accommodationName: 'Trackside Hotel',
      },
    ]);
    expect(result?.days[0]).not.toHaveProperty('bookingReference');
    expect(result?.days[0]).not.toHaveProperty('accommodationReference');
    expect(result?.days[0]).not.toHaveProperty('notes');
  });

  it('creates my booking from another member day without private fields', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('status', 'booked');
    const saveBooking = vi.fn().mockResolvedValue({});

    await expect(
      submitMemberDayBooking(
        formData,
        {
          id: 'current-user',
          email: 'me@example.com',
          name: 'Current User',
          role: 'member',
        },
        'user-1',
        async () => ({
          member: {
            id: 'user-1',
            name: 'Ally Murray',
            image: 'https://example.com/ally.png',
            role: 'member',
          },
          days: [
            {
              dayId: 'day-1',
              date: '2026-05-03',
              type: 'race_day',
              status: 'booked',
              circuit: 'Silverstone',
              circuitId: 'silverstone',
              circuitName: 'Silverstone',
              layout: 'GP',
              provider: 'MSV',
              description: 'GT weekend',
              accommodationName: 'Trackside Hotel',
            },
          ],
        }),
        saveBooking,
      ),
    ).resolves.toEqual({ ok: true });

    expect(saveBooking).toHaveBeenCalledWith(
      {
        dayId: 'day-1',
        date: '2026-05-03',
        type: 'race_day',
        status: 'booked',
        circuit: 'Silverstone',
        circuitId: 'silverstone',
        circuitName: 'Silverstone',
        layout: 'GP',
        provider: 'MSV',
        description: 'GT weekend',
      },
      expect.objectContaining({ id: 'current-user' }),
    );
  });
});
