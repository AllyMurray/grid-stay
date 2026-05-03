import { requireUser } from '~/lib/auth/helpers.server';
import { listAttendanceByDay } from '~/lib/db/services/booking.server';
import type { Route } from './+types/days.$dayId.attendees';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const attendees = await listAttendanceByDay(
    params.dayId,
    undefined,
    undefined,
    user.id,
  );

  return Response.json(attendees, { headers });
}

export default function DayAttendeesRoute() {
  return null;
}
