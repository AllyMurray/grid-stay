import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { listMemberDateLeaderboard } from '~/lib/auth/members.server';
import {
  MemberDateLeaderboardPage,
  type MemberDateLeaderboardPageProps,
} from '~/pages/dashboard/member-date-leaderboard';
import type { Route } from './+types/members.leaderboard';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const leaderboard = await listMemberDateLeaderboard();

  return Response.json({ leaderboard } satisfies MemberDateLeaderboardPageProps, { headers });
}

export default function MemberDateLeaderboardRoute() {
  const data = useLoaderData<typeof loader>() as MemberDateLeaderboardPageProps;
  return <MemberDateLeaderboardPage {...data} />;
}
