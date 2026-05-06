const BETTER_AUTH_DONT_REMEMBER_COOKIES = [
  {
    name: '__Secure-better-auth.dont_remember',
    secure: true,
  },
  {
    name: 'better-auth.dont_remember',
    secure: false,
  },
];

export function cloneHeadersPreservingSetCookie(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers();

  if (!headers) {
    return nextHeaders;
  }

  if (headers instanceof Headers) {
    for (const cookie of headers.getSetCookie()) {
      nextHeaders.append('set-cookie', cookie);
    }

    headers.forEach((value, key) => {
      if (key !== 'set-cookie') {
        nextHeaders.append(key, value);
      }
    });

    return nextHeaders;
  }

  return new Headers(headers);
}

export function appendClearDontRememberCookieHeaders(headers?: HeadersInit): Headers {
  const nextHeaders = cloneHeadersPreservingSetCookie(headers);

  for (const cookie of BETTER_AUTH_DONT_REMEMBER_COOKIES) {
    nextHeaders.append(
      'set-cookie',
      [
        `${cookie.name}=`,
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'Path=/',
        'HttpOnly',
        ...(cookie.secure ? ['Secure'] : []),
        'SameSite=Lax',
      ].join('; '),
    );
  }

  return nextHeaders;
}
