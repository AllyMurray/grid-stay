import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { getSiteMemberBookedDays, submitMemberDayBooking } from '~/lib/auth/members.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { MemberDaysPage, type MemberDaysPageProps } from '~/pages/dashboard/member-days';
import type { Route } from './+types/members.$memberId';

function getMemberId(params: Route.LoaderArgs['params']) {
  const memberId = params.memberId?.trim();

  if (!memberId) {
    throw new Response('Member not found', { status: 404 });
  }

  return memberId;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const memberId = getMemberId(params);
  const memberDays = await getSiteMemberBookedDays(memberId);

  if (!memberDays) {
    throw new Response('Member not found', { status: 404, headers });
  }

  const dayIds = new Set(memberDays.days.map((day) => day.dayId));
  const myBookings = (await listMyBookings(user.id)).filter((booking) => dayIds.has(booking.dayId));

  return Response.json(
    {
      ...memberDays,
      myBookingsByDay: Object.fromEntries(
        myBookings.map((booking) => [
          booking.dayId,
          {
            bookingId: booking.bookingId,
            status: booking.status,
          },
        ]),
      ),
    } satisfies MemberDaysPageProps,
    { headers },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const memberId = getMemberId(params);
  const formData = await request.formData();
  const result = await submitMemberDayBooking(formData, user, memberId);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: 'booking.memberDay.added',
      message: 'Booking created from a member day.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'day',
        id: formData.get('dayId')?.toString(),
      },
      metadata: {
        memberId,
        status: formData.get('status')?.toString(),
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function MemberDaysRoute() {
  const data = useLoaderData<typeof loader>() as MemberDaysPageProps;
  return <MemberDaysPage {...data} />;
}
