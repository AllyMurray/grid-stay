import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { submitBookingDelete, submitBookingUpdate } from '~/lib/bookings/actions.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import {
  listGarageShareRequestsForUser,
  type UserGarageShareRequest,
} from '~/lib/db/services/garage-sharing.server';
import { submitGarageShareDecision } from '~/lib/garage-sharing/actions.server';
import { MyBookingsPage } from '~/pages/dashboard/bookings';
import type { Route } from './+types/bookings';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [bookings, garageShareRequests] = await Promise.all([
    listMyBookings(user.id),
    listGarageShareRequestsForUser(user.id),
  ]);
  return Response.json({ bookings, garageShareRequests }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const result =
    intent === 'deleteBooking'
      ? await submitBookingDelete(formData, user.id)
      : intent === 'updateGarageShareRequest'
        ? await submitGarageShareDecision(formData, user)
        : await submitBookingUpdate(formData, user.id);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action:
        intent === 'deleteBooking'
          ? 'booking.deleted'
          : intent === 'updateGarageShareRequest'
            ? 'garageShare.updated'
            : 'booking.updated',
      message:
        intent === 'deleteBooking'
          ? 'Booking deleted.'
          : intent === 'updateGarageShareRequest'
            ? 'Garage share request updated.'
            : 'Booking updated.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: intent === 'updateGarageShareRequest' ? 'garageShare' : 'booking',
        id:
          intent === 'updateGarageShareRequest'
            ? formData.get('requestId')?.toString()
            : formData.get('bookingId')?.toString(),
      },
      metadata: {
        status: formData.get('status')?.toString(),
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function MyBookingsRoute() {
  const data = useLoaderData<typeof loader>() as {
    bookings: BookingRecord[];
    garageShareRequests: UserGarageShareRequest[];
  };
  return <MyBookingsPage bookings={data.bookings} garageShareRequests={data.garageShareRequests} />;
}
