import { z } from 'zod';
import {
  MemberInviteEntity,
  type MemberInviteRecord,
} from '~/lib/db/entities/member-invite.server';
import {
  isAdminUser,
  isBootstrapMemberEmail,
  normalizeEmail,
} from './authorization';
import type { User } from './schemas';

const MEMBER_INVITE_SCOPE = 'member';

export interface MemberInviteSummary {
  inviteEmail: string;
  invitedByName: string;
  status: MemberInviteRecord['status'];
  acceptedAt?: string;
  createdAt: string;
}

export interface MemberInvitePersistence {
  create(item: MemberInviteRecord): Promise<MemberInviteRecord>;
  update(
    inviteEmail: string,
    changes: Partial<MemberInviteRecord>,
  ): Promise<MemberInviteRecord>;
  getByEmail(inviteEmail: string): Promise<MemberInviteRecord | null>;
  listAll(): Promise<MemberInviteRecord[]>;
}

export type MemberInviteActionResult =
  | {
      ok: true;
      message: string;
      invite: MemberInviteSummary;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<'email', string[] | undefined>>;
    };

const MemberInviteInputSchema = z.object({
  email: z.email().transform(normalizeEmail),
});

export const memberInviteStore: MemberInvitePersistence = {
  async create(item) {
    const record = {
      ...item,
      inviteEmail: normalizeEmail(item.inviteEmail),
      inviteScope: MEMBER_INVITE_SCOPE,
    };

    await MemberInviteEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(inviteEmail, changes) {
    const updated = await MemberInviteEntity.patch({
      inviteEmail: normalizeEmail(inviteEmail),
      inviteScope: MEMBER_INVITE_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async getByEmail(inviteEmail) {
    const response = await MemberInviteEntity.get({
      inviteEmail: normalizeEmail(inviteEmail),
      inviteScope: MEMBER_INVITE_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await MemberInviteEntity.query
      .allInvites({
        inviteScope: MEMBER_INVITE_SCOPE,
      })
      .go();
    return response.data;
  },
};

function toMemberInviteSummary(
  invite: MemberInviteRecord,
): MemberInviteSummary {
  return {
    inviteEmail: invite.inviteEmail,
    invitedByName: invite.invitedByName,
    status: invite.status,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
  };
}

function compareInvites(left: MemberInviteRecord, right: MemberInviteRecord) {
  if (left.status !== right.status) {
    return left.status === 'pending' ? -1 : 1;
  }

  return left.inviteEmail.localeCompare(right.inviteEmail);
}

export async function createMemberInvite(
  email: string,
  invitedBy: Pick<User, 'id' | 'name'>,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<{
  invite: MemberInviteRecord;
  created: boolean;
}> {
  const inviteEmail = normalizeEmail(email);
  const existing = await store.getByEmail(inviteEmail);
  const now = new Date().toISOString();

  if (existing?.status === 'accepted') {
    return {
      invite: existing,
      created: false,
    };
  }

  if (existing) {
    return {
      invite: await store.update(inviteEmail, {
        invitedByUserId: invitedBy.id,
        invitedByName: invitedBy.name,
        updatedAt: now,
      }),
      created: false,
    };
  }

  return {
    invite: await store.create({
      inviteEmail,
      inviteScope: MEMBER_INVITE_SCOPE,
      invitedByUserId: invitedBy.id,
      invitedByName: invitedBy.name,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    } as MemberInviteRecord),
    created: true,
  };
}

export async function acceptMemberInviteForUser(
  user: Pick<User, 'id' | 'email'>,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteRecord | null> {
  const invite = await store.getByEmail(user.email);
  if (!invite) {
    return null;
  }

  if (invite.status === 'accepted') {
    return invite;
  }

  const now = new Date().toISOString();
  return store.update(invite.inviteEmail, {
    status: 'accepted',
    acceptedByUserId: user.id,
    acceptedAt: now,
    updatedAt: now,
  });
}

export async function ensureUserMemberAccess(
  user: User,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<boolean> {
  if (isAdminUser(user) || isBootstrapMemberEmail(user.email)) {
    return true;
  }

  return Boolean(await acceptMemberInviteForUser(user, store));
}

export async function listMemberInvites(
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteRecord[]> {
  const invites = await store.listAll();
  return invites.sort(compareInvites);
}

export async function listPendingMemberInvites(
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteSummary[]> {
  const invites = await listMemberInvites(store);
  return invites
    .filter((invite) => invite.status === 'pending')
    .map(toMemberInviteSummary);
}

export async function submitMemberInvite(
  formData: FormData,
  invitedBy: User,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteActionResult> {
  const parsed = MemberInviteInputSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not create this invite.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (normalizeEmail(invitedBy.email) === parsed.data.email) {
    return {
      ok: false,
      formError: 'You already have access to Grid Stay.',
      fieldErrors: {},
    };
  }

  const result = await createMemberInvite(parsed.data.email, invitedBy, store);
  const invite = toMemberInviteSummary(result.invite);

  return {
    ok: true,
    message:
      invite.status === 'accepted'
        ? `${invite.inviteEmail} is already a member.`
        : result.created
          ? `${invite.inviteEmail} can now sign in with Google.`
          : `${invite.inviteEmail} already has a pending invite.`,
    invite,
  };
}
