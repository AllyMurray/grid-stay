import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  MemberJoinLinkEntity,
  type MemberJoinLinkRecord,
} from '~/lib/db/entities/member-join-link.server';
import type { User } from './schemas';

export const MEMBER_JOIN_LINK_COOKIE_NAME = 'grid_stay_join_token';

const MEMBER_JOIN_LINK_SCOPE = 'memberJoin';
const MEMBER_JOIN_LINK_TTL_HOURS = 24;
const MEMBER_JOIN_LINK_DEFAULT_USAGE_LIMIT = 5;
const MEMBER_JOIN_LINK_MIN_USAGE_LIMIT = 2;
const MEMBER_JOIN_LINK_MAX_USAGE_LIMIT = 100;
const tokenPattern = /^[A-Za-z0-9_-]{32,}$/;

export type MemberJoinLinkMode = MemberJoinLinkRecord['mode'];
export type MemberJoinLinkState = 'active' | 'expired' | 'full' | 'revoked';

export interface MemberJoinLinkSummary {
  tokenHash: string;
  tokenHint: string;
  mode: MemberJoinLinkMode;
  maxUses?: number;
  acceptedCount: number;
  state: MemberJoinLinkState;
  createdByName: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
}

export interface CreatedMemberJoinLink {
  link: MemberJoinLinkRecord;
  token: string;
}

export interface MemberJoinLinkPersistence {
  create(input: { item: MemberJoinLinkRecord }): Promise<MemberJoinLinkRecord>;
  update(input: {
    tokenHash: string;
    changes: Partial<MemberJoinLinkRecord>;
    composite?: Partial<MemberJoinLinkRecord>;
  }): Promise<MemberJoinLinkRecord>;
  getByTokenHash(input: {
    tokenHash: string;
  }): Promise<MemberJoinLinkRecord | null>;
  listAll(): Promise<MemberJoinLinkRecord[]>;
  accept(input: {
    tokenHash: string;
    userId: string;
    now: string;
    maxUses?: number;
  }): Promise<MemberJoinLinkRecord | null>;
}

export type MemberJoinLinkActionResult =
  | {
      ok: true;
      intent: 'createJoinLink' | 'revokeJoinLink';
      message: string;
      link: MemberJoinLinkSummary;
      joinUrl?: string;
    }
  | {
      ok: false;
      intent: 'createJoinLink' | 'revokeJoinLink';
      formError: string;
      fieldErrors: Partial<
        Record<'mode' | 'maxUses' | 'tokenHash', string[] | undefined>
      >;
    };

export type MemberJoinLinkLookupResult =
  | {
      ok: true;
      link: MemberJoinLinkRecord;
    }
  | {
      ok: false;
      reason: 'not_found' | 'revoked' | 'expired' | 'full';
    };

const CreateJoinLinkInputSchema = z
  .object({
    mode: z.enum(['reusable', 'single_use', 'usage_limit']),
    maxUses: z.coerce
      .number()
      .int()
      .min(MEMBER_JOIN_LINK_MIN_USAGE_LIMIT)
      .max(MEMBER_JOIN_LINK_MAX_USAGE_LIMIT)
      .optional(),
  })
  .transform((input) => ({
    mode: input.mode,
    maxUses:
      input.mode === 'single_use'
        ? 1
        : input.mode === 'usage_limit'
          ? (input.maxUses ?? MEMBER_JOIN_LINK_DEFAULT_USAGE_LIMIT)
          : undefined,
  }));

const RevokeJoinLinkInputSchema = z.object({
  tokenHash: z.string().min(1),
});

export const memberJoinLinkStore: MemberJoinLinkPersistence = {
  async create({ item }) {
    await MemberJoinLinkEntity.create(item).go({ response: 'none' });
    return item;
  },
  async update({ tokenHash, changes, composite }) {
    const patch = MemberJoinLinkEntity.patch({
      tokenHash,
      linkScope: MEMBER_JOIN_LINK_SCOPE,
    });

    if (composite) {
      const updated = await patch
        .composite(composite)
        .set(changes)
        .go({ response: 'all_new' });
      return updated.data;
    }

    const updated = await patch.set(changes).go({ response: 'all_new' });
    return updated.data;
  },
  async getByTokenHash({ tokenHash }) {
    const response = await MemberJoinLinkEntity.get({
      tokenHash,
      linkScope: MEMBER_JOIN_LINK_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await MemberJoinLinkEntity.query
      .allLinks({ linkScope: MEMBER_JOIN_LINK_SCOPE })
      .go();
    return response.data;
  },
  async accept({ tokenHash, userId, now, maxUses }) {
    try {
      const update = MemberJoinLinkEntity.patch({
        tokenHash,
        linkScope: MEMBER_JOIN_LINK_SCOPE,
      })
        .append({ acceptedUserIds: [userId] })
        .add({ acceptedCount: 1 })
        .set({ updatedAt: now });

      const updated = await update
        .where(
          (
            { acceptedCount, acceptedUserIds, expiresAt, status },
            { eq, gt, lt, notContains },
          ) =>
            [
              eq(status, 'active'),
              gt(expiresAt, now),
              notContains(acceptedUserIds, userId),
              maxUses === undefined ? null : lt(acceptedCount, maxUses),
            ]
              .filter(Boolean)
              .join(' AND '),
        )
        .go({ response: 'all_new' });

      return updated.data;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        return null;
      }

      throw error;
    }
  },
};

function isConditionalCheckFailed(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ConditionalCheckFailedException'
  );
}

function addHours(value: Date, hours: number): string {
  const next = new Date(value);
  next.setUTCHours(next.getUTCHours() + hours);
  return next.toISOString();
}

function sanitizeJoinToken(token: string | null | undefined) {
  const trimmed = token?.trim() ?? '';
  return tokenPattern.test(trimmed) ? trimmed : null;
}

function parseCookieHeader(value: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!value) {
    return cookies;
  }

  for (const part of value.split(';')) {
    const [name, ...rawValue] = part.trim().split('=');
    if (!name) {
      continue;
    }

    const encodedValue = rawValue.join('=');

    try {
      cookies.set(name, decodeURIComponent(encodedValue));
    } catch {
      cookies.set(name, encodedValue);
    }
  }

  return cookies;
}

function createCookieHeader({
  name,
  value,
  maxAge,
  request,
}: {
  name: string;
  value: string;
  maxAge: number;
  request: Request;
}) {
  const secure = new URL(request.url).protocol === 'https:';

  return [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
  ].join('; ');
}

export function hashMemberJoinLinkToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createMemberJoinLinkToken() {
  return randomBytes(32).toString('base64url');
}

export function createMemberJoinLinkTokenHint(token: string) {
  return token.slice(-8);
}

export function getMemberJoinLinkState({
  link,
  now = new Date(),
}: {
  link: Pick<
    MemberJoinLinkRecord,
    'acceptedCount' | 'expiresAt' | 'maxUses' | 'status'
  >;
  now?: Date;
}): MemberJoinLinkState {
  if (link.status === 'revoked') {
    return 'revoked';
  }

  if (link.expiresAt <= now.toISOString()) {
    return 'expired';
  }

  if (link.maxUses !== undefined && link.acceptedCount >= link.maxUses) {
    return 'full';
  }

  return 'active';
}

export function toMemberJoinLinkSummary({
  link,
  now = new Date(),
}: {
  link: MemberJoinLinkRecord;
  now?: Date;
}): MemberJoinLinkSummary {
  return {
    tokenHash: link.tokenHash,
    tokenHint: link.tokenHint,
    mode: link.mode,
    maxUses: link.maxUses,
    acceptedCount: link.acceptedCount,
    state: getMemberJoinLinkState({ link, now }),
    createdByName: link.createdByName,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
    revokedAt: link.revokedAt,
  };
}

export function buildMemberJoinLinkUrl({
  request,
  token,
}: {
  request: Request;
  token: string;
}) {
  const url = new URL(request.url);
  url.pathname = `/join/${token}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function readMemberJoinLinkTokenFromRequest({
  request,
}: {
  request: Pick<Request, 'headers'>;
}) {
  return sanitizeJoinToken(
    parseCookieHeader(request.headers.get('cookie')).get(
      MEMBER_JOIN_LINK_COOKIE_NAME,
    ),
  );
}

export function createMemberJoinLinkCookieHeader({
  request,
  token,
  expiresAt,
}: {
  request: Request;
  token: string;
  expiresAt: string;
}) {
  const secondsUntilExpiry = Math.max(
    0,
    Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000),
  );

  return createCookieHeader({
    name: MEMBER_JOIN_LINK_COOKIE_NAME,
    value: token,
    maxAge: Math.min(secondsUntilExpiry, MEMBER_JOIN_LINK_TTL_HOURS * 60 * 60),
    request,
  });
}

export function createClearMemberJoinLinkCookieHeader({
  request,
}: {
  request: Request;
}) {
  return createCookieHeader({
    name: MEMBER_JOIN_LINK_COOKIE_NAME,
    value: '',
    maxAge: 0,
    request,
  });
}

export async function createMemberJoinLink({
  mode,
  maxUses,
  createdBy,
  store = memberJoinLinkStore,
  tokenFactory = createMemberJoinLinkToken,
  nowDate = new Date(),
}: {
  mode: MemberJoinLinkMode;
  maxUses?: number;
  createdBy: Pick<User, 'id' | 'name'>;
  store?: MemberJoinLinkPersistence;
  tokenFactory?: () => string;
  nowDate?: Date;
}): Promise<CreatedMemberJoinLink> {
  const token = tokenFactory();
  const now = nowDate.toISOString();
  const link: MemberJoinLinkRecord = {
    tokenHash: hashMemberJoinLinkToken(token),
    linkScope: MEMBER_JOIN_LINK_SCOPE,
    tokenHint: createMemberJoinLinkTokenHint(token),
    mode,
    maxUses,
    acceptedUserIds: [],
    acceptedCount: 0,
    status: 'active',
    createdByUserId: createdBy.id,
    createdByName: createdBy.name,
    expiresAt: addHours(nowDate, MEMBER_JOIN_LINK_TTL_HOURS),
    createdAt: now,
    updatedAt: now,
  } as MemberJoinLinkRecord;

  return {
    link: await store.create({ item: link }),
    token,
  };
}

export async function listMemberJoinLinks({
  store = memberJoinLinkStore,
  now = new Date(),
}: {
  store?: MemberJoinLinkPersistence;
  now?: Date;
} = {}): Promise<MemberJoinLinkSummary[]> {
  const links = await store.listAll();

  return links
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((link) => toMemberJoinLinkSummary({ link, now }));
}

export async function getMemberJoinLinkByToken({
  token,
  store = memberJoinLinkStore,
  now = new Date(),
}: {
  token: string | null | undefined;
  store?: MemberJoinLinkPersistence;
  now?: Date;
}): Promise<MemberJoinLinkLookupResult> {
  const sanitizedToken = sanitizeJoinToken(token);
  if (!sanitizedToken) {
    return { ok: false, reason: 'not_found' };
  }

  const link = await store.getByTokenHash({
    tokenHash: hashMemberJoinLinkToken(sanitizedToken),
  });
  if (!link) {
    return { ok: false, reason: 'not_found' };
  }

  const state = getMemberJoinLinkState({ link, now });
  if (state !== 'active') {
    return { ok: false, reason: state };
  }

  return { ok: true, link };
}

export async function canUseMemberJoinLinkForAccountCreation({
  token,
  store = memberJoinLinkStore,
  now = new Date(),
}: {
  token: string | null | undefined;
  store?: MemberJoinLinkPersistence;
  now?: Date;
}) {
  return (await getMemberJoinLinkByToken({ token, store, now })).ok;
}

export async function acceptMemberJoinLink({
  token,
  user,
  store = memberJoinLinkStore,
  nowDate = new Date(),
}: {
  token: string;
  user: Pick<User, 'id'>;
  store?: MemberJoinLinkPersistence;
  nowDate?: Date;
}): Promise<MemberJoinLinkLookupResult> {
  const lookup = await getMemberJoinLinkByToken({
    token,
    store,
    now: nowDate,
  });
  if (!lookup.ok) {
    return lookup;
  }

  if (lookup.link.acceptedUserIds.includes(user.id)) {
    return { ok: true, link: lookup.link };
  }

  const updated = await store.accept({
    tokenHash: lookup.link.tokenHash,
    userId: user.id,
    now: nowDate.toISOString(),
    maxUses: lookup.link.maxUses,
  });
  if (updated) {
    return { ok: true, link: updated };
  }

  const refreshed = await store.getByTokenHash({
    tokenHash: lookup.link.tokenHash,
  });
  if (refreshed?.acceptedUserIds.includes(user.id)) {
    return { ok: true, link: refreshed };
  }

  if (!refreshed) {
    return { ok: false, reason: 'not_found' };
  }

  const state = getMemberJoinLinkState({ link: refreshed, now: nowDate });
  return { ok: false, reason: state === 'active' ? 'full' : state };
}

export async function revokeMemberJoinLink({
  tokenHash,
  store = memberJoinLinkStore,
}: {
  tokenHash: string;
  store?: MemberJoinLinkPersistence;
}): Promise<MemberJoinLinkRecord | null> {
  const existing = await store.getByTokenHash({ tokenHash });
  if (!existing) {
    return null;
  }

  if (existing.status === 'revoked') {
    return existing;
  }

  const now = new Date().toISOString();
  return store.update({
    tokenHash,
    composite: {
      createdAt: existing.createdAt,
    },
    changes: {
      status: 'revoked',
      revokedAt: now,
      updatedAt: now,
    },
  });
}

export async function submitCreateMemberJoinLink({
  formData,
  user,
  request,
  store = memberJoinLinkStore,
}: {
  formData: FormData;
  user: User;
  request: Request;
  store?: MemberJoinLinkPersistence;
}): Promise<MemberJoinLinkActionResult> {
  const parsed = CreateJoinLinkInputSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      intent: 'createJoinLink',
      formError: 'Could not create this join link.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const created = await createMemberJoinLink({
    ...parsed.data,
    createdBy: user,
    store,
  });

  return {
    ok: true,
    intent: 'createJoinLink',
    message: 'Join link created.',
    link: toMemberJoinLinkSummary({ link: created.link }),
    joinUrl: buildMemberJoinLinkUrl({ request, token: created.token }),
  };
}

export async function submitRevokeMemberJoinLink({
  formData,
  store = memberJoinLinkStore,
}: {
  formData: FormData;
  store?: MemberJoinLinkPersistence;
}): Promise<MemberJoinLinkActionResult> {
  const parsed = RevokeJoinLinkInputSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      intent: 'revokeJoinLink',
      formError: 'Could not revoke this join link.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const link = await revokeMemberJoinLink({
    tokenHash: parsed.data.tokenHash,
    store,
  });
  if (!link) {
    return {
      ok: false,
      intent: 'revokeJoinLink',
      formError: 'This join link could not be found.',
      fieldErrors: {},
    };
  }

  return {
    ok: true,
    intent: 'revokeJoinLink',
    message: 'Join link revoked.',
    link: toMemberJoinLinkSummary({ link }),
  };
}

export async function submitMemberJoinLinkAction({
  formData,
  user,
  request,
  store = memberJoinLinkStore,
}: {
  formData: FormData;
  user: User;
  request: Request;
  store?: MemberJoinLinkPersistence;
}): Promise<MemberJoinLinkActionResult> {
  const intent = formData.get('intent')?.toString() ?? 'createJoinLink';

  if (intent === 'revokeJoinLink') {
    return submitRevokeMemberJoinLink({ formData, store });
  }

  return submitCreateMemberJoinLink({ formData, user, request, store });
}
