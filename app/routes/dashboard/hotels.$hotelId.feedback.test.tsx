import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listHotelInsights } = vi.hoisted(() => ({
  listHotelInsights: vi.fn(),
}));
const { submitHotelReview } = vi.hoisted(() => ({
  submitHotelReview: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/hotel.server', () => ({
  listHotelInsights,
}));

vi.mock('~/lib/bookings/actions.server', () => ({
  submitHotelReview,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './hotels.$hotelId.feedback';

const insight = {
  hotel: {
    hotelId: 'hotel-1',
    name: 'Trackside Hotel',
  },
  reviewCount: 0,
  summary: 'No reviews yet.',
  summarySource: 'structured',
  reviews: [],
};

describe('hotel feedback route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver One',
        role: 'member',
      },
      headers: new Headers(),
    });
    listHotelInsights.mockReset();
    listHotelInsights.mockResolvedValue(new Map([['hotel-1', insight]]));
    submitHotelReview.mockReset();
    submitHotelReview.mockResolvedValue({ ok: true });
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads hotel insight and preserves the booking return target', async () => {
    const response = (await loader({
      request: new Request(
        'https://gridstay.app/dashboard/hotels/hotel-1/feedback?booking=booking-1',
      ),
      params: { hotelId: 'hotel-1' },
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      insight,
      currentUserId: 'user-1',
      returnTo: '/dashboard/bookings?booking=booking-1',
    });
    expect(listHotelInsights).toHaveBeenCalledWith(['hotel-1']);
  });

  it('records an audit event after saving hotel feedback', async () => {
    const formData = new FormData();
    formData.set('hotelId', 'tampered-hotel');
    formData.set('trailerParking', 'good');
    formData.set('secureParking', 'yes');
    formData.set('lateCheckIn', 'limited');
    const request = new Request(
      'https://gridstay.app/dashboard/hotels/hotel-1/feedback',
      {
        method: 'POST',
        body: formData,
      },
    );

    const response = (await action({
      request,
      params: { hotelId: 'hotel-1' },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(submitHotelReview).toHaveBeenCalledOnce();
    const [submittedFormData, submittedUser] = submitHotelReview.mock.calls[0];
    expect(Object.fromEntries(submittedFormData)).toEqual(
      expect.objectContaining({
        hotelId: 'hotel-1',
        trailerParking: 'good',
      }),
    );
    expect(submittedUser).toEqual(expect.objectContaining({ id: 'user-1' }));
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'hotelReview.updated',
        subject: {
          type: 'hotel',
          id: 'hotel-1',
        },
      }),
    );
  });

  it('returns validation errors without recording an audit event', async () => {
    submitHotelReview.mockResolvedValue({
      ok: false,
      formError: 'Could not save this hotel feedback yet.',
      fieldErrors: {
        hotelId: ['Choose or save a hotel before adding feedback.'],
      },
    });

    const response = (await action({
      request: new Request(
        'https://gridstay.app/dashboard/hotels/hotel-1/feedback',
        {
          method: 'POST',
          body: new FormData(),
        },
      ),
      params: { hotelId: 'hotel-1' },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(400);
    expect(recordAppEventSafely).not.toHaveBeenCalled();
  });
});
