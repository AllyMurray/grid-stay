import { requireUser } from '~/lib/auth/helpers.server';
import { markWhatsNewViewed } from '~/lib/db/services/whats-new-view.server';
import { whatsNewEntries } from '~/lib/whats-new';
import { WhatsNewPage } from '~/pages/dashboard/whats-new';
import type { Route } from './+types/whats-new';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  await markWhatsNewViewed(user.id);

  return Response.json({ ok: true }, { headers });
}

export default function WhatsNewRoute() {
  return <WhatsNewPage entries={whatsNewEntries} />;
}
