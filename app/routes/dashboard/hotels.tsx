import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  type HotelSummaryInsight,
  listHotelSummaryInsights,
  listHotels,
} from '~/lib/db/services/hotel.server';
import { HotelsPage } from '~/pages/dashboard/hotels';
import type { Route } from './+types/hotels';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const hotels = await listHotels();
  const insights = await listHotelSummaryInsights(
    hotels.map((hotel) => hotel.hotelId),
  );
  const sortedInsights = [...insights.values()].toSorted((left, right) =>
    left.hotel.name.localeCompare(right.hotel.name),
  );

  return Response.json(
    {
      hotels: sortedInsights,
    },
    { headers },
  );
}

export default function HotelsRoute() {
  const data = useLoaderData<typeof loader>() as {
    hotels: HotelSummaryInsight[];
  };

  return <HotelsPage hotels={data.hotels} />;
}
