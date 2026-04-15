import { requireAnonymous } from '~/lib/auth/helpers.server';
import { LoginPage } from '~/pages/auth/login';
import type { Route } from './+types/login';

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);

  const url = new URL(request.url);
  const raw = url.searchParams.get('redirectTo') || '/dashboard';
  const redirectTo =
    raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  return { redirectTo };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  return <LoginPage redirectTo={loaderData.redirectTo} />;
}
