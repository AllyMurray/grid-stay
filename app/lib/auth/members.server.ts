import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  type ScanCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { z } from 'zod';
import {
  type AccommodationStatus,
  hasBookedAccommodation,
  resolveAccommodationStatus,
} from '~/lib/bookings/accommodation';
import { resolveArrivalDateTime } from '~/lib/dates/arrival';
import type { AvailableDay, DayAttendanceSummary } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { MemberProfileRecord } from '~/lib/db/entities/member-profile.server';
import type { DayAttendanceOverview } from '~/lib/db/services/day-attendance-summary.server';
import type { CreateBookingInput } from '~/lib/schemas/booking';
import { isAdminUser, isBootstrapMemberEmail, normalizeMemberAccessEmail } from './authorization';
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
        accommodationStatus?: AccommodationStatus;
        accommodationName?: string;
      }
    | undefined;
}

export interface AdminMemberDirectoryEntry extends MemberDirectoryEntry {
  email: string;
}

export interface MemberDateLeaderboardEntry {
  id: string;
  name: string;
  picture?: string;
  totalCount: number;
  raceDayCount: number;
  testDayCount: number;
  trackDayCount: number;
}

export interface MemberBookedDay {
  dayId: string;
  date: string;
  type: BookingRecord['type'];
  status: 'booked' | 'maybe';
  circuit: string;
  circuitId?: string;
  circuitName?: string;
  layout?: string;
  circuitKnown?: boolean;
  provider: string;
  description: string;
  arrivalDateTime?: string;
  arrivalTime?: string;
  accommodationStatus?: AccommodationStatus;
  accommodationName?: string;
}

export interface MemberBookedDaysData {
  member: Pick<AuthUserRecord, 'id' | 'name' | 'image' | 'role'>;
  days: MemberBookedDay[];
}

export interface GroupCalendarMember {
  id: string;
  name: string;
  picture?: string;
  role: User['role'];
}

export interface GroupCalendarAttendee {
  userId: string;
  userName: string;
  userImage?: string;
  status: 'booked' | 'maybe';
  arrivalDateTime?: string;
  accommodationStatus?: AccommodationStatus;
  accommodationName?: string;
}

export interface GroupCalendarEvent {
  dayId: string;
  date: string;
  type: BookingRecord['type'];
  circuit: string;
  circuitId?: string;
  circuitName?: string;
  layout?: string;
  circuitKnown?: boolean;
  provider: string;
  description: string;
  bookedCount: number;
  maybeCount: number;
  attendees: GroupCalendarAttendee[];
}

export interface GroupCalendarData {
  members: GroupCalendarMember[];
  events: GroupCalendarEvent[];
  today: string;
  month: string;
}

type MemberProfileSummary = Pick<MemberProfileRecord, 'userId' | 'displayName'>;

type LoadMemberProfiles = () => Promise<MemberProfileSummary[]>;

type LoadMemberProfile = (userId: string) => Promise<MemberProfileSummary | null>;

type MemberInviteAccessRecord = {
  inviteEmail: string;
  status: 'pending' | 'accepted' | 'revoked';
};

type LoadMemberInvites = () => Promise<MemberInviteAccessRecord[]>;

type LoadBookings = (userId: string) => Promise<BookingRecord[]>;

type SaveBooking = (input: CreateBookingInput, user: User) => Promise<unknown>;

type LoadGroupCalendarDays = () => Promise<AvailableDay[]>;

type LoadDayAttendanceOverviews = (dayIds: string[]) => Promise<Map<string, DayAttendanceOverview>>;

type LoadDayAttendanceSummaries = (dayIds: string[]) => Promise<Map<string, DayAttendanceSummary>>;

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export type MemberDayBookingActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<'dayId' | 'status'>;
    };

const MemberDayBookingSchema = z.object({
  dayId: z.string().min(1),
  status: z.enum(['booked', 'maybe']),
});

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
    .filter((booking) => booking.status !== 'cancelled' && booking.date >= today)
    .toSorted((left, right) => left.date.localeCompare(right.date));
}

async function loadBookingsDefault(userId: string): Promise<BookingRecord[]> {
  const { listMyBookings } = await import('~/lib/db/services/booking.server');
  return listMyBookings(userId);
}

async function loadUpcomingGroupCalendarDaysDefault(): Promise<AvailableDay[]> {
  const { loadUpcomingAvailableDaysOverview } = await import('~/lib/days/dashboard-feed.server');
  return (await loadUpcomingAvailableDaysOverview()).days;
}

async function loadDayAttendanceOverviewsDefault(
  dayIds: string[],
): Promise<Map<string, DayAttendanceOverview>> {
  const { dayAttendanceSummaryStore } = await import(
    '~/lib/db/services/day-attendance-summary.server'
  );
  return dayAttendanceSummaryStore.getByDayIds(dayIds);
}

async function loadDayAttendanceSummariesDefault(
  dayIds: string[],
): Promise<Map<string, DayAttendanceSummary>> {
  const { listAttendanceSummariesForDays } = await import('~/lib/db/services/booking.server');
  return listAttendanceSummariesForDays(dayIds);
}

async function saveBookingDefault(input: CreateBookingInput, user: User): Promise<unknown> {
  const { createBooking } = await import('~/lib/db/services/booking.server');
  return createBooking(input, user);
}

async function loadMemberProfilesDefault(): Promise<MemberProfileSummary[]> {
  const { listMemberProfiles } = await import('~/lib/db/services/member-profile.server');
  return listMemberProfiles();
}

async function loadMemberProfileDefault(userId: string): Promise<MemberProfileSummary | null> {
  const { getMemberProfile } = await import('~/lib/db/services/member-profile.server');
  return getMemberProfile(userId);
}

async function loadMemberInvitesDefault(): Promise<MemberInviteAccessRecord[]> {
  const { listMemberInvites } = await import('./member-invites.server');
  return listMemberInvites();
}

function toMemberBookedDay(booking: BookingRecord): MemberBookedDay | null {
  if (booking.status === 'cancelled') {
    return null;
  }

  const arrivalDateTime = resolveArrivalDateTime(booking);

  return {
    dayId: booking.dayId,
    date: booking.date,
    type: booking.type,
    status: booking.status,
    circuit: booking.circuit,
    ...(booking.circuitId ? { circuitId: booking.circuitId } : {}),
    ...(booking.circuitName ? { circuitName: booking.circuitName } : {}),
    ...(booking.layout ? { layout: booking.layout } : {}),
    ...(booking.circuitKnown !== undefined ? { circuitKnown: booking.circuitKnown } : {}),
    provider: booking.provider,
    description: booking.description,
    ...(arrivalDateTime ? { arrivalDateTime } : {}),
    accommodationStatus: resolveAccommodationStatus(booking),
    ...(booking.accommodationName ? { accommodationName: booking.accommodationName } : {}),
  };
}

function compareGroupCalendarAttendees(left: GroupCalendarAttendee, right: GroupCalendarAttendee) {
  if (left.status !== right.status) {
    return left.status === 'booked' ? -1 : 1;
  }

  return left.userName.localeCompare(right.userName);
}

function toGroupCalendarMember(user: AuthUserRecord): GroupCalendarMember {
  return {
    id: user.id,
    name: user.name,
    picture: user.image,
    role: user.role ?? 'member',
  };
}

function ensureGroupCalendarEvent(events: Map<string, GroupCalendarEvent>, booking: BookingRecord) {
  const existing = events.get(booking.dayId);
  if (existing) {
    return existing;
  }

  const event: GroupCalendarEvent = {
    dayId: booking.dayId,
    date: booking.date,
    type: booking.type,
    circuit: booking.circuit,
    ...(booking.circuitId ? { circuitId: booking.circuitId } : {}),
    ...(booking.circuitName ? { circuitName: booking.circuitName } : {}),
    ...(booking.layout ? { layout: booking.layout } : {}),
    ...(booking.circuitKnown !== undefined ? { circuitKnown: booking.circuitKnown } : {}),
    provider: booking.provider,
    description: booking.description,
    bookedCount: 0,
    maybeCount: 0,
    attendees: [],
  };

  events.set(booking.dayId, event);
  return event;
}

function toCreateBookingInput(
  day: MemberBookedDay,
  status: CreateBookingInput['status'],
): CreateBookingInput {
  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    status,
    circuit: day.circuit,
    ...(day.circuitId ? { circuitId: day.circuitId } : {}),
    ...(day.circuitName ? { circuitName: day.circuitName } : {}),
    ...(day.layout ? { layout: day.layout } : {}),
    ...(day.circuitKnown !== undefined ? { circuitKnown: day.circuitKnown } : {}),
    provider: day.provider,
    description: day.description,
  };
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
  const profilesByUser = new Map(profiles.map((profile) => [profile.userId, profile]));

  return users.map((user) => withMemberProfile(user, profilesByUser.get(user.id)));
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
        .filter(hasBookedAccommodation)
        .map((booking) => booking.accommodationName?.trim())
        .filter((name): name is string => Boolean(name)),
    ).size,
    nextTrip: nextTrip
      ? {
          date: nextTrip.date,
          circuit: nextTrip.circuit,
          provider: nextTrip.provider,
          accommodationStatus: resolveAccommodationStatus(nextTrip),
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

function createEmptyMemberSummary(user: AuthUserRecord): MemberDirectoryEntry {
  return {
    id: user.id,
    name: user.name,
    picture: user.image,
    role: user.role ?? 'member',
    activeTripsCount: 0,
    sharedStayCount: 0,
    nextTrip: undefined,
  };
}

function summarizeMemberDateLeaderboardEntry(
  user: AuthUserRecord,
  bookings: BookingRecord[],
): MemberDateLeaderboardEntry | null {
  let raceDayCount = 0;
  let testDayCount = 0;
  let trackDayCount = 0;

  for (const booking of bookings) {
    if (booking.status !== 'booked') {
      continue;
    }

    switch (booking.type) {
      case 'race_day':
        raceDayCount += 1;
        break;
      case 'test_day':
        testDayCount += 1;
        break;
      case 'track_day':
        trackDayCount += 1;
        break;
      case 'road_drive':
        break;
    }
  }

  const totalCount = raceDayCount + testDayCount + trackDayCount;

  if (totalCount === 0) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    picture: user.image,
    totalCount,
    raceDayCount,
    testDayCount,
    trackDayCount,
  };
}

function toGroupCalendarAttendee(
  attendee: DayAttendanceSummary['attendees'][number],
  member: AuthUserRecord,
): GroupCalendarAttendee {
  return {
    userId: member.id,
    userName: member.name,
    ...(member.image || attendee.userImage ? { userImage: member.image ?? attendee.userImage } : {}),
    status: attendee.status === 'maybe' ? 'maybe' : 'booked',
    ...(attendee.arrivalDateTime ? { arrivalDateTime: attendee.arrivalDateTime } : {}),
    accommodationStatus: resolveAccommodationStatus(attendee),
    ...(attendee.accommodationName ? { accommodationName: attendee.accommodationName } : {}),
  };
}

function summarizeMemberFromDays(
  user: AuthUserRecord,
  days: AvailableDay[],
  summariesByDayId: Map<string, DayAttendanceSummary>,
): MemberDirectoryEntry {
  const accommodationNames = new Set<string>();
  let activeTripsCount = 0;
  let nextTrip: MemberDirectoryEntry['nextTrip'];

  for (const day of days) {
    const attendee = summariesByDayId
      .get(day.dayId)
      ?.attendees.find(
        (candidate) => candidate.userId === user.id && candidate.status !== 'cancelled',
      );

    if (!attendee) {
      continue;
    }

    activeTripsCount += 1;
    if (hasBookedAccommodation(attendee) && attendee.accommodationName?.trim()) {
      accommodationNames.add(attendee.accommodationName.trim());
    }

    if (!nextTrip || day.date < nextTrip.date) {
      nextTrip = {
        date: day.date,
        circuit: day.circuit,
        provider: day.provider,
        accommodationStatus: resolveAccommodationStatus(attendee),
        accommodationName: attendee.accommodationName,
      };
    }
  }

  return {
    ...createEmptyMemberSummary(user),
    activeTripsCount,
    sharedStayCount: accommodationNames.size,
    nextTrip,
  };
}

function toGroupCalendarEvent(
  day: AvailableDay,
  summary: DayAttendanceSummary,
  membersById: Map<string, AuthUserRecord>,
): GroupCalendarEvent | null {
  const attendees = summary.attendees
    .filter((attendee) => attendee.status === 'booked' || attendee.status === 'maybe')
    .map((attendee) => {
      const member = membersById.get(attendee.userId);
      return member ? toGroupCalendarAttendee(attendee, member) : null;
    })
    .filter((attendee): attendee is GroupCalendarAttendee => Boolean(attendee))
    .toSorted(compareGroupCalendarAttendees);

  if (attendees.length === 0) {
    return null;
  }

  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    ...(day.circuitId ? { circuitId: day.circuitId } : {}),
    ...(day.circuitName ? { circuitName: day.circuitName } : {}),
    ...(day.layout ? { layout: day.layout } : {}),
    ...(day.circuitKnown !== undefined ? { circuitKnown: day.circuitKnown } : {}),
    provider: day.provider,
    description: day.description,
    bookedCount: attendees.filter((attendee) => attendee.status === 'booked').length,
    maybeCount: attendees.filter((attendee) => attendee.status === 'maybe').length,
    attendees,
  };
}

function getMonthStart(value: string | undefined, today: string) {
  return /^\d{4}-\d{2}$/.test(value ?? '') ? `${value}-01` : `${today.slice(0, 7)}-01`;
}

function isDayInMonth(day: AvailableDay, monthStart: string) {
  return day.date.startsWith(monthStart.slice(0, 7));
}

function compareMembers(left: MemberDirectoryEntry, right: MemberDirectoryEntry): number {
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

function compareMemberDateLeaderboardEntries(
  left: MemberDateLeaderboardEntry,
  right: MemberDateLeaderboardEntry,
): number {
  return (
    right.totalCount - left.totalCount ||
    right.raceDayCount - left.raceDayCount ||
    right.testDayCount - left.testDayCount ||
    right.trackDayCount - left.trackDayCount ||
    left.name.localeCompare(right.name)
  );
}

function filterInvitedUsers(users: AuthUserRecord[], invites: MemberInviteAccessRecord[]) {
  const acceptedInviteEmails = new Set(
    invites
      .filter((invite) => invite.status === 'accepted')
      .map((invite) => normalizeMemberAccessEmail(invite.inviteEmail)),
  );

  return users.filter(
    (user) =>
      isAdminUser({ email: user.email, role: user.role ?? 'member' }) ||
      isBootstrapMemberEmail(user.email) ||
      acceptedInviteEmails.has(normalizeMemberAccessEmail(user.email)),
  );
}

async function listMemberSummariesFromUpcomingDays(
  usersWithProfiles: AuthUserRecord[],
  today: string,
  loadDays: LoadGroupCalendarDays = loadUpcomingGroupCalendarDaysDefault,
  loadOverviews: LoadDayAttendanceOverviews = loadDayAttendanceOverviewsDefault,
  loadSummaries: LoadDayAttendanceSummaries = loadDayAttendanceSummariesDefault,
): Promise<MemberDirectoryEntry[]> {
  const days = (await loadDays())
    .filter((day) => day.date >= today)
    .toSorted((left, right) =>
      left.date === right.date
        ? left.circuit.localeCompare(right.circuit)
        : left.date.localeCompare(right.date),
    );
  const dayIds = days.map((day) => day.dayId);
  const overviews = await loadOverviews(dayIds);
  const activeDays = days.filter((day) => (overviews.get(day.dayId)?.attendeeCount ?? 0) > 0);
  const summaries = await loadSummaries(activeDays.map((day) => day.dayId));

  return usersWithProfiles
    .map((user) => summarizeMemberFromDays(user, activeDays, summaries))
    .toSorted(compareMembers);
}

export async function listSiteMembers(
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings?: LoadBookings,
  today = new Date().toISOString().slice(0, 10),
  loadProfiles: LoadMemberProfiles = loadMemberProfilesDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
  loadDays?: LoadGroupCalendarDays,
  loadOverviews?: LoadDayAttendanceOverviews,
  loadSummaries?: LoadDayAttendanceSummaries,
): Promise<MemberDirectoryEntry[]> {
  const [users, profiles, invites] = await Promise.all([
    loadUsers(),
    loadProfiles(),
    loadInvites(),
  ]);
  const usersWithProfiles = applyMemberProfiles(filterInvitedUsers(users, invites), profiles);
  if (!loadBookings) {
    return listMemberSummariesFromUpcomingDays(
      usersWithProfiles,
      today,
      loadDays,
      loadOverviews,
      loadSummaries,
    );
  }

  const members = await Promise.all(
    usersWithProfiles.map(async (user) =>
      summarizeMember(user, await loadBookings(user.id), today),
    ),
  );

  return members.toSorted(compareMembers);
}

export async function listAdminSiteMembers(
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings?: LoadBookings,
  today = new Date().toISOString().slice(0, 10),
  loadProfiles: LoadMemberProfiles = loadMemberProfilesDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
  loadDays?: LoadGroupCalendarDays,
  loadOverviews?: LoadDayAttendanceOverviews,
  loadSummaries?: LoadDayAttendanceSummaries,
): Promise<AdminMemberDirectoryEntry[]> {
  const [users, profiles, invites] = await Promise.all([
    loadUsers(),
    loadProfiles(),
    loadInvites(),
  ]);
  const usersWithProfiles = applyMemberProfiles(filterInvitedUsers(users, invites), profiles);
  if (!loadBookings) {
    const usersById = new Map(usersWithProfiles.map((user) => [user.id, user]));
    return (
      await listMemberSummariesFromUpcomingDays(
        usersWithProfiles,
        today,
        loadDays,
        loadOverviews,
        loadSummaries,
      )
    ).map((member) => {
      const user = usersById.get(member.id);
      return {
        ...member,
        email: user?.email ?? '',
      };
    });
  }

  const members = await Promise.all(
    usersWithProfiles.map(async (user) =>
      summarizeAdminMember(user, await loadBookings(user.id), today),
    ),
  );

  return members.toSorted(compareMembers);
}

export async function listMemberDateLeaderboard(
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings: LoadBookings = loadBookingsDefault,
  loadProfiles: LoadMemberProfiles = loadMemberProfilesDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
): Promise<MemberDateLeaderboardEntry[]> {
  const [users, profiles, invites] = await Promise.all([
    loadUsers(),
    loadProfiles(),
    loadInvites(),
  ]);
  const usersWithProfiles = applyMemberProfiles(filterInvitedUsers(users, invites), profiles);
  const entries = await Promise.all(
    usersWithProfiles.map(async (user) =>
      summarizeMemberDateLeaderboardEntry(user, await loadBookings(user.id)),
    ),
  );

  return entries
    .filter((entry): entry is MemberDateLeaderboardEntry => Boolean(entry))
    .toSorted(compareMemberDateLeaderboardEntries);
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
  const user = filterInvitedUsers(users, invites).find((candidate) => candidate.id === memberId);
  return user ? withMemberProfile(user, profile) : null;
}

export async function getSiteMemberBookedDays(
  memberId: string,
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings: LoadBookings = loadBookingsDefault,
  today = new Date().toISOString().slice(0, 10),
  loadProfile: LoadMemberProfile = loadMemberProfileDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
): Promise<MemberBookedDaysData | null> {
  const member = await getSiteMemberById(memberId, loadUsers, loadProfile, loadInvites);

  if (!member) {
    return null;
  }

  const days = getActiveBookings(await loadBookings(member.id), today)
    .map(toMemberBookedDay)
    .filter((day): day is MemberBookedDay => Boolean(day));

  return {
    member: {
      id: member.id,
      name: member.name,
      image: member.image,
      role: member.role ?? 'member',
    },
    days,
  };
}

export async function listGroupCalendarData(
  optionsOrLoadUsers:
    | {
        month?: string;
        today?: string;
        loadUsers?: () => Promise<AuthUserRecord[]>;
        loadProfiles?: LoadMemberProfiles;
        loadInvites?: LoadMemberInvites;
        loadDays?: LoadGroupCalendarDays;
        loadOverviews?: LoadDayAttendanceOverviews;
        loadSummaries?: LoadDayAttendanceSummaries;
      }
    | (() => Promise<AuthUserRecord[]>) = {},
  loadBookings?: LoadBookings,
  today = new Date().toISOString().slice(0, 10),
  loadProfiles: LoadMemberProfiles = loadMemberProfilesDefault,
  loadInvites: LoadMemberInvites = loadMemberInvitesDefault,
): Promise<GroupCalendarData> {
  if (typeof optionsOrLoadUsers !== 'function') {
    const options = optionsOrLoadUsers;
    const reportToday = options.today ?? today;
    const monthStart = getMonthStart(options.month, reportToday);
    const [users, profiles, invites, days] = await Promise.all([
      (options.loadUsers ?? scanAuthUsers)(),
      (options.loadProfiles ?? loadMemberProfilesDefault)(),
      (options.loadInvites ?? loadMemberInvitesDefault)(),
      (options.loadDays ?? loadUpcomingGroupCalendarDaysDefault)(),
    ]);
    const members = applyMemberProfiles(filterInvitedUsers(users, invites), profiles);
    const membersById = new Map(members.map((member) => [member.id, member]));
    const monthDays = days.filter((day) => isDayInMonth(day, monthStart));
    const overviews = await (options.loadOverviews ?? loadDayAttendanceOverviewsDefault)(
      monthDays.map((day) => day.dayId),
    );
    const activeDays = monthDays.filter((day) => (overviews.get(day.dayId)?.attendeeCount ?? 0) > 0);
    const summaries = await (options.loadSummaries ?? loadDayAttendanceSummariesDefault)(
      activeDays.map((day) => day.dayId),
    );
    const events = activeDays
      .map((day) => {
        const summary = summaries.get(day.dayId);
        return summary ? toGroupCalendarEvent(day, summary, membersById) : null;
      })
      .filter((event): event is GroupCalendarEvent => Boolean(event))
      .toSorted((left, right) =>
        left.date === right.date
          ? left.circuit.localeCompare(right.circuit)
          : left.date.localeCompare(right.date),
      );

    return {
      members: members
        .map(toGroupCalendarMember)
        .toSorted((left, right) => left.name.localeCompare(right.name)),
      events,
      today: reportToday,
      month: monthStart.slice(0, 7),
    };
  }

  const loadUsers = optionsOrLoadUsers;
  const loadBookingsForUser = loadBookings ?? loadBookingsDefault;
  const [users, profiles, invites] = await Promise.all([
    loadUsers(),
    loadProfiles(),
    loadInvites(),
  ]);
  const members = applyMemberProfiles(filterInvitedUsers(users, invites), profiles);
  const events = new Map<string, GroupCalendarEvent>();

  await Promise.all(
    members.map(async (member) => {
      const activeBookings = getActiveBookings(await loadBookingsForUser(member.id), today);

      for (const booking of activeBookings) {
        if (booking.status !== 'booked' && booking.status !== 'maybe') {
          continue;
        }

        const event = ensureGroupCalendarEvent(events, booking);
        const arrivalDateTime = resolveArrivalDateTime(booking);

        event.attendees.push({
          userId: member.id,
          userName: member.name,
          ...(member.image || booking.userImage
            ? { userImage: member.image ?? booking.userImage }
            : {}),
          status: booking.status,
          ...(arrivalDateTime ? { arrivalDateTime } : {}),
          accommodationStatus: resolveAccommodationStatus(booking),
          ...(booking.accommodationName ? { accommodationName: booking.accommodationName } : {}),
        });
      }
    }),
  );

  const calendarEvents = [...events.values()]
    .map((event) => {
      const attendees = event.attendees.toSorted(compareGroupCalendarAttendees);

      return {
        ...event,
        bookedCount: attendees.filter((attendee) => attendee.status === 'booked').length,
        maybeCount: attendees.filter((attendee) => attendee.status === 'maybe').length,
        attendees,
      };
    })
    .toSorted((left, right) =>
      left.date === right.date
        ? left.circuit.localeCompare(right.circuit)
        : left.date.localeCompare(right.date),
    );

  return {
    members: members
      .map(toGroupCalendarMember)
      .toSorted((left, right) => left.name.localeCompare(right.name)),
    events: calendarEvents,
    today,
    month: today.slice(0, 7),
  };
}

export async function submitMemberDayBooking(
  formData: FormData,
  user: User,
  memberId: string,
  loadMemberDays: (
    memberId: string,
  ) => Promise<MemberBookedDaysData | null> = getSiteMemberBookedDays,
  saveBooking: SaveBooking = saveBookingDefault,
): Promise<MemberDayBookingActionResult> {
  const parsed = MemberDayBookingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'This day could not be added right now.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const memberDays = await loadMemberDays(memberId);
  const day = memberDays?.days.find((candidate) => candidate.dayId === parsed.data.dayId);

  if (!memberDays || !day) {
    return {
      ok: false,
      formError: 'This member day is no longer available to add.',
      fieldErrors: {
        dayId: ['This member day is no longer available to add.'],
      },
    };
  }

  await saveBooking(toCreateBookingInput(day, parsed.data.status), user);
  return { ok: true };
}

export async function setAuthUserRole(userId: string, role: User['role']): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SSTResource.AuthTable.name,
      Key: {
        pk: `USER#${userId}`,
        sk: 'USER',
      },
      UpdateExpression: 'SET #role = :role',
      ExpressionAttributeNames: {
        '#role': 'role',
      },
      ExpressionAttributeValues: {
        ':role': role,
      },
    }),
  );
}
