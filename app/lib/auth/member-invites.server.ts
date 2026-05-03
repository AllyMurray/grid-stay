import { z } from 'zod';
import {
  MemberInviteEntity,
  type MemberInviteRecord,
} from '~/lib/db/entities/member-invite.server';
import {
  hasGmailAliasSemantics,
  isAdminUser,
  isBootstrapMemberEmail,
  normalizeEmail,
  normalizeMemberAccessEmail,
} from './authorization';
import type { User } from './schemas';

const MEMBER_INVITE_SCOPE = 'member';
const MEMBER_INVITE_TTL_DAYS = 30;

export interface MemberInviteSummary {
  inviteEmail: string;
  invitedByName: string;
  status: MemberInviteRecord['status'];
  acceptedAt?: string;
  expiresAt?: string;
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
  email: z.string().trim().pipe(z.email()).transform(normalizeEmail),
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
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

function compareInvites(left: MemberInviteRecord, right: MemberInviteRecord) {
  if (left.status !== right.status) {
    if (left.status === 'pending') {
      return -1;
    }
    if (right.status === 'pending') {
      return 1;
    }
  }

  return left.inviteEmail.localeCompare(right.inviteEmail);
}

function addDays(value: Date, days: number): string {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function isInviteExpired(
  invite: MemberInviteRecord,
  now = new Date(),
): boolean {
  return Boolean(invite.expiresAt && invite.expiresAt <= now.toISOString());
}

function isInviteUsableForMemberAccess(
  invite: MemberInviteRecord,
  now: Date,
): boolean {
  if (invite.status === 'accepted') {
    return true;
  }

  return invite.status === 'pending' && !isInviteExpired(invite, now);
}

function getMemberAccessInvitePriority(
  invite: MemberInviteRecord,
  now: Date,
): number {
  if (invite.status === 'pending' && !isInviteExpired(invite, now)) {
    return 0;
  }

  if (invite.status === 'accepted') {
    return 1;
  }

  if (invite.status === 'pending') {
    return 2;
  }

  return 3;
}

function compareMemberAccessInviteCandidates(
  left: MemberInviteRecord,
  right: MemberInviteRecord,
  now: Date,
): number {
  const priorityDifference =
    getMemberAccessInvitePriority(left, now) -
    getMemberAccessInvitePriority(right, now);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

async function findMemberInviteForAccessEmail(
  email: string,
  store: MemberInvitePersistence,
  now = new Date(),
): Promise<MemberInviteRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  const directInvite = await store.getByEmail(normalizedEmail);

  if (directInvite && isInviteUsableForMemberAccess(directInvite, now)) {
    return directInvite;
  }

  const memberAccessEmail = normalizeMemberAccessEmail(normalizedEmail);
  if (
    memberAccessEmail === normalizedEmail &&
    !hasGmailAliasSemantics(normalizedEmail)
  ) {
    return directInvite;
  }

  const invite = (await store.listAll())
    .filter(
      (candidate) =>
        normalizeMemberAccessEmail(candidate.inviteEmail) === memberAccessEmail,
    )
    .sort((left, right) =>
      compareMemberAccessInviteCandidates(left, right, now),
    )[0];

  return invite ?? directInvite ?? null;
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
  const existing = await findMemberInviteForAccessEmail(inviteEmail, store);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = addDays(nowDate, MEMBER_INVITE_TTL_DAYS);

  if (existing?.status === 'accepted') {
    return {
      invite: existing,
      created: false,
    };
  }

  if (existing) {
    return {
      invite: await store.update(existing.inviteEmail, {
        invitedByUserId: invitedBy.id,
        invitedByName: invitedBy.name,
        status: 'pending',
        expiresAt,
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
      expiresAt,
      createdAt: now,
      updatedAt: now,
    } as MemberInviteRecord),
    created: true,
  };
}

export async function acceptMemberInviteForUser(
  user: Pick<User, 'id' | 'email'>,
  store: MemberInvitePersistence = memberInviteStore,
  now = new Date(),
): Promise<MemberInviteRecord | null> {
  const invite = await findMemberInviteForAccessEmail(user.email, store, now);
  if (!invite) {
    return null;
  }

  if (invite.status === 'accepted') {
    return invite;
  }

  if (invite.status === 'revoked' || isInviteExpired(invite, now)) {
    return null;
  }

  const acceptedAt = now.toISOString();
  return store.update(invite.inviteEmail, {
    status: 'accepted',
    acceptedByUserId: user.id,
    acceptedAt,
    updatedAt: acceptedAt,
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

export async function canCreateMemberAccountForEmail(
  email: string,
  store: MemberInvitePersistence = memberInviteStore,
  now = new Date(),
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);

  if (
    isAdminUser({ email: normalizedEmail, role: 'member' }) ||
    isBootstrapMemberEmail(normalizedEmail)
  ) {
    return true;
  }

  const invite = await findMemberInviteForAccessEmail(
    normalizedEmail,
    store,
    now,
  );
  if (!invite || !isInviteUsableForMemberAccess(invite, now)) {
    return false;
  }

  return invite.status === 'pending' || invite.status === 'accepted';
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

export async function revokeMemberInvite(
  inviteEmail: string,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteRecord | null> {
  const existing = await findMemberInviteForAccessEmail(inviteEmail, store);
  if (!existing || existing.status === 'accepted') {
    return existing;
  }

  return store.update(inviteEmail, {
    status: 'revoked',
    updatedAt: new Date().toISOString(),
  });
}

export async function submitRevokeMemberInvite(
  formData: FormData,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteActionResult> {
  const parsed = MemberInviteInputSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Could not revoke this invite.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const invite = await revokeMemberInvite(parsed.data.email, store);
  if (!invite) {
    return {
      ok: false,
      formError: 'This invite could not be found.',
      fieldErrors: {},
    };
  }

  return {
    ok: true,
    message:
      invite.status === 'accepted'
        ? `${invite.inviteEmail} is already a member.`
        : `${invite.inviteEmail} has been revoked.`,
    invite: toMemberInviteSummary(invite),
  };
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

  if (
    normalizeMemberAccessEmail(invitedBy.email) ===
    normalizeMemberAccessEmail(parsed.data.email)
  ) {
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
          ? `${invite.inviteEmail} can now sign in.`
          : `${invite.inviteEmail} already has a pending invite.`,
    invite,
  };
}

export async function submitMemberInviteAction(
  formData: FormData,
  invitedBy: User,
  store: MemberInvitePersistence = memberInviteStore,
): Promise<MemberInviteActionResult> {
  const intent = formData.get('intent')?.toString() ?? 'createInvite';

  if (intent === 'revokeInvite') {
    return submitRevokeMemberInvite(formData, store);
  }

  return submitMemberInvite(formData, invitedBy, store);
}
