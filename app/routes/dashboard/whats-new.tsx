import { whatsNewEntries } from '~/lib/whats-new';
import { WhatsNewPage } from '~/pages/dashboard/whats-new';

export default function WhatsNewRoute() {
  return <WhatsNewPage entries={whatsNewEntries} />;
}
