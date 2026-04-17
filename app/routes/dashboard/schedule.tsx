import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { BookingSchedulePage } from '~/pages/dashboard/schedule';
import type { Route } from './+types/schedule';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const bookings = await listMyBookings(user.id);

  return Response.json({ bookings }, { headers });
}

export default function BookingScheduleRoute() {
  const data = useLoaderData<typeof loader>() as { bookings: BookingRecord[] };
  return <BookingSchedulePage bookings={data.bookings} />;
}
