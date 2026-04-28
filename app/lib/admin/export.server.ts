import { listMemberInvites } from '~/lib/auth/member-invites.server';
import {
  type AdminMemberDirectoryEntry,
  listAdminSiteMembers,
} from '~/lib/auth/members.server';
import { calendarFeedStore } from '~/lib/calendar/feed.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { CalendarFeedRecord } from '~/lib/db/entities/calendar-feed.server';
import type { CircuitAliasRecord } from '~/lib/db/entities/circuit-alias.server';
import type { DayMergeRecord } from '~/lib/db/entities/day-merge.server';
import type { DayPlanRecord } from '~/lib/db/entities/day-plan.server';
import type { ExternalNotificationRecord } from '~/lib/db/entities/external-notification.server';
import type { ManualDayRecord } from '~/lib/db/entities/manual-day.server';
import type { SeriesSubscriptionRecord } from '~/lib/db/entities/series-subscription.server';
import {
  type AvailableDaysSnapshot,
  getAvailableDaysSnapshot,
} from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { listCircuitAliases } from '~/lib/db/services/circuit-alias.server';
import { listDayMerges } from '~/lib/db/services/day-merge.server';
import { dayPlanStore } from '~/lib/db/services/day-plan.server';
import { externalNotificationStore } from '~/lib/db/services/external-notification.server';
import { listManagedManualDays } from '~/lib/db/services/manual-day.server';
import { seriesSubscriptionStore } from '~/lib/db/services/series-subscription.server';

export interface AdminExportDependencies {
  loadMembers?: typeof listAdminSiteMembers;
  loadMemberInvites?: typeof listMemberInvites;
  loadBookings?: typeof listMyBookings;
  loadAvailableDaysSnapshot?: typeof getAvailableDaysSnapshot;
  loadManualDays?: typeof listManagedManualDays;
  loadSharedDayPlans?: typeof dayPlanStore.listAll;
  loadSeriesSubscriptions?: typeof seriesSubscriptionStore.listByUser;
  loadCalendarFeeds?: typeof calendarFeedStore.listByUser;
  loadCircuitAliases?: typeof listCircuitAliases;
  loadDayMerges?: typeof listDayMerges;
  loadExternalNotifications?: typeof externalNotificationStore.listAll;
  now?: Date;
}

export interface AdminCalendarFeedExport
  extends Omit<CalendarFeedRecord, 'token'> {
  hasLegacyPlaintextToken: boolean;
}

export interface AdminDataExport {
  exportVersion: 1;
  exportedAt: string;
  members: AdminMemberDirectoryEntry[];
  memberInvites: Awaited<ReturnType<typeof listMemberInvites>>;
  bookings: BookingRecord[];
  manualDays: ManualDayRecord[];
  sharedDayPlans: DayPlanRecord[];
  seriesSubscriptions: SeriesSubscriptionRecord[];
  calendarFeeds: AdminCalendarFeedExport[];
  availableDaysSnapshot: AvailableDaysSnapshot | null;
  circuitAliases: CircuitAliasRecord[];
  dayMerges: DayMergeRecord[];
  externalNotifications: ExternalNotificationRecord[];
}

export interface AdminDataExportSummary {
  exportedAt: string;
  memberCount: number;
  inviteCount: number;
  bookingCount: number;
  manualDayCount: number;
  sharedPlanCount: number;
  seriesSubscriptionCount: number;
  calendarFeedCount: number;
  availableDayCount: number;
  circuitAliasCount: number;
  dayMergeCount: number;
  externalNotificationCount: number;
}

function redactCalendarFeedToken(
  feed: CalendarFeedRecord,
): AdminCalendarFeedExport {
  const { token, ...safeFeed } = feed;
  return {
    ...safeFeed,
    hasLegacyPlaintextToken: Boolean(token),
  };
}

export async function createAdminDataExport(
  dependencies: AdminExportDependencies = {},
): Promise<AdminDataExport> {
  const loadMembers = dependencies.loadMembers ?? listAdminSiteMembers;
  const loadMemberInvites = dependencies.loadMemberInvites ?? listMemberInvites;
  const loadBookings = dependencies.loadBookings ?? listMyBookings;
  const loadAvailableDaysSnapshot =
    dependencies.loadAvailableDaysSnapshot ?? getAvailableDaysSnapshot;
  const loadManualDays = dependencies.loadManualDays ?? listManagedManualDays;
  const loadSharedDayPlans =
    dependencies.loadSharedDayPlans ?? dayPlanStore.listAll;
  const loadSeriesSubscriptions =
    dependencies.loadSeriesSubscriptions ?? seriesSubscriptionStore.listByUser;
  const loadCalendarFeeds =
    dependencies.loadCalendarFeeds ?? calendarFeedStore.listByUser;
  const loadCircuitAliasRecords =
    dependencies.loadCircuitAliases ?? listCircuitAliases;
  const loadDayMergeRecords = dependencies.loadDayMerges ?? listDayMerges;
  const loadExternalNotificationRecords =
    dependencies.loadExternalNotifications ?? externalNotificationStore.listAll;
  const exportedAt = (dependencies.now ?? new Date()).toISOString();
  const [
    members,
    memberInvites,
    availableDaysSnapshot,
    manualDays,
    dayPlans,
    circuitAliases,
    dayMerges,
    externalNotifications,
  ] = await Promise.all([
    loadMembers(),
    loadMemberInvites(),
    loadAvailableDaysSnapshot(),
    loadManualDays(),
    loadSharedDayPlans(),
    loadCircuitAliasRecords(),
    loadDayMergeRecords(),
    loadExternalNotificationRecords(),
  ]);
  const [bookingsByMember, subscriptionsByMember, feedsByMember] =
    await Promise.all([
      Promise.all(members.map((member) => loadBookings(member.id))),
      Promise.all(members.map((member) => loadSeriesSubscriptions(member.id))),
      Promise.all(members.map((member) => loadCalendarFeeds(member.id))),
    ]);

  return {
    exportVersion: 1,
    exportedAt,
    members,
    memberInvites,
    bookings: bookingsByMember.flat(),
    manualDays,
    sharedDayPlans: dayPlans,
    seriesSubscriptions: subscriptionsByMember.flat(),
    calendarFeeds: feedsByMember.flat().map(redactCalendarFeedToken),
    availableDaysSnapshot,
    circuitAliases,
    dayMerges,
    externalNotifications,
  };
}

export function summarizeAdminDataExport(
  dataExport: AdminDataExport,
): AdminDataExportSummary {
  return {
    exportedAt: dataExport.exportedAt,
    memberCount: dataExport.members.length,
    inviteCount: dataExport.memberInvites.length,
    bookingCount: dataExport.bookings.length,
    manualDayCount: dataExport.manualDays.length,
    sharedPlanCount: dataExport.sharedDayPlans.length,
    seriesSubscriptionCount: dataExport.seriesSubscriptions.length,
    calendarFeedCount: dataExport.calendarFeeds.length,
    availableDayCount: dataExport.availableDaysSnapshot?.days.length ?? 0,
    circuitAliasCount: dataExport.circuitAliases.length,
    dayMergeCount: dataExport.dayMerges.length,
    externalNotificationCount: dataExport.externalNotifications.length,
  };
}
