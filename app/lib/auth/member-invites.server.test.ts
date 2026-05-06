import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { MemberInviteRecord } from '~/lib/db/entities/member-invite.server';
import type { User } from './schemas';

const { acceptMemberJoinLink, canUseMemberJoinLinkForAccountCreation } = vi.hoisted(() => ({
  acceptMemberJoinLink: vi.fn(),
  canUseMemberJoinLinkForAccountCreation: vi.fn(),
}));

vi.mock('~/lib/db/entities/member-invite.server', () => ({
  MemberInviteEntity: {
    create: () => ({ go: async () => undefined }),
    patch: () => ({
      set: () => ({ go: async () => ({ data: {} }) }),
    }),
    get: () => ({ go: async () => ({ data: null }) }),
    query: {
      allInvites: () => ({ go: async () => ({ data: [] }) }),
    },
  },
}));

vi.mock('./member-join-links.server', () => ({
  acceptMemberJoinLink,
  canUseMemberJoinLinkForAccountCreation,
}));

import {
  canCreateMemberAccountForEmail,
  createAcceptedMemberInviteForUser,
  createMemberInvite,
  ensureUserMemberAccess,
  grantMemberAccessFromJoinLink,
  type MemberInvitePersistence,
  revokeMemberInvite,
  submitMemberInvite,
  submitMemberInviteAction,
} from './member-invites.server';

const inviter: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

function createMemoryStore(initial: MemberInviteRecord[] = []): {
  records: MemberInviteRecord[];
  store: MemberInvitePersistence;
} {
  const records = [...initial];

  return {
    records,
    store: {
      async create(item) {
        records.push(item);
        return item;
      },
      async update(inviteEmail, changes) {
        const index = records.findIndex((record) => record.inviteEmail === inviteEmail);
        if (index < 0) {
          throw new Error('Invite not found');
        }

        records[index] = {
          ...records[index]!,
          ...changes,
        };
        return records[index]!;
      },
      async getByEmail(inviteEmail) {
        return records.find((record) => record.inviteEmail === inviteEmail) ?? null;
      },
      async listAll() {
        return [...records];
      },
    },
  };
}

describe('member invite helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    acceptMemberJoinLink.mockReset();
    acceptMemberJoinLink.mockResolvedValue({ ok: false, reason: 'not_found' });
    canUseMemberJoinLinkForAccountCreation.mockReset();
    canUseMemberJoinLinkForAccountCreation.mockResolvedValue(false);
  });

  beforeEach(() => {
    acceptMemberJoinLink.mockResolvedValue({ ok: false, reason: 'not_found' });
    canUseMemberJoinLinkForAccountCreation.mockResolvedValue(false);
  });

  it('creates normalized pending invites', async () => {
    const memory = createMemoryStore();

    const result = await createMemberInvite(' New.Driver@Example.com ', inviter, memory.store);

    expect(result.created).toBe(true);
    expect(result.invite).toMatchObject({
      inviteEmail: 'new.driver@example.com',
      invitedByUserId: 'user-1',
      invitedByName: 'Driver One',
      status: 'pending',
      expiresAt: expect.any(String),
    });
  });

  it('accepts generic email addresses in invite actions', async () => {
    const formData = new FormData();
    formData.set('email', ' Driver@Team.co.uk ');

    const result = await submitMemberInvite(formData, inviter, createMemoryStore().store);

    expect(result).toMatchObject({
      ok: true,
      message: 'driver@team.co.uk can now sign in.',
      invite: {
        inviteEmail: 'driver@team.co.uk',
        status: 'pending',
      },
    });
  });

  it('accepts a pending invite when that user signs in', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    const allowed = await ensureUserMemberAccess(
      {
        id: 'user-2',
        email: 'new.driver@example.com',
        name: 'New Driver',
        role: 'member',
      },
      memory.store,
    );

    expect(allowed).toBe(true);
    expect(memory.records[0]).toMatchObject({
      status: 'accepted',
      acceptedByUserId: 'user-2',
    });
  });

  it('creates accepted invites for users who join from a link', async () => {
    const memory = createMemoryStore();

    const invite = await createAcceptedMemberInviteForUser({
      user: {
        id: 'user-2',
        email: 'New.Driver@Example.com',
      },
      invitedBy: inviter,
      store: memory.store,
      nowDate: new Date('2026-05-04T10:00:00.000Z'),
    });

    expect(invite).toMatchObject({
      inviteEmail: 'new.driver@example.com',
      invitedByUserId: 'user-1',
      invitedByName: 'Driver One',
      status: 'accepted',
      acceptedByUserId: 'user-2',
      acceptedAt: '2026-05-04T10:00:00.000Z',
    });
  });

  it('accepts Gmail aliases when a Google sign-in returns the canonical address', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@googlemail.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    const allowed = await ensureUserMemberAccess(
      {
        id: 'user-2',
        email: 'newdriver+trackday@gmail.com',
        name: 'New Driver',
        role: 'member',
      },
      memory.store,
    );

    expect(allowed).toBe(true);
    expect(memory.records[0]).toMatchObject({
      status: 'accepted',
      acceptedByUserId: 'user-2',
    });
  });

  it('rejects revoked invites when a user signs in', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'revoked',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    await expect(
      ensureUserMemberAccess(
        {
          id: 'user-2',
          email: 'new.driver@example.com',
          name: 'New Driver',
          role: 'member',
        },
        memory.store,
      ),
    ).resolves.toBe(false);
  });

  it('rejects expired invites when a user signs in', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        expiresAt: '2026-04-01T10:00:00.000Z',
        createdAt: '2026-03-01T10:00:00.000Z',
        updatedAt: '2026-03-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    await expect(
      ensureUserMemberAccess(
        {
          id: 'user-2',
          email: 'new.driver@example.com',
          name: 'New Driver',
          role: 'member',
        },
        memory.store,
      ),
    ).resolves.toBe(false);
  });

  it('allows password account creation for active invited emails only', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        expiresAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
      {
        inviteEmail: 'revoked.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'revoked',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    await expect(
      canCreateMemberAccountForEmail({
        email: ' New.Driver@Example.com ',
        store: memory.store,
        now: new Date('2026-05-01T10:00:00.000Z'),
      }),
    ).resolves.toBe(true);
    await expect(
      canCreateMemberAccountForEmail({
        email: 'revoked.driver@example.com',
        store: memory.store,
        now: new Date('2026-05-01T10:00:00.000Z'),
      }),
    ).resolves.toBe(false);
    await expect(
      canCreateMemberAccountForEmail({
        email: 'missing.driver@example.com',
        store: memory.store,
        now: new Date('2026-05-01T10:00:00.000Z'),
      }),
    ).resolves.toBe(false);
  });

  it('allows account creation with a valid join-link token', async () => {
    canUseMemberJoinLinkForAccountCreation.mockResolvedValue(true);

    await expect(
      canCreateMemberAccountForEmail({
        email: 'new.driver@example.com',
        store: createMemoryStore().store,
        now: new Date('2026-05-01T10:00:00.000Z'),
        joinToken: 'join-token',
      }),
    ).resolves.toBe(true);
    expect(canUseMemberJoinLinkForAccountCreation).toHaveBeenCalledWith({
      token: 'join-token',
      now: expect.any(Date),
    });
  });

  it('grants durable member access when a user account is created from a join link', async () => {
    acceptMemberJoinLink.mockResolvedValue({
      ok: true,
      link: {
        createdByUserId: 'admin-1',
        createdByName: 'Admin One',
      },
    });
    const memory = createMemoryStore();

    await expect(
      grantMemberAccessFromJoinLink({
        token: 'join-token',
        user: {
          id: 'user-2',
          email: 'New.Driver@Example.com',
          name: 'New Driver',
        },
        store: memory.store,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(memory.records[0]).toMatchObject({
      inviteEmail: 'new.driver@example.com',
      invitedByUserId: 'admin-1',
      invitedByName: 'Admin One',
      status: 'accepted',
      acceptedByUserId: 'user-2',
    });
  });

  it('allows account creation when a Gmail invite matches the Google account alias', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@gmail.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        expiresAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    await expect(
      canCreateMemberAccountForEmail({
        email: 'newdriver@gmail.com',
        store: memory.store,
        now: new Date('2026-05-01T10:00:00.000Z'),
      }),
    ).resolves.toBe(true);
  });

  it('revokes pending invites', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);

    await expect(revokeMemberInvite('new.driver@example.com', memory.store)).resolves.toMatchObject(
      {
        status: 'revoked',
      },
    );
  });

  it('allows bootstrap members without an invite', async () => {
    vi.stubEnv('GRID_STAY_BOOTSTRAP_MEMBER_EMAILS', 'driver@example.com');

    const allowed = await ensureUserMemberAccess(inviter, createMemoryStore().store);

    expect(allowed).toBe(true);
  });

  it('rejects invalid invite emails in action results', async () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    const result = await submitMemberInvite(formData, inviter, createMemoryStore().store);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected validation failure');
    }
    expect(result.fieldErrors.email?.[0]).toBeDefined();
  });

  it('routes revoke invite actions', async () => {
    const memory = createMemoryStore([
      {
        inviteEmail: 'new.driver@example.com',
        inviteScope: 'member',
        invitedByUserId: 'user-1',
        invitedByName: 'Driver One',
        status: 'pending',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
      } as MemberInviteRecord,
    ]);
    const formData = new FormData();
    formData.set('intent', 'revokeInvite');
    formData.set('email', 'new.driver@example.com');

    const result = await submitMemberInviteAction(formData, inviter, memory.store);

    expect(result).toMatchObject({
      ok: true,
      message: 'new.driver@example.com has been revoked.',
    });
  });
});
