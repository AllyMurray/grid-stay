import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { listRecentFeedback } from '~/lib/db/services/feedback.server';
import {
  AdminFeedbackPage,
  type AdminFeedbackPageProps,
} from '~/pages/dashboard/admin-feedback';
import type { Route } from './+types/admin.feedback';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const feedback = await listRecentFeedback();

  return Response.json(
    {
      feedback,
    } satisfies AdminFeedbackPageProps,
    { headers },
  );
}

export default function AdminFeedbackRoute() {
  const data = useLoaderData<typeof loader>() as AdminFeedbackPageProps;
  return <AdminFeedbackPage {...data} />;
}
