import { getUser } from '~/lib/auth/helpers.server';
import { HomePage } from '~/pages/home';
import type { Route } from './+types/home';

export async function loader({ request }: Route.LoaderArgs) {
  return { session: await getUser(request) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage hasSession={Boolean(loaderData.session)} />;
}
