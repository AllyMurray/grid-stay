import { useLoaderData } from 'react-router';
import {
  loadAdminCircuitsReport,
  submitAdminCircuitAction,
} from '~/lib/admin/circuits.server';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import {
  AdminCircuitsPage,
  type AdminCircuitsPageProps,
} from '~/pages/dashboard/admin-circuits';
import type { Route } from './+types/admin.circuits';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const report = await loadAdminCircuitsReport();

  return Response.json(report satisfies AdminCircuitsPageProps, {
    headers,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString() ?? 'unknown';
  const result = await submitAdminCircuitAction(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: `admin.circuit.${intent}`,
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'circuitAlias',
        id:
          'alias' in result && result.alias
            ? result.alias.aliasKey
            : formData.get('aliasKey')?.toString(),
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminCircuitsRoute() {
  const data = useLoaderData<typeof loader>() as AdminCircuitsPageProps;
  return <AdminCircuitsPage {...data} />;
}
