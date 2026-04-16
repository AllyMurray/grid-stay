import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  submitBookingDelete,
  submitBookingUpdate,
} from '~/lib/bookings/actions.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { MyBookingsPage } from '~/pages/dashboard/bookings';
import type { Route } from './+types/bookings';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const bookings = await listMyBookings(user.id);
  return Response.json({ bookings }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const result =
    intent === 'deleteBooking'
      ? await submitBookingDelete(formData, user.id)
      : await submitBookingUpdate(formData, user.id);

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function MyBookingsRoute() {
  const data = useLoaderData<typeof loader>() as { bookings: BookingRecord[] };
  return <MyBookingsPage bookings={data.bookings} />;
}
