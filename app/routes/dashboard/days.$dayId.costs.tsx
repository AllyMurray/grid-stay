import { requireUser } from '~/lib/auth/helpers.server';
import { loadEventCostSummary } from '~/lib/db/services/cost-splitting.server';
import type { Route } from './+types/days.$dayId.costs';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const summary = await loadEventCostSummary(params.dayId, user.id);

  return Response.json(summary, { headers });
}

export default function DayCostsRoute() {
  return null;
}
