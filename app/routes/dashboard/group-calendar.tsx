import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { type GroupCalendarData, listGroupCalendarData } from '~/lib/auth/members.server';
import { GroupCalendarPage } from '~/pages/dashboard/group-calendar';
import type { Route } from './+types/group-calendar';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const url = new URL(request.url);
  const data = await listGroupCalendarData({
    month: url.searchParams.get('month') ?? undefined,
  });

  return Response.json(data, { headers });
}

export default function GroupCalendarRoute() {
  const data = useLoaderData<typeof loader>() as GroupCalendarData;
  return <GroupCalendarPage {...data} />;
}
