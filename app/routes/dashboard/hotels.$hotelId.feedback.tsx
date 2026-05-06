import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { submitHotelReview } from '~/lib/bookings/actions.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { type HotelInsight, listHotelInsights } from '~/lib/db/services/hotel.server';
import { HotelFeedbackPage } from '~/pages/dashboard/hotel-feedback';
import type { Route } from './+types/hotels.$hotelId.feedback';

function createReturnTarget(request: Request, hotelId: string) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get('booking');
  if (bookingId) {
    return {
      returnTo: `/dashboard/bookings?booking=${encodeURIComponent(bookingId)}`,
      returnLabel: 'Back to booking',
    };
  }

  return {
    returnTo: hotelId
      ? `/dashboard/hotels/${encodeURIComponent(hotelId)}`
      : '/dashboard/hotels',
    returnLabel: hotelId ? 'Back to hotel' : 'Back to hotels',
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const hotelId = params.hotelId ?? '';
  const insights = await listHotelInsights([hotelId]);
  const insight = insights.get(hotelId);

  if (!insight) {
    throw new Response('Hotel not found', { status: 404, headers });
  }

  return Response.json(
    {
      insight,
      currentUserId: user.id,
      ...createReturnTarget(request, hotelId),
    },
    { headers },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const hotelId = params.hotelId ?? '';
  const reviewFormData = new FormData();
  formData.forEach((value, key) => {
    reviewFormData.append(key, value);
  });
  reviewFormData.set('hotelId', hotelId);

  const result = await submitHotelReview(reviewFormData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: 'hotelReview.updated',
      message: 'Hotel feedback updated.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'hotel',
        id: hotelId,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function HotelFeedbackRoute() {
  const data = useLoaderData<typeof loader>() as {
    insight: HotelInsight;
    currentUserId: string;
    returnTo: string;
    returnLabel: string;
  };

  return (
    <HotelFeedbackPage
      insight={data.insight}
      currentUserId={data.currentUserId}
      returnTo={data.returnTo}
      returnLabel={data.returnLabel}
    />
  );
}
