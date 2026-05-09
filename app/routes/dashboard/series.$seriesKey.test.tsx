import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { submitRaceSeriesSubscriptionBooking, submitRemoveRaceSeriesSubscription } = vi.hoisted(
  () => ({
    submitRaceSeriesSubscriptionBooking: vi.fn(),
    submitRemoveRaceSeriesSubscription: vi.fn(),
  }),
);
const { loadRaceSeriesDetail } = vi.hoisted(() => ({
  loadRaceSeriesDetail: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/bookings/actions.server', () => ({
  submitRaceSeriesSubscriptionBooking,
  submitRemoveRaceSeriesSubscription,
}));

vi.mock('~/lib/days/series-detail.server', () => ({
  loadRaceSeriesDetail,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './series.$seriesKey';

const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member' as const,
};

const seriesDetail = {
  seriesKey: 'caterham-academy',
  seriesName: 'Caterham Academy',
  roundCount: 2,
  bookedCount: 1,
  maybeCount: 0,
  missingCount: 1,
  cancelledCount: 0,
  manualRoundCount: 0,
  subscriptionStatus: 'maybe' as const,
  rounds: [
    {
      dayId: 'day-1',
      date: '2026-05-10',
      type: 'race_day' as const,
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      myBookingStatus: 'booked' as const,
      isManual: false,
    },
    {
      dayId: 'day-2',
      date: '2026-06-10',
      type: 'race_day' as const,
      circuit: 'Brands Hatch',
      provider: 'Caterham Motorsport',
      description: 'Round 2',
      isManual: false,
    },
  ],
};

describe('race series detail route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({ user, headers: new Headers() });
    loadRaceSeriesDetail.mockReset();
    loadRaceSeriesDetail.mockResolvedValue(seriesDetail);
    submitRaceSeriesSubscriptionBooking.mockReset();
    submitRaceSeriesSubscriptionBooking.mockResolvedValue({
      ok: true,
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      status: 'booked',
      totalCount: 2,
      addedCount: 1,
      existingCount: 1,
    });
    submitRemoveRaceSeriesSubscription.mockReset();
    submitRemoveRaceSeriesSubscription.mockResolvedValue({
      ok: true,
      seriesKey: 'caterham-academy',
      message: 'Series removed from My Bookings. Existing bookings were not deleted.',
    });
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads race series detail for the current user', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/series/caterham-academy'),
      params: { seriesKey: 'caterham-academy' },
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual(seriesDetail);
    expect(loadRaceSeriesDetail).toHaveBeenCalledWith(user, 'caterham-academy');
  });

  it('throws not found when the race series does not exist', async () => {
    loadRaceSeriesDetail.mockResolvedValueOnce(null);

    await expect(
      loader({
        request: new Request('https://gridstay.app/dashboard/series/unknown'),
        params: { seriesKey: 'unknown' },
        context: {},
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('adds a race series subscription and records an audit event', async () => {
    const formData = new FormData();
    formData.set('intent', 'addRaceSeries');
    formData.set('status', 'booked');
    const request = new Request('https://gridstay.app/dashboard/series/caterham-academy', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: { seriesKey: 'caterham-academy' },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      status: 'booked',
    });
    expect(submitRaceSeriesSubscriptionBooking).toHaveBeenCalledOnce();
    const [submittedFormData, submittedUser] = submitRaceSeriesSubscriptionBooking.mock.calls[0]!;
    expect(submittedUser).toBe(user);
    expect(submittedFormData.get('seriesKey')).toBe('caterham-academy');
    expect(submittedFormData.get('status')).toBe('booked');
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'seriesSubscription.added',
        subject: { type: 'seriesSubscription', id: 'caterham-academy' },
        metadata: expect.objectContaining({
          status: 'booked',
          addedCount: 1,
          existingCount: 1,
        }),
      }),
    );
  });

  it('removes a race series subscription and records an audit event', async () => {
    const formData = new FormData();
    formData.set('intent', 'removeRaceSeries');
    const request = new Request('https://gridstay.app/dashboard/series/caterham-academy', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: { seriesKey: 'caterham-academy' },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      seriesKey: 'caterham-academy',
    });
    expect(submitRemoveRaceSeriesSubscription).toHaveBeenCalledOnce();
    const [submittedFormData, submittedUserId] = submitRemoveRaceSeriesSubscription.mock.calls[0]!;
    expect(submittedUserId).toBe('user-1');
    expect(submittedFormData.get('seriesKey')).toBe('caterham-academy');
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'seriesSubscription.removed',
        subject: { type: 'seriesSubscription', id: 'caterham-academy' },
      }),
    );
  });

  it('returns a bad request for unsupported series actions', async () => {
    const formData = new FormData();
    formData.set('intent', 'unsupported');
    const request = new Request('https://gridstay.app/dashboard/series/caterham-academy', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: { seriesKey: 'caterham-academy' },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      formError: 'This series action is not supported.',
    });
    expect(submitRaceSeriesSubscriptionBooking).not.toHaveBeenCalled();
    expect(submitRemoveRaceSeriesSubscription).not.toHaveBeenCalled();
    expect(recordAppEventSafely).not.toHaveBeenCalled();
  });
});
