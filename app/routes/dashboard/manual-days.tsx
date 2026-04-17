import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { submitCreateManualDay } from '~/lib/days/actions.server';
import { listManagedManualDays } from '~/lib/db/services/manual-day.server';
import {
  ManualDaysPage,
  type ManualDaysPageProps,
} from '~/pages/dashboard/manual-days';
import type { Route } from './+types/manual-days';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const manualDays = await listManagedManualDays();

  return Response.json({ manualDays } satisfies ManualDaysPageProps, {
    headers,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const result = await submitCreateManualDay(formData, user);

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function ManualDaysRoute() {
  const data = useLoaderData<typeof loader>() as ManualDaysPageProps;
  return <ManualDaysPage manualDays={data.manualDays} />;
}
