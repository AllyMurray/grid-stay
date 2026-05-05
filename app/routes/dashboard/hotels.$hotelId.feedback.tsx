import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { submitHotelReview } from '~/lib/bookings/actions.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import {
  type HotelInsight,
  listHotelInsights,
} from '~/lib/db/services/hotel.server';
import { HotelFeedbackPage } from '~/pages/dashboard/hotel-feedback';
import type { Route } from './+types/hotels.$hotelId.feedback';

function createReturnTo(request: Request) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get('booking');
  if (bookingId) {
    return `/dashboard/bookings?booking=${encodeURIComponent(bookingId)}`;
  }

  return '/dashboard/bookings';
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
      returnTo: createReturnTo(request),
    },
    { headers },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const result = await submitHotelReview(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: 'hotelReview.updated',
      message: 'Hotel feedback updated.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'hotel',
        id: formData.get('hotelId')?.toString() ?? params.hotelId,
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
  };

  return (
    <HotelFeedbackPage
      insight={data.insight}
      currentUserId={data.currentUserId}
      returnTo={data.returnTo}
    />
  );
}
