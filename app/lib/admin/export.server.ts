import { listMemberInvites } from '~/lib/auth/member-invites.server';
import {
  type AdminMemberDirectoryEntry,
  listAdminSiteMembers,
} from '~/lib/auth/members.server';
import { calendarFeedStore } from '~/lib/calendar/feed.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { CalendarFeedRecord } from '~/lib/db/entities/calendar-feed.server';
import type { CircuitAliasRecord } from '~/lib/db/entities/circuit-alias.server';
import type { CostExpenseRecord } from '~/lib/db/entities/cost-expense.server';
import type { CostGroupRecord } from '~/lib/db/entities/cost-group.server';
import type { CostSettlementRecord } from '~/lib/db/entities/cost-settlement.server';
import type { DayMergeRecord } from '~/lib/db/entities/day-merge.server';
import type { DayPlanRecord } from '~/lib/db/entities/day-plan.server';
import type { ExternalNotificationRecord } from '~/lib/db/entities/external-notification.server';
import type { FeedbackRecord } from '~/lib/db/entities/feedback.server';
import type { GarageShareRequestRecord } from '~/lib/db/entities/garage-share-request.server';
import type { ManualDayRecord } from '~/lib/db/entities/manual-day.server';
import type { MemberPaymentPreferenceRecord } from '~/lib/db/entities/member-payment-preference.server';
import type { SeriesSubscriptionRecord } from '~/lib/db/entities/series-subscription.server';
import type { WhatsNewViewRecord } from '~/lib/db/entities/whats-new-view.server';
import {
  type AvailableDaysSnapshot,
  getAvailableDaysSnapshot,
} from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { listCircuitAliases } from '~/lib/db/services/circuit-alias.server';
import {
  costExpenseStore,
  costGroupStore,
  costSettlementStore,
} from '~/lib/db/services/cost-splitting.server';
import { listDayMerges } from '~/lib/db/services/day-merge.server';
import { dayPlanStore } from '~/lib/db/services/day-plan.server';
import { externalNotificationStore } from '~/lib/db/services/external-notification.server';
import { feedbackStore } from '~/lib/db/services/feedback.server';
import { garageShareRequestStore } from '~/lib/db/services/garage-share-request.server';
import { listManagedManualDays } from '~/lib/db/services/manual-day.server';
import { memberPaymentPreferenceStore } from '~/lib/db/services/member-payment-preference.server';
import { seriesSubscriptionStore } from '~/lib/db/services/series-subscription.server';
import { whatsNewViewStore } from '~/lib/db/services/whats-new-view.server';

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
  loadFeedback?: typeof feedbackStore.listAll;
  loadGarageShareRequests?: typeof garageShareRequestStore.listAll;
  loadCostGroups?: typeof costGroupStore.listAll;
  loadCostExpenses?: typeof costExpenseStore.listAll;
  loadCostSettlements?: typeof costSettlementStore.listAll;
  loadMemberPaymentPreferences?: typeof memberPaymentPreferenceStore.listAll;
  loadWhatsNewViews?: typeof whatsNewViewStore.listAll;
  now?: Date;
}

export interface AdminCalendarFeedExport
  extends Omit<CalendarFeedRecord, 'token'> {
  hasLegacyPlaintextToken: boolean;
}

export interface AdminDataExport {
  exportVersion: 5;
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
  garageShareRequests: GarageShareRequestRecord[];
  feedback: FeedbackRecord[];
  costGroups: CostGroupRecord[];
  costExpenses: CostExpenseRecord[];
  costSettlements: CostSettlementRecord[];
  memberPaymentPreferences: MemberPaymentPreferenceRecord[];
  whatsNewViews: WhatsNewViewRecord[];
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
  garageShareRequestCount: number;
  feedbackCount: number;
  costGroupCount: number;
  costExpenseCount: number;
  costSettlementCount: number;
  memberPaymentPreferenceCount: number;
  whatsNewViewCount: number;
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
  const loadFeedbackRecords =
    dependencies.loadFeedback ?? feedbackStore.listAll;
  const loadGarageShareRequestRecords =
    dependencies.loadGarageShareRequests ?? garageShareRequestStore.listAll;
  const loadCostGroupRecords =
    dependencies.loadCostGroups ?? costGroupStore.listAll;
  const loadCostExpenseRecords =
    dependencies.loadCostExpenses ?? costExpenseStore.listAll;
  const loadCostSettlementRecords =
    dependencies.loadCostSettlements ?? costSettlementStore.listAll;
  const loadMemberPaymentPreferenceRecords =
    dependencies.loadMemberPaymentPreferences ??
    memberPaymentPreferenceStore.listAll;
  const loadWhatsNewViewRecords =
    dependencies.loadWhatsNewViews ?? whatsNewViewStore.listAll;
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
    garageShareRequests,
    feedback,
    costGroups,
    costExpenses,
    costSettlements,
    memberPaymentPreferences,
    whatsNewViews,
  ] = await Promise.all([
    loadMembers(),
    loadMemberInvites(),
    loadAvailableDaysSnapshot(),
    loadManualDays(),
    loadSharedDayPlans(),
    loadCircuitAliasRecords(),
    loadDayMergeRecords(),
    loadExternalNotificationRecords(),
    loadGarageShareRequestRecords(),
    loadFeedbackRecords(),
    loadCostGroupRecords(),
    loadCostExpenseRecords(),
    loadCostSettlementRecords(),
    loadMemberPaymentPreferenceRecords(),
    loadWhatsNewViewRecords(),
  ]);
  const [bookingsByMember, subscriptionsByMember, feedsByMember] =
    await Promise.all([
      Promise.all(members.map((member) => loadBookings(member.id))),
      Promise.all(members.map((member) => loadSeriesSubscriptions(member.id))),
      Promise.all(members.map((member) => loadCalendarFeeds(member.id))),
    ]);

  return {
    exportVersion: 5,
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
    garageShareRequests,
    feedback,
    costGroups,
    costExpenses,
    costSettlements,
    memberPaymentPreferences,
    whatsNewViews,
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
    garageShareRequestCount: dataExport.garageShareRequests.length,
    feedbackCount: dataExport.feedback.length,
    costGroupCount: dataExport.costGroups.length,
    costExpenseCount: dataExport.costExpenses.length,
    costSettlementCount: dataExport.costSettlements.length,
    memberPaymentPreferenceCount: dataExport.memberPaymentPreferences.length,
    whatsNewViewCount: dataExport.whatsNewViews.length,
  };
}
