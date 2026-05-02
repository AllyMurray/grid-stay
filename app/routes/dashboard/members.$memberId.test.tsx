import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { getSiteMemberBookedDays, submitMemberDayBooking } = vi.hoisted(() => ({
  getSiteMemberBookedDays: vi.fn(),
  submitMemberDayBooking: vi.fn(),
}));
const { listMyBookings } = vi.hoisted(() => ({
  listMyBookings: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/auth/members.server', () => ({
  getSiteMemberBookedDays,
  submitMemberDayBooking,
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  listMyBookings,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './members.$memberId';

describe('member days route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user: {
        id: 'current-user',
        email: 'me@example.com',
        name: 'Current User',
        role: 'member',
      },
      headers: new Headers(),
    });
    getSiteMemberBookedDays.mockReset();
    getSiteMemberBookedDays.mockResolvedValue({
      member: {
        id: 'user-1',
        name: 'Ally Murray',
        role: 'member',
      },
      days: [
        {
          dayId: 'day-1',
          date: '2026-05-03',
          type: 'race_day',
          status: 'booked',
          circuit: 'Silverstone',
          provider: 'MSV',
          description: 'GT weekend',
        },
      ],
    });
    listMyBookings.mockReset();
    listMyBookings.mockResolvedValue([
      {
        bookingId: 'day-1',
        dayId: 'day-1',
        status: 'maybe',
      },
      {
        bookingId: 'other-day',
        dayId: 'other-day',
        status: 'booked',
      },
    ]);
    submitMemberDayBooking.mockReset();
    submitMemberDayBooking.mockResolvedValue({ ok: true });
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads member days and my matching bookings', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/members/user-1'),
      params: { memberId: 'user-1' },
      context: {},
    } as never)) as Response;

    expect(await response.json()).toMatchObject({
      member: {
        id: 'user-1',
        name: 'Ally Murray',
      },
      days: [
        {
          dayId: 'day-1',
          circuit: 'Silverstone',
        },
      ],
      myBookingsByDay: {
        'day-1': {
          bookingId: 'day-1',
          status: 'maybe',
        },
      },
    });
    expect(getSiteMemberBookedDays).toHaveBeenCalledWith('user-1');
    expect(listMyBookings).toHaveBeenCalledWith('current-user');
  });

  it('returns 404 for an unknown member', async () => {
    getSiteMemberBookedDays.mockResolvedValue(null);

    await expect(
      loader({
        request: new Request('https://gridstay.app/dashboard/members/missing'),
        params: { memberId: 'missing' },
        context: {},
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('creates a booking from a member day', async () => {
    const formData = new FormData();
    formData.set('dayId', 'day-1');
    formData.set('status', 'booked');
    const request = new Request(
      'https://gridstay.app/dashboard/members/user-1',
      {
        method: 'POST',
        body: formData,
      },
    );

    const response = (await action({
      request,
      params: { memberId: 'user-1' },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(submitMemberDayBooking).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'current-user' }),
      'user-1',
    );
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'booking.memberDay.added',
        subject: {
          type: 'day',
          id: 'day-1',
        },
        metadata: {
          memberId: 'user-1',
          status: 'booked',
        },
      }),
    );
  });
});
