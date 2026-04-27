import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { MemberProfileRecord } from '~/lib/db/entities/member-profile.server';
import {
  isAdminUser,
  isBootstrapMemberEmail,
  normalizeEmail,
} from './authorization';
import type { User } from './schemas';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SSTResource = Resource as unknown as {
  AuthTable: { name: string };
};

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  authName?: string;
  displayName?: string;
  image?: string;
  role?: User['role'];
}

export interface MemberDirectoryEntry {
  id: string;
  name: string;
  picture?: string;
  role: User['role'];
  activeTripsCount: number;
  sharedStayCount: number;
  nextTrip:
    | {
        date: string;
        circuit: string;
        provider: string;
        accommodationName?: string;
      }
    | undefined;
}

export interface AdminMemberDirectoryEntry extends MemberDirectoryEntry {
  email: string;
}

type MemberProfileSummary = Pick<MemberProfileRecord, 'userId' | 'displayName'>;

type LoadMemberProfiles = () => Promise<MemberProfileSummary[]>;

type LoadMemberProfile = (
  userId: string,
) => Promise<MemberProfileSummary | null>;

type MemberInviteAccessRecord = {
  inviteEmail: string;
  status: 'pending' | 'accepted';
};

type LoadMemberInvites = () => Promise<MemberInviteAccessRecord[]>;

async function scanAuthUsers(): Promise<AuthUserRecord[]> {
  const users: AuthUserRecord[] = [];
  let exclusiveStartKey: ScanCommandInput['ExclusiveStartKey'];

  do {
    const response = await docClient.send(
      new ScanCommand({
        TableName: SSTResource.AuthTable.name,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression: '#sk = :userSk AND begins_with(#pk, :userPrefix)',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#sk': 'sk',
        },
        ExpressionAttributeValues: {
          ':userSk': 'USER',
          ':userPrefix': 'USER#',
        },
      }),
    );

    users.push(...((response.Items ?? []) as AuthUserRecord[]));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return users;
}

function getActiveBookings(bookings: BookingRecord[], today: string) {
  return bookings
    .filter(
      (booking) => booking.status !== 'cancelled' && booking.date >= today,
    )
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function loadMemberProfilesDefault(): Promise<MemberProfileSummary[]> {
  const { listMemberProfiles } = await import(
    '~/lib/db/services/member-profile.server'
  );
  return listMemberProfiles();
}

async function loadMemberProfileDefault(
  userId: string,
): Promise<MemberProfileSummary | null> {
  const { getMemberProfile } = await import(
    '~/lib/db/services/member-profile.server'
  );
  return getMemberProfile(userId);
}

async function loadMemberInvitesDefault(): Promise<MemberInviteAccessRecord[]> {
  const { listMemberInvites } = await import('./member-invites.server');
  return listMemberInvites();
}

function withMemberProfile(
  user: AuthUserRecord,
  profile: MemberProfileSummary | null | undefined,
): AuthUserRecord {
  const authName = user.authName ?? user.name;
  const displayName = profile?.displayName.trim();

  if (!displayName) {
    return {
      ...user,
      authName,
      displayName: undefined,
      name: authName,
    };
  }

  return {
    ...user,
    authName,
    displayName,
    name: displayName,
  };
}

function applyMemberProfiles(
  users: AuthUserRecord[],
  profiles: MemberProfileSummary[],
): AuthUserRecord[] {
  const profilesByUser = new Map(
    profiles.map((profile) => [profile.userId, profile]),
  );

  return users.map((user) =>
    withMemberProfile(user, profilesByUser.get(user.id)),
  );
}

function summarizeMember(
  user: AuthUserRecord,
  bookings: BookingRecord[],
  today: string,
): MemberDirectoryEntry {
  const activeBookings = getActiveBookings(bookings, today);
  const nextTrip = activeBookings[0];

  return {
    id: user.id,
    name: user.name,
    picture: user.image,
    role: user.role ?? 'member',
    activeTripsCount: activeBookings.length,
    sharedStayCount: new Set(
      activeBookings
        .map((booking) => booking.accommodationName?.trim())
        .filter((name): name is string => Boolean(name)),
    ).size,
    nextTrip: nextTrip
      ? {
          date: nextTrip.date,
          circuit: nextTrip.circuit,
          provider: nextTrip.provider,
          accommodationName: nextTrip.accommodationName,
        }
      : undefined,
  };
}

function summarizeAdminMember(
  user: AuthUserRecord,
  bookings: BookingRecord[],
  today: string,
): AdminMemberDirectoryEntry {
  return {
    ...summarizeMember(user, bookings, today),
    email: user.email,
  };
}

function compareMembers(
  left: MemberDirectoryEntry,
  right: MemberDirectoryEntry,
): number {
  if (left.nextTrip && right.nextTrip) {
    if (left.nextTrip.date !== right.nextTrip.date) {
      return left.nextTrip.date.localeCompare(right.nextTrip.date);
    }

    return left.name.localeCompare(right.name);
  }

  if (left.nextTrip) {
    return -1;
  }

  if (right.nextTrip) {
    return 1;
  }

  return left.name.localeCompare(right.name);
}

function filterInvitedUsers(
  users: AuthUserRecord[],
  invites: MemberInviteAccessRecord[],
) {
  const acceptedInviteEmails = new Set(
    invites
      .filter((invite) => invite.status === 'accepted')
      .map((invite) => normalizeEmail(invite.inviteEmail)),
  );

  return users.filter(
    (user) =>
      isAdminUser({ email: user.email, role: user.role ?? 'member' }) ||
      isBootstrapMemberEmail(user.email) ||
      acceptedInviteEmails.has(normalizeEmail(user.email)),
  );
}

export async function listSiteMembers(
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings: (userId: string) => Promise<BookingRecord[]> = async (
    userId,
  ) => {
    const { listMyBookings } = await import('~/lib/db/services/booking.server');
    return listMyBookings(userId);
  },
  today = new Date().toISOString().slice(0, 10),
  loadProfiles: LoadMemberProfiles = loadMemberProfilesDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
): Promise<MemberDirectoryEntry[]> {
  const [users, profiles, invites] = await Promise.all([
    loadUsers(),
    loadProfiles(),
    loadInvites(),
  ]);
  const usersWithProfiles = applyMemberProfiles(
    filterInvitedUsers(users, invites),
    profiles,
  );
  const members = await Promise.all(
    usersWithProfiles.map(async (user) =>
      summarizeMember(user, await loadBookings(user.id), today),
    ),
  );

  return members.sort(compareMembers);
}

export async function listAdminSiteMembers(
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings: (userId: string) => Promise<BookingRecord[]> = async (
    userId,
  ) => {
    const { listMyBookings } = await import('~/lib/db/services/booking.server');
    return listMyBookings(userId);
  },
  today = new Date().toISOString().slice(0, 10),
  loadProfiles: LoadMemberProfiles = loadMemberProfilesDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
): Promise<AdminMemberDirectoryEntry[]> {
  const [users, profiles, invites] = await Promise.all([
    loadUsers(),
    loadProfiles(),
    loadInvites(),
  ]);
  const usersWithProfiles = applyMemberProfiles(
    filterInvitedUsers(users, invites),
    profiles,
  );
  const members = await Promise.all(
    usersWithProfiles.map(async (user) =>
      summarizeAdminMember(user, await loadBookings(user.id), today),
    ),
  );

  return members.sort(compareMembers);
}

export async function getSiteMemberById(
  memberId: string,
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadProfile: LoadMemberProfile = loadMemberProfileDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
): Promise<AuthUserRecord | null> {
  const [users, profile, invites] = await Promise.all([
    loadUsers(),
    loadProfile(memberId),
    loadInvites(),
  ]);
  const user = filterInvitedUsers(users, invites).find(
    (candidate) => candidate.id === memberId,
  );
  return user ? withMemberProfile(user, profile) : null;
}
