import { auth } from '~/lib/auth/auth.server';
import type { Route } from './+types/api.auth.$';

function isDisabledSetPasswordEndpoint(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');

  return pathname === '/api/auth/set-password';
}

function notFoundResponse() {
  return Response.json({ message: 'Not found' }, { status: 404 });
}

function handleAuthRequest(request: Request) {
  if (isDisabledSetPasswordEndpoint(request)) {
    return notFoundResponse();
  }

  return auth.handler(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return handleAuthRequest(request);
}

export async function action({ request }: Route.ActionArgs) {
  return handleAuthRequest(request);
}
