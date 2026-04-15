import { redirect } from 'react-router';
import { auth } from '~/lib/auth/auth.server';
import type { Route } from './+types/logout';

async function signOutAndRedirect(request: Request) {
  const res = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  const headers = new Headers();
  for (const cookie of res.headers.getSetCookie()) {
    headers.append('set-cookie', cookie);
  }
  throw redirect('/', { headers });
}

export async function loader({ request }: Route.LoaderArgs) {
  return signOutAndRedirect(request);
}

export async function action({ request }: Route.ActionArgs) {
  return signOutAndRedirect(request);
}

export default function Logout() {
  return null;
}
