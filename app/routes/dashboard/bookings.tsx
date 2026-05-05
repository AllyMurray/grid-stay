import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  submitBookingDelete,
  submitBookingGarageUpdate,
  submitBookingPrivateUpdate,
  submitBookingStayUpdate,
  submitBookingTripUpdate,
  submitBookingUpdate,
  submitHotelReview,
} from '~/lib/bookings/actions.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import {
  listGarageShareRequestsForUser,
  type UserGarageShareRequest,
} from '~/lib/db/services/garage-sharing.server';
import {
  type HotelInsight,
  listHotelInsights,
} from '~/lib/db/services/hotel.server';
import { submitGarageShareDecision } from '~/lib/garage-sharing/actions.server';
import { MyBookingsPage } from '~/pages/dashboard/bookings';
import type { Route } from './+types/bookings';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [bookings, garageShareRequests] = await Promise.all([
    listMyBookings(user.id),
    listGarageShareRequestsForUser(user.id),
  ]);
  const hotelInsights = Object.fromEntries(
    await listHotelInsights(
      bookings
        .map((booking) => booking.hotelId)
        .filter((hotelId): hotelId is string => Boolean(hotelId)),
    ),
  );
  return Response.json(
    { bookings, garageShareRequests, hotelInsights },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const result =
    intent === 'deleteBooking'
      ? await submitBookingDelete(formData, user.id)
      : intent === 'updateBookingTrip'
        ? await submitBookingTripUpdate(formData, user.id)
        : intent === 'updateBookingStay'
          ? await submitBookingStayUpdate(formData, user.id)
          : intent === 'updateBookingGarage'
            ? await submitBookingGarageUpdate(formData, user.id)
            : intent === 'updateBookingPrivate'
              ? await submitBookingPrivateUpdate(formData, user.id)
              : intent === 'updateGarageShareRequest'
                ? await submitGarageShareDecision(formData, user)
                : intent === 'saveHotelReview'
                  ? await submitHotelReview(formData, user)
                  : await submitBookingUpdate(formData, user.id);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action:
        intent === 'deleteBooking'
          ? 'booking.deleted'
          : intent === 'updateBookingTrip'
            ? 'booking.tripUpdated'
            : intent === 'updateBookingStay'
              ? 'booking.stayUpdated'
              : intent === 'updateBookingGarage'
                ? 'booking.garageUpdated'
                : intent === 'updateBookingPrivate'
                  ? 'booking.privateUpdated'
                  : intent === 'updateGarageShareRequest'
                    ? 'garageShare.updated'
                    : intent === 'saveHotelReview'
                      ? 'hotelReview.updated'
                      : 'booking.updated',
      message:
        intent === 'deleteBooking'
          ? 'Booking deleted.'
          : intent === 'updateBookingTrip'
            ? 'Booking trip details updated.'
            : intent === 'updateBookingStay'
              ? 'Booking stay details updated.'
              : intent === 'updateBookingGarage'
                ? 'Booking garage details updated.'
                : intent === 'updateBookingPrivate'
                  ? 'Booking private details updated.'
                  : intent === 'updateGarageShareRequest'
                    ? 'Garage share request updated.'
                    : intent === 'saveHotelReview'
                      ? 'Hotel feedback updated.'
                      : 'Booking updated.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type:
          intent === 'updateGarageShareRequest'
            ? 'garageShare'
            : intent === 'saveHotelReview'
              ? 'hotel'
              : 'booking',
        id:
          intent === 'updateGarageShareRequest'
            ? formData.get('requestId')?.toString()
            : intent === 'saveHotelReview'
              ? formData.get('hotelId')?.toString()
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
    hotelInsights: Record<string, HotelInsight>;
  };
  return (
    <MyBookingsPage
      bookings={data.bookings}
      garageShareRequests={data.garageShareRequests}
      hotelInsights={data.hotelInsights}
    />
  );
}
