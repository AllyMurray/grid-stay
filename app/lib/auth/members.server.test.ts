import { describe, expect, it, vi } from 'vite-plus/test';
import type { AvailableDay, DayAttendanceSummary } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import {
  getSiteMemberBookedDays,
  getSiteMemberById,
  listAdminSiteMembers,
  listGroupCalendarData,
  listMemberDateLeaderboard,
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
      arrivalDateTime: '2026-05-02 20:00:00',
      description: 'GT weekend',
      accommodationName: 'Trackside Hotel',
      accommodationStatus: 'booked',
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

const activeDays = [
  {
    dayId: 'day-1',
    date: '2026-05-03',
    type: 'race_day',
    circuit: 'Silverstone',
    circuitId: 'silverstone',
    circuitName: 'Silverstone',
    layout: 'GP',
    provider: 'MSV',
    description: 'GT weekend',
    source: {
      sourceType: 'manual',
      sourceName: 'Manual',
    },
  },
  {
    dayId: 'day-2',
    date: '2026-05-05',
    type: 'track_day',
    circuit: 'Donington Park',
    provider: 'MSV Car Trackdays',
    description: 'Track evening',
    source: {
      sourceType: 'manual',
      sourceName: 'Manual',
    },
  },
  {
    dayId: 'day-3',
    date: '2026-06-01',
    type: 'test_day',
    circuit: 'Snetterton',
    provider: 'MSV',
    description: 'Testing',
    source: {
      sourceType: 'manual',
      sourceName: 'Manual',
    },
  },
] satisfies AvailableDay[];

const attendanceSummaries = new Map<string, DayAttendanceSummary>([
  [
    'day-1',
    {
      attendeeCount: 2,
      attendees: [
        {
          bookingId: 'booking-1',
          userId: 'user-1',
          userName: 'Ally Murray',
          userImage: 'https://example.com/ally.png',
          status: 'booked',
          arrivalDateTime: '2026-05-02 20:00:00',
          accommodationStatus: 'booked',
          accommodationName: 'Trackside Hotel',
        },
        {
          bookingId: 'booking-5',
          userId: 'user-2',
          userName: 'Driver Two',
          status: 'maybe',
          accommodationStatus: 'looking',
        },
      ],
      accommodationNames: ['Trackside Hotel'],
    },
  ],
  [
    'day-2',
    {
      attendeeCount: 1,
      attendees: [
        {
          bookingId: 'booking-2',
          userId: 'user-2',
          userName: 'Driver Two',
          status: 'maybe',
          accommodationStatus: 'not_required',
        },
      ],
      accommodationNames: [],
    },
  ],
]);

function createAttendanceOverviews(dayIds: string[]) {
  return new Map(
    dayIds.map((dayId) => [
      dayId,
      {
        attendeeCount: attendanceSummaries.get(dayId)?.attendeeCount ?? 0,
        accommodationNames: attendanceSummaries.get(dayId)?.accommodationNames ?? [],
      },
    ]),
  );
}

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

  it('can summarize members from day attendance data without per-member booking loaders', async () => {
    const members = await listSiteMembers(
      async () => userRecords,
      undefined,
      '2026-04-16',
      async () => [
        {
          userId: 'user-2',
          displayName: 'Adam Mann',
        },
      ],
      async () => acceptedInvites,
      async () => activeDays,
      async (dayIds) => createAttendanceOverviews(dayIds),
      async (dayIds) =>
        new Map(dayIds.map((dayId) => [dayId, attendanceSummaries.get(dayId)!])),
    );

    expect(members.map((member) => member.name)).toEqual([
      'Adam Mann',
      'Ally Murray',
      'New Member',
    ]);
    expect(members[0]).toMatchObject({
      id: 'user-2',
      activeTripsCount: 2,
      sharedStayCount: 0,
      nextTrip: {
        date: '2026-05-03',
        circuit: 'Silverstone',
        provider: 'MSV',
        accommodationStatus: 'looking',
      },
    });
    expect(members[1]).toMatchObject({
      id: 'user-1',
      activeTripsCount: 1,
      sharedStayCount: 1,
      nextTrip: {
        date: '2026-05-03',
        circuit: 'Silverstone',
        provider: 'MSV',
        accommodationStatus: 'booked',
        accommodationName: 'Trackside Hotel',
      },
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

  it('returns a booked race, test, and track day leaderboard for visible members', async () => {
    const leaderboardBookingsByUser: Record<string, BookingRecord[]> = {
      'user-1': [
        {
          ...bookingsByUser['user-1']![0]!,
          bookingId: 'leaderboard-1',
          dayId: 'leaderboard-1',
          type: 'race_day',
          status: 'booked',
        },
        {
          ...bookingsByUser['user-1']![0]!,
          bookingId: 'leaderboard-2',
          dayId: 'leaderboard-2',
          type: 'test_day',
          status: 'booked',
        },
        {
          ...bookingsByUser['user-1']![0]!,
          bookingId: 'leaderboard-3',
          dayId: 'leaderboard-3',
          type: 'track_day',
          status: 'booked',
        },
        {
          ...bookingsByUser['user-1']![0]!,
          bookingId: 'leaderboard-ignored-maybe',
          dayId: 'leaderboard-ignored-maybe',
          type: 'race_day',
          status: 'maybe',
        },
        {
          ...bookingsByUser['user-1']![0]!,
          bookingId: 'leaderboard-ignored-road',
          dayId: 'leaderboard-ignored-road',
          type: 'road_drive',
          status: 'booked',
        },
      ],
      'user-2': [
        {
          ...bookingsByUser['user-2']![0]!,
          bookingId: 'leaderboard-4',
          dayId: 'leaderboard-4',
          type: 'race_day',
          status: 'booked',
        },
        {
          ...bookingsByUser['user-2']![0]!,
          bookingId: 'leaderboard-5',
          dayId: 'leaderboard-5',
          type: 'race_day',
          status: 'booked',
        },
        {
          ...bookingsByUser['user-2']![0]!,
          bookingId: 'leaderboard-6',
          dayId: 'leaderboard-6',
          type: 'track_day',
          status: 'booked',
        },
        {
          ...bookingsByUser['user-2']![0]!,
          bookingId: 'leaderboard-ignored-cancelled',
          dayId: 'leaderboard-ignored-cancelled',
          type: 'test_day',
          status: 'cancelled',
        },
      ],
      'user-3': [
        {
          ...bookingsByUser['user-1']![0]!,
          bookingId: 'leaderboard-hidden',
          userId: 'user-3',
          dayId: 'leaderboard-hidden',
          type: 'race_day',
          status: 'booked',
        },
      ],
    };

    const leaderboard = await listMemberDateLeaderboard(
      async () => userRecords,
      async (userId) => leaderboardBookingsByUser[userId] ?? [],
      async () => [
        {
          userId: 'user-2',
          displayName: 'Adam Mann',
        },
      ],
      async () => [acceptedInvites[0]!],
    );

    expect(leaderboard).toEqual([
      {
        id: 'user-2',
        name: 'Adam Mann',
        picture: undefined,
        totalCount: 3,
        raceDayCount: 2,
        testDayCount: 0,
        trackDayCount: 1,
      },
      {
        id: 'user-1',
        name: 'Ally Murray',
        picture: 'https://example.com/ally.png',
        totalCount: 3,
        raceDayCount: 1,
        testDayCount: 1,
        trackDayCount: 1,
      },
    ]);
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
        arrivalDateTime: '2026-05-02 20:00:00',
        accommodationStatus: 'booked',
        accommodationName: 'Trackside Hotel',
      },
    ]);
    expect(result?.days[0]).not.toHaveProperty('bookingReference');
    expect(result?.days[0]).not.toHaveProperty('accommodationReference');
    expect(result?.days[0]).not.toHaveProperty('notes');
  });

  it('returns grouped public calendar events for invited members', async () => {
    const calendarBookingsByUser: Record<string, BookingRecord[]> = {
      ...bookingsByUser,
      'user-2': [
        {
          ...bookingsByUser['user-2']![0]!,
          bookingId: 'booking-5',
          dayId: 'day-1',
          date: '2026-05-03',
          status: 'maybe',
          circuit: 'Silverstone',
          circuitId: 'silverstone',
          circuitName: 'Silverstone',
          layout: 'GP',
          provider: 'MSV',
          description: 'GT weekend',
          bookingReference: 'PRIVATE-REF',
          accommodationReference: 'PRIVATE-HOTEL',
          notes: 'Private note',
        },
        ...bookingsByUser['user-2']!,
      ],
    };

    const result = await listGroupCalendarData(
      async () => userRecords,
      async (userId) => calendarBookingsByUser[userId] ?? [],
      '2026-04-16',
      async () => [
        {
          userId: 'user-2',
          displayName: 'Adam Mann',
        },
      ],
      async () => acceptedInvites,
    );

    expect(result.members.map((member) => member.name)).toEqual([
      'Adam Mann',
      'Ally Murray',
      'New Member',
    ]);
    expect(result.events.map((event) => event.dayId)).toEqual(['day-1', 'day-2']);
    expect(result.events[0]).toMatchObject({
      dayId: 'day-1',
      date: '2026-05-03',
      circuit: 'Silverstone',
      provider: 'MSV',
      bookedCount: 1,
      maybeCount: 1,
    });
    expect(result.events[0]?.attendees).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        userName: 'Ally Murray',
        status: 'booked',
        accommodationStatus: 'booked',
        accommodationName: 'Trackside Hotel',
      }),
      expect.objectContaining({
        userId: 'user-2',
        userName: 'Adam Mann',
        status: 'maybe',
      }),
    ]);
    expect(result.events[0]?.attendees[1]).not.toHaveProperty('bookingReference');
    expect(result.events[0]?.attendees[1]).not.toHaveProperty('accommodationReference');
    expect(result.events[0]?.attendees[1]).not.toHaveProperty('notes');
  });

  it('can load only the requested group calendar month from attendance summaries', async () => {
    const result = await listGroupCalendarData({
      month: '2026-05',
      today: '2026-04-16',
      loadUsers: async () => userRecords,
      loadProfiles: async () => [
        {
          userId: 'user-2',
          displayName: 'Adam Mann',
        },
      ],
      loadInvites: async () => acceptedInvites,
      loadDays: async () => activeDays,
      loadOverviews: async (dayIds) => createAttendanceOverviews(dayIds),
      loadSummaries: async (dayIds) =>
        new Map(dayIds.map((dayId) => [dayId, attendanceSummaries.get(dayId)!])),
    });

    expect(result.month).toBe('2026-05');
    expect(result.events.map((event) => event.dayId)).toEqual(['day-1', 'day-2']);
    expect(result.events[0]).toMatchObject({
      dayId: 'day-1',
      date: '2026-05-03',
      circuit: 'Silverstone',
      bookedCount: 1,
      maybeCount: 1,
    });
    expect(result.events[0]?.attendees).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        userName: 'Ally Murray',
        userImage: 'https://example.com/ally.png',
        status: 'booked',
      }),
      expect.objectContaining({
        userId: 'user-2',
        userName: 'Adam Mann',
        status: 'maybe',
      }),
    ]);
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
              accommodationStatus: 'booked',
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
