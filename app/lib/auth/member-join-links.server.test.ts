import { describe, expect, it, vi } from 'vitest';
import type { MemberJoinLinkRecord } from '~/lib/db/entities/member-join-link.server';
import type { User } from './schemas';

vi.mock('~/lib/db/entities/member-join-link.server', () => ({
  MemberJoinLinkEntity: {
    create: () => ({ go: async () => undefined }),
    patch: () => ({
      append: () => ({
        add: () => ({
          set: () => ({
            where: () => ({
              go: async () => ({ data: {} }),
            }),
          }),
        }),
      }),
      set: () => ({ go: async () => ({ data: {} }) }),
    }),
    get: () => ({ go: async () => ({ data: null }) }),
    query: {
      allLinks: () => ({ go: async () => ({ data: [] }) }),
    },
  },
}));

import {
  acceptMemberJoinLink,
  buildMemberJoinLinkUrl,
  canUseMemberJoinLinkForAccountCreation,
  createMemberJoinLink,
  createMemberJoinLinkCookieHeader,
  createMemberJoinLinkTokenHint,
  getMemberJoinLinkByToken,
  hashMemberJoinLinkToken,
  listMemberJoinLinks,
  type MemberJoinLinkPersistence,
  readMemberJoinLinkTokenFromRequest,
  revokeMemberJoinLink,
} from './member-join-links.server';

const token = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';
const tokenHash = hashMemberJoinLinkToken(token);
const admin: User = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin One',
  role: 'admin',
};

function createMemoryStore(initial: MemberJoinLinkRecord[] = []): {
  records: MemberJoinLinkRecord[];
  store: MemberJoinLinkPersistence;
} {
  const records = [...initial];

  return {
    records,
    store: {
      async create({ item }) {
        records.push(item);
        return item;
      },
      async update({ tokenHash: nextTokenHash, changes }) {
        const index = records.findIndex(
          (record) => record.tokenHash === nextTokenHash,
        );
        if (index < 0) {
          throw new Error('Join link not found');
        }

        records[index] = {
          ...records[index]!,
          ...changes,
        };
        return records[index]!;
      },
      async getByTokenHash({ tokenHash: nextTokenHash }) {
        return (
          records.find((record) => record.tokenHash === nextTokenHash) ?? null
        );
      },
      async listAll() {
        return [...records];
      },
      async accept({ tokenHash: nextTokenHash, userId, now, maxUses }) {
        const link = records.find(
          (record) => record.tokenHash === nextTokenHash,
        );
        if (
          !link ||
          link.status !== 'active' ||
          link.expiresAt <= now ||
          link.acceptedUserIds.includes(userId) ||
          (maxUses !== undefined && link.acceptedCount >= maxUses)
        ) {
          return null;
        }

        link.acceptedUserIds = [...link.acceptedUserIds, userId];
        link.acceptedCount += 1;
        link.updatedAt = now;
        return link;
      },
    },
  };
}

function activeLink(
  changes: Partial<MemberJoinLinkRecord> = {},
): MemberJoinLinkRecord {
  return {
    tokenHash,
    linkScope: 'memberJoin',
    tokenHint: createMemberJoinLinkTokenHint(token),
    mode: 'usage_limit',
    maxUses: 2,
    acceptedUserIds: [],
    acceptedCount: 0,
    status: 'active',
    createdByUserId: 'admin-1',
    createdByName: 'Admin One',
    expiresAt: '2026-05-05T10:00:00.000Z',
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
    ...changes,
  } as MemberJoinLinkRecord;
}

describe('member join link helpers', () => {
  it('creates hashed 24-hour reusable links', async () => {
    const memory = createMemoryStore();

    const result = await createMemberJoinLink({
      mode: 'reusable',
      createdBy: admin,
      store: memory.store,
      tokenFactory: () => token,
      nowDate: new Date('2026-05-04T10:00:00.000Z'),
    });

    expect(result.token).toBe(token);
    expect(result.link).toMatchObject({
      tokenHash,
      tokenHint: token.slice(-8),
      mode: 'reusable',
      acceptedCount: 0,
      status: 'active',
      expiresAt: '2026-05-05T10:00:00.000Z',
    });
    expect(JSON.stringify(result.link)).not.toContain(token);
  });

  it('validates active links and rejects expired, revoked, and full links', async () => {
    const memory = createMemoryStore([
      activeLink(),
      activeLink({
        tokenHash: 'expired',
        expiresAt: '2026-05-01T10:00:00.000Z',
      }),
      activeLink({
        tokenHash: 'revoked',
        status: 'revoked',
      }),
      activeLink({
        tokenHash: 'full',
        acceptedCount: 2,
        acceptedUserIds: ['user-1', 'user-2'],
      }),
    ]);

    await expect(
      canUseMemberJoinLinkForAccountCreation({
        token,
        store: memory.store,
        now: new Date('2026-05-04T12:00:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      getMemberJoinLinkByToken({
        token: 'bad-token',
        store: memory.store,
        now: new Date('2026-05-04T12:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'not_found' });
    await expect(
      getMemberJoinLinkByToken({
        token: 'abcdefghijklmnopqrstuvwxyzABCDEFzz',
        store: memory.store,
        now: new Date('2026-05-04T12:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'not_found' });

    expect(
      await listMemberJoinLinks({
        store: memory.store,
        now: new Date('2026-05-04T12:00:00.000Z'),
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: 'active' }),
        expect.objectContaining({ state: 'expired' }),
        expect.objectContaining({ state: 'revoked' }),
        expect.objectContaining({ state: 'full' }),
      ]),
    );
  });

  it('accepts users idempotently until the usage limit is reached', async () => {
    const memory = createMemoryStore([activeLink()]);

    await expect(
      acceptMemberJoinLink({
        token,
        user: { id: 'user-1' },
        store: memory.store,
        nowDate: new Date('2026-05-04T12:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      link: { acceptedCount: 1, acceptedUserIds: ['user-1'] },
    });
    await expect(
      acceptMemberJoinLink({
        token,
        user: { id: 'user-1' },
        store: memory.store,
        nowDate: new Date('2026-05-04T12:01:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      link: { acceptedCount: 1, acceptedUserIds: ['user-1'] },
    });
    await expect(
      acceptMemberJoinLink({
        token,
        user: { id: 'user-2' },
        store: memory.store,
        nowDate: new Date('2026-05-04T12:02:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      link: { acceptedCount: 2, acceptedUserIds: ['user-1', 'user-2'] },
    });
    await expect(
      acceptMemberJoinLink({
        token,
        user: { id: 'user-3' },
        store: memory.store,
        nowDate: new Date('2026-05-04T12:03:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'full' });
  });

  it('revokes links by token hash', async () => {
    const memory = createMemoryStore([activeLink()]);

    await expect(
      revokeMemberJoinLink({ tokenHash, store: memory.store }),
    ).resolves.toMatchObject({
      status: 'revoked',
      revokedAt: expect.any(String),
    });
  });

  it('supplies createdAt when revoking links so secondary index keys can be updated', async () => {
    const memory = createMemoryStore([activeLink()]);
    const updateCalls: unknown[] = [];
    const electroDbLikeStore: MemberJoinLinkPersistence = {
      ...memory.store,
      async update(input: Parameters<MemberJoinLinkPersistence['update']>[0]) {
        updateCalls.push(input);
        if (
          input.changes.status &&
          !('composite' in input && input.composite?.createdAt)
        ) {
          throw new Error('missing createdAt composite');
        }

        return memory.store.update(input);
      },
    };

    await expect(
      revokeMemberJoinLink({ tokenHash, store: electroDbLikeStore }),
    ).resolves.toMatchObject({ status: 'revoked' });
    expect(updateCalls[0]).toMatchObject({
      composite: { createdAt: '2026-05-04T10:00:00.000Z' },
    });
  });

  it('builds join URLs and reads join-token cookies', () => {
    const request = new Request('https://gridstay.app/dashboard/admin/members');
    const cookie = createMemberJoinLinkCookieHeader({
      request,
      token,
      expiresAt: '2026-05-05T10:00:00.000Z',
    });

    expect(buildMemberJoinLinkUrl({ request, token })).toBe(
      `https://gridstay.app/join/${token}`,
    );
    expect(
      readMemberJoinLinkTokenFromRequest({
        request: new Request('https://gridstay.app/auth/login', {
          headers: { cookie },
        }),
      }),
    ).toBe(token);
  });

  it('ignores malformed cookie encoding when reading join-token cookies', () => {
    expect(
      readMemberJoinLinkTokenFromRequest({
        request: new Request('https://gridstay.app/auth/login', {
          headers: {
            cookie: `grid_stay_join_token=%; other=${encodeURIComponent(
              'safe value',
            )}`,
          },
        }),
      }),
    ).toBeNull();
  });
});
