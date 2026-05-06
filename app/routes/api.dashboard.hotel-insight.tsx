import { requireUser } from '~/lib/auth/helpers.server';
import { type HotelInsight, listHotelInsights } from '~/lib/db/services/hotel.server';
import type { Route } from './+types/api.dashboard.hotel-insight';

export interface DashboardHotelInsightData {
  hotelInsight: HotelInsight | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const url = new URL(request.url);
  const hotelId = url.searchParams.get('hotelId')?.trim() ?? '';

  if (!hotelId) {
    return Response.json({ hotelInsight: null } satisfies DashboardHotelInsightData, { headers });
  }

  const insights = await listHotelInsights([hotelId]);

  return Response.json(
    {
      hotelInsight: insights.get(hotelId) ?? null,
    } satisfies DashboardHotelInsightData,
    { headers },
  );
}

export default function DashboardHotelInsightRoute() {
  return null;
}
