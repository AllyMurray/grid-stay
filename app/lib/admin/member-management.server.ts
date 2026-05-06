import { z } from 'zod';
import { type AuthUserRecord, getSiteMemberById, setAuthUserRole } from '~/lib/auth/members.server';
import type { User } from '~/lib/auth/schemas';
import { type AccommodationStatus, resolveAccommodationStatus } from '~/lib/bookings/accommodation';
import { USER_ROLE_VALUES } from '~/lib/constants/enums';
import {
  getLinkedSeriesKey,
  getLinkedSeriesName,
  getRaceSeriesDaysForDay,
} from '~/lib/days/series.server';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { SeriesSubscriptionRecord } from '~/lib/db/entities/series-subscription.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { ensureBookingsForDays, listMyBookings } from '~/lib/db/services/booking.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { setMemberDisplayName } from '~/lib/db/services/member-profile.server';
import {
  seriesSubscriptionStore,
  upsertSeriesSubscription,
} from '~/lib/db/services/series-subscription.server';

const AdminMemberDisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, 'Display name must be 80 characters or fewer.')
    .optional()
    .default(''),
});

const AdminMemberSeriesSchema = z.object({
  seriesKey: z.string().trim().min(1),
  status: z.enum(['booked', 'maybe']),
});

const AdminMemberSeriesKeySchema = z.object({
  seriesKey: z.string().trim().min(1),
});

const AdminMemberRoleSchema = z.object({
  role: z.enum(USER_ROLE_VALUES),
});

type FieldErrors<T extends string> = Partial<Record<T, string[] | undefined>>;

export interface AdminSeriesOption {
  seriesKey: string;
  seriesName: string;
  dayCount: number;
}

export interface AdminMemberBooking {
  bookingId: string;
  dayId: string;
  date: string;
  status: BookingRecord['status'];
  circuit: string;
  provider: string;
  description: string;
  accommodationStatus?: AccommodationStatus;
  accommodationName?: string;
}

export interface AdminMemberProfile {
  id: string;
  email: string;
  name: string;
  authName: string;
  displayName?: string;
  picture?: string;
  role: User['role'];
  bookings: AdminMemberBooking[];
  subscriptions: SeriesSubscriptionRecord[];
}

type AdminMemberActionField = 'displayName' | 'seriesKey' | 'status' | 'role';

export type AdminMemberActionResult =
  | {
      ok: true;
      message: string;
      addedCount?: number;
      existingCount?: number;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: FieldErrors<AdminMemberActionField>;
    };

export type AdminMemberSeriesActionResult = AdminMemberActionResult;

export interface AdminMemberProfileDependencies {
  loadMember?: typeof getSiteMemberById;
  loadBookings?: (userId: string) => Promise<BookingRecord[]>;
  loadSubscriptions?: (userId: string) => Promise<SeriesSubscriptionRecord[]>;
  today?: string;
}

export interface AdminMemberActionDependencies {
  loadMember?: typeof getSiteMemberById;
  loadSnapshot?: typeof getAvailableDaysSnapshot;
  loadManualDays?: typeof listManualDays;
  saveBookings?: typeof ensureBookingsForDays;
  saveDisplayName?: typeof setMemberDisplayName;
  saveRole?: typeof setAuthUserRole;
  saveSubscription?: typeof upsertSeriesSubscription;
  updateSubscription?: (
    userId: string,
    seriesKey: string,
    changes: Partial<SeriesSubscriptionRecord>,
  ) => Promise<SeriesSubscriptionRecord>;
  deleteSubscription?: (userId: string, seriesKey: string) => Promise<void>;
}

function sortBookings(left: BookingRecord, right: BookingRecord) {
  if (left.status === 'cancelled' && right.status !== 'cancelled') {
    return 1;
  }

  if (right.status === 'cancelled' && left.status !== 'cancelled') {
    return -1;
  }

  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  return left.circuit.localeCompare(right.circuit);
}

function sortSubscriptions(left: SeriesSubscriptionRecord, right: SeriesSubscriptionRecord) {
  return left.seriesName.localeCompare(right.seriesName);
}

function toAdminMemberBooking(booking: BookingRecord): AdminMemberBooking {
  return {
    bookingId: booking.bookingId,
    dayId: booking.dayId,
    date: booking.date,
    status: booking.status,
    circuit: booking.circuit,
    provider: booking.provider,
    description: booking.description,
    accommodationStatus: resolveAccommodationStatus(booking),
    accommodationName: booking.accommodationName,
  };
}

function toUser(member: AuthUserRecord): User {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    picture: member.image,
    role: member.role ?? 'member',
  };
}

function formError(
  message: string,
  fieldErrors: FieldErrors<AdminMemberActionField> = {},
): AdminMemberActionResult {
  return {
    ok: false,
    formError: message,
    fieldErrors,
  };
}

function findSeriesDays(days: AvailableDay[], seriesKey: string) {
  const selectedDay = days.find((day) => getLinkedSeriesKey(day) === seriesKey);
  if (!selectedDay) {
    return null;
  }

  return getRaceSeriesDaysForDay(days, selectedDay.dayId);
}

async function loadAvailableAndManualDays(
  loadSnapshot: typeof getAvailableDaysSnapshot,
  loadManual: typeof listManualDays,
) {
  const [snapshot, manualDays] = await Promise.all([loadSnapshot(), loadManual()]);

  return [...(snapshot?.days ?? []), ...manualDays];
}

export function buildAdminSeriesOptions(days: AvailableDay[]): AdminSeriesOption[] {
  const seriesByKey = new Map<string, AdminSeriesOption>();

  for (const day of days) {
    const seriesKey = getLinkedSeriesKey(day);
    const seriesName = getLinkedSeriesName(day);

    if (!seriesKey || !seriesName) {
      continue;
    }

    const current = seriesByKey.get(seriesKey);
    if (current) {
      current.dayCount += 1;
      continue;
    }

    seriesByKey.set(seriesKey, {
      seriesKey,
      seriesName,
      dayCount: 1,
    });
  }

  return [...seriesByKey.values()].toSorted((left, right) =>
    left.seriesName.localeCompare(right.seriesName),
  );
}

export async function getAdminMemberProfile(
  memberId: string,
  dependencies: AdminMemberProfileDependencies = {},
): Promise<AdminMemberProfile> {
  const loadMember = dependencies.loadMember ?? getSiteMemberById;
  const loadBookings = dependencies.loadBookings ?? listMyBookings;
  const loadSubscriptions =
    dependencies.loadSubscriptions ??
    ((userId: string) => seriesSubscriptionStore.listByUser(userId));
  const today = dependencies.today ?? new Date().toISOString().slice(0, 10);
  const member = await loadMember(memberId);

  if (!member) {
    throw new Response('Member not found', { status: 404 });
  }

  const [bookings, subscriptions] = await Promise.all([
    loadBookings(member.id),
    loadSubscriptions(member.id),
  ]);

  return {
    id: member.id,
    email: member.email,
    name: member.name,
    authName: member.authName ?? member.name,
    displayName: member.displayName,
    picture: member.image,
    role: member.role ?? 'member',
    bookings: bookings
      .filter((booking) => booking.date >= today)
      .toSorted(sortBookings)
      .map(toAdminMemberBooking),
    subscriptions: subscriptions.toSorted(sortSubscriptions),
  };
}

export async function submitAdminMemberAction(
  formData: FormData,
  memberId: string,
  adminUser: Pick<User, 'id'>,
  dependencies: AdminMemberActionDependencies = {},
): Promise<AdminMemberActionResult> {
  const intent = formData.get('intent');
  const loadMember = dependencies.loadMember ?? getSiteMemberById;
  const member = await loadMember(memberId);

  if (!member) {
    return formError('This member could not be found.');
  }

  if (intent === 'updateDisplayName') {
    const parsed = AdminMemberDisplayNameSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return formError('Could not update this display name.', parsed.error.flatten().fieldErrors);
    }

    await (dependencies.saveDisplayName ?? setMemberDisplayName)({
      userId: member.id,
      displayName: parsed.data.displayName,
      updatedByUserId: adminUser.id,
    });

    return {
      ok: true,
      message: parsed.data.displayName
        ? 'Display name updated.'
        : 'Display name reset to Google name.',
    };
  }

  if (intent === 'updateRole') {
    const parsed = AdminMemberRoleSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return formError('Could not update this member role.', parsed.error.flatten().fieldErrors);
    }

    if (member.id === adminUser.id && parsed.data.role !== member.role) {
      return formError('You cannot change your own role from this screen.', {
        role: ['Ask another owner or admin to change your role.'],
      });
    }

    await (dependencies.saveRole ?? setAuthUserRole)(member.id, parsed.data.role);

    return {
      ok: true,
      message: 'Member role updated.',
    };
  }

  if (intent === 'removeSeries') {
    const parsed = AdminMemberSeriesKeySchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return formError(
        'Could not remove this series subscription.',
        parsed.error.flatten().fieldErrors,
      );
    }

    await (dependencies.deleteSubscription ?? seriesSubscriptionStore.delete)(
      member.id,
      parsed.data.seriesKey,
    );

    return {
      ok: true,
      message: 'Series subscription removed.',
    };
  }

  const parsed = AdminMemberSeriesSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError(
      intent === 'updateSeries'
        ? 'Could not update this series subscription.'
        : 'Could not add this member to the series.',
      parsed.error.flatten().fieldErrors,
    );
  }

  if (intent === 'updateSeries') {
    await (dependencies.updateSubscription ?? seriesSubscriptionStore.update)(
      member.id,
      parsed.data.seriesKey,
      {
        status: parsed.data.status,
        updatedAt: new Date().toISOString(),
      },
    );

    return {
      ok: true,
      message: 'Series subscription updated.',
    };
  }

  if (intent !== 'addSeries') {
    return formError('This member action is not supported.');
  }

  const days = await loadAvailableAndManualDays(
    dependencies.loadSnapshot ?? getAvailableDaysSnapshot,
    dependencies.loadManualDays ?? listManualDays,
  );
  const series = findSeriesDays(days, parsed.data.seriesKey);

  if (!series || series.days.length === 0) {
    return formError('This series is not available in the calendar yet.');
  }

  const user = toUser(member);
  const result = await (dependencies.saveBookings ?? ensureBookingsForDays)(
    series.days.map((day) => ({
      dayId: day.dayId,
      date: day.date,
      type: day.type,
      circuit: day.circuit,
      circuitId: day.circuitId,
      circuitName: day.circuitName,
      layout: day.layout,
      circuitKnown: day.circuitKnown,
      provider: day.provider,
      description: day.description,
      status: parsed.data.status,
    })),
    parsed.data.status,
    user,
  );

  await (dependencies.saveSubscription ?? upsertSeriesSubscription)({
    userId: member.id,
    seriesKey: series.seriesKey,
    seriesName: series.seriesName,
    status: parsed.data.status,
  });

  return {
    ok: true,
    message: `${series.seriesName} added to ${member.name}.`,
    addedCount: result.addedCount,
    existingCount: result.existingCount,
  };
}

export async function submitAdminMemberSeriesAction(
  formData: FormData,
  memberId: string,
  dependencies: AdminMemberActionDependencies = {},
): Promise<AdminMemberActionResult> {
  return submitAdminMemberAction(formData, memberId, { id: 'system' }, dependencies);
}
