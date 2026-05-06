import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  type HotelInsight,
  listHotelInsights,
} from '~/lib/db/services/hotel.server';
import { HotelDetailPage } from '~/pages/dashboard/hotel-detail';
import type { Route } from './+types/hotels.$hotelId';

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
    },
    { headers },
  );
}

export default function HotelDetailRoute() {
  const data = useLoaderData<typeof loader>() as {
    insight: HotelInsight;
    currentUserId: string;
  };

  return (
    <HotelDetailPage
      insight={data.insight}
      currentUserId={data.currentUserId}
    />
  );
}
