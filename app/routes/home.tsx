import { useLoaderData } from 'react-router';
import { getUser } from '~/lib/auth/helpers.server';
import { HomePage } from '~/pages/home';
import type { Route } from './+types/home';

interface LoaderData {
  hasSession: boolean;
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getUser(request);

  return Response.json(
    { hasSession: Boolean(session) },
    { headers: session?.headers },
  );
}

export default function Home() {
  const loaderData = useLoaderData<typeof loader>() as LoaderData;

  return <HomePage hasSession={loaderData.hasSession} />;
}
