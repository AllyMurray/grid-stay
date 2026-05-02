import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberInviteRecord } from '~/lib/db/entities/member-invite.server';
import type { User } from './schemas';

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

import {
  canCreateMemberAccountForEmail,
  createMemberInvite,
  ensureUserMemberAccess,
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
        const index = records.findIndex(
          (record) => record.inviteEmail === inviteEmail,
        );
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
        return (
          records.find((record) => record.inviteEmail === inviteEmail) ?? null
        );
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
  });

  it('creates normalized pending invites', async () => {
    const memory = createMemoryStore();

    const result = await createMemberInvite(
      ' New.Driver@Example.com ',
      inviter,
      memory.store,
    );

    expect(result.created).toBe(true);
    expect(result.invite).toMatchObject({
      inviteEmail: 'new.driver@example.com',
      invitedByUserId: 'user-1',
      invitedByName: 'Driver One',
      status: 'pending',
      expiresAt: expect.any(String),
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
      canCreateMemberAccountForEmail(
        ' New.Driver@Example.com ',
        memory.store,
        new Date('2026-05-01T10:00:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      canCreateMemberAccountForEmail(
        'revoked.driver@example.com',
        memory.store,
        new Date('2026-05-01T10:00:00.000Z'),
      ),
    ).resolves.toBe(false);
    await expect(
      canCreateMemberAccountForEmail(
        'missing.driver@example.com',
        memory.store,
        new Date('2026-05-01T10:00:00.000Z'),
      ),
    ).resolves.toBe(false);
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

    await expect(
      revokeMemberInvite('new.driver@example.com', memory.store),
    ).resolves.toMatchObject({
      status: 'revoked',
    });
  });

  it('allows bootstrap members without an invite', async () => {
    vi.stubEnv('GRID_STAY_BOOTSTRAP_MEMBER_EMAILS', 'driver@example.com');

    const allowed = await ensureUserMemberAccess(
      inviter,
      createMemoryStore().store,
    );

    expect(allowed).toBe(true);
  });

  it('rejects invalid invite emails in action results', async () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    const result = await submitMemberInvite(
      formData,
      inviter,
      createMemoryStore().store,
    );

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

    const result = await submitMemberInviteAction(
      formData,
      inviter,
      memory.store,
    );

    expect(result).toMatchObject({
      ok: true,
      message: 'new.driver@example.com has been revoked.',
    });
  });
});
