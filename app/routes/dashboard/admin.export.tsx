import { useLoaderData } from 'react-router';
import {
  createAdminDataExport,
  createAdminDataExportSummary,
  summarizeAdminDataExport,
} from '~/lib/admin/export.server';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { AdminExportPage, type AdminExportPageProps } from '~/pages/dashboard/admin-export';
import type { Route } from './+types/admin.export';

function createExportFilename(exportedAt: string) {
  return `grid-stay-export-${exportedAt.slice(0, 10)}.json`;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireAdmin(request);
  const url = new URL(request.url);

  if (url.searchParams.get('download') === 'json') {
    const dataExport = await createAdminDataExport();

    await recordAppEventSafely({
      category: 'audit',
      action: 'admin.export.downloaded',
      message: 'Admin data export downloaded.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'adminExport',
        id: dataExport.exportedAt,
      },
      metadata: { ...summarizeAdminDataExport(dataExport) },
    });

    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    responseHeaders.set(
      'Content-Disposition',
      `attachment; filename="${createExportFilename(dataExport.exportedAt)}"`,
    );

    return new Response(JSON.stringify(dataExport, null, 2), {
      headers: responseHeaders,
    });
  }

  return Response.json(
    {
      summary: await createAdminDataExportSummary(),
    } satisfies AdminExportPageProps,
    { headers },
  );
}

export default function AdminExportRoute() {
  const data = useLoaderData<typeof loader>() as AdminExportPageProps;
  return <AdminExportPage {...data} />;
}
