import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { User } from './schemas';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SSTResource = Resource as unknown as {
  AuthTable: { name: string };
};

interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
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

export async function listSiteMembers(
  loadUsers: () => Promise<AuthUserRecord[]> = scanAuthUsers,
  loadBookings: (userId: string) => Promise<BookingRecord[]> = async (
    userId,
  ) => {
    const { listMyBookings } = await import('~/lib/db/services/booking.server');
    return listMyBookings(userId);
  },
  today = new Date().toISOString().slice(0, 10),
): Promise<MemberDirectoryEntry[]> {
  const users = await loadUsers();
  const members = await Promise.all(
    users.map(async (user) =>
      summarizeMember(user, await loadBookings(user.id), today),
    ),
  );

  return members.sort(compareMembers);
}
