import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('~/lib/auth/member-invites.server', () => ({
  listMemberInvites: vi.fn(),
}));
vi.mock('~/lib/auth/members.server', () => ({
  listAdminSiteMembers: vi.fn(),
}));
vi.mock('~/lib/calendar/feed.server', () => ({
  calendarFeedStore: {
    listByUser: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));
vi.mock('~/lib/db/services/booking.server', () => ({
  listMyBookings: vi.fn(),
}));
vi.mock('~/lib/db/services/circuit-alias.server', () => ({
  listCircuitAliases: vi.fn(),
}));
vi.mock('~/lib/db/services/cost-splitting.server', () => ({
  costExpenseStore: {
    listAll: vi.fn(),
  },
  costGroupStore: {
    listAll: vi.fn(),
  },
  costSettlementStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/day-plan.server', () => ({
  dayPlanStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/day-merge.server', () => ({
  listDayMerges: vi.fn(),
}));
vi.mock('~/lib/db/services/external-notification.server', () => ({
  externalNotificationStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/feedback.server', () => ({
  feedbackStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/garage-share-request.server', () => ({
  garageShareRequestStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManagedManualDays: vi.fn(),
}));
vi.mock('~/lib/db/services/member-payment-preference.server', () => ({
  memberPaymentPreferenceStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/series-subscription.server', () => ({
  seriesSubscriptionStore: {
    listByUser: vi.fn(),
  },
}));
vi.mock('~/lib/db/services/whats-new-view.server', () => ({
  whatsNewViewStore: {
    listAll: vi.fn(),
  },
}));
vi.mock('~/lib/db/entities/booking.server', () => ({
  BookingEntity: {},
}));
vi.mock('~/lib/db/entities/calendar-feed.server', () => ({
  CalendarFeedEntity: {},
}));
vi.mock('~/lib/db/entities/circuit-alias.server', () => ({
  CircuitAliasEntity: {},
}));
vi.mock('~/lib/db/entities/cost-expense.server', () => ({
  CostExpenseEntity: {},
}));
vi.mock('~/lib/db/entities/cost-group.server', () => ({
  CostGroupEntity: {},
}));
vi.mock('~/lib/db/entities/cost-settlement.server', () => ({
  CostSettlementEntity: {},
}));
vi.mock('~/lib/db/entities/day-merge.server', () => ({
  DayMergeEntity: {},
}));
vi.mock('~/lib/db/entities/day-plan.server', () => ({
  DayPlanEntity: {},
}));
vi.mock('~/lib/db/entities/external-notification.server', () => ({
  ExternalNotificationEntity: {},
}));
vi.mock('~/lib/db/entities/feedback.server', () => ({
  FeedbackEntity: {},
}));
vi.mock('~/lib/db/entities/garage-share-request.server', () => ({
  GarageShareRequestEntity: {},
}));
vi.mock('~/lib/db/entities/manual-day.server', () => ({
  ManualDayEntity: {},
}));
vi.mock('~/lib/db/entities/member-invite.server', () => ({
  MemberInviteEntity: {},
}));
vi.mock('~/lib/db/entities/member-payment-preference.server', () => ({
  MemberPaymentPreferenceEntity: {},
}));
vi.mock('~/lib/db/entities/series-subscription.server', () => ({
  SeriesSubscriptionEntity: {},
}));
vi.mock('~/lib/db/entities/whats-new-view.server', () => ({
  WhatsNewViewEntity: {},
}));

import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { CalendarFeedRecord } from '~/lib/db/entities/calendar-feed.server';
import { createAdminDataExport, summarizeAdminDataExport } from './export.server';

describe('admin data export', () => {
  it('collects production data and redacts calendar feed tokens', async () => {
    const booking = {
      bookingId: 'day-1',
      userId: 'user-1',
      userName: 'Driver One',
      dayId: 'day-1',
      date: '2026-05-01',
      status: 'booked',
      circuit: 'Silverstone',
      provider: 'MSV',
      description: 'Testing',
      bookingReference: 'PRIVATE-BOOKING',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as BookingRecord;
    const feed = {
      tokenHash: 'hash-1',
      token: 'plain-token',
      tokenHint: 'in-token',
      feedScope: 'schedule',
      userId: 'user-1',
      includeMaybe: true,
      includeStay: true,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as CalendarFeedRecord;

    const dataExport = await createAdminDataExport({
      now: new Date('2026-04-27T10:00:00.000Z'),
      loadMembers: async () => [
        {
          id: 'user-1',
          name: 'Driver One',
          email: 'driver@example.com',
          role: 'member',
          activeTripsCount: 1,
          sharedStayCount: 0,
          nextTrip: undefined,
        },
      ],
      loadMemberInvites: async () => [],
      loadBookings: async () => [booking],
      loadAvailableDaysSnapshot: async () => ({
        refreshedAt: '2026-04-27T09:00:00.000Z',
        days: [],
        errors: [],
      }),
      loadManualDays: async () => [],
      loadSharedDayPlans: async () => [],
      loadSeriesSubscriptions: async () => [],
      loadCalendarFeeds: async () => [feed],
      loadCircuitAliases: async () => [
        {
          aliasKey: 'snetterton-300',
          aliasScope: 'circuit-alias',
          rawCircuit: 'Sntterton 300',
          canonicalCircuit: 'Snetterton',
          createdByUserId: 'admin-1',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadDayMerges: async () => [
        {
          sourceDayId: 'source-day',
          targetDayId: 'target-day',
          mergeScope: 'day-merge',
          createdByUserId: 'admin-1',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadExternalNotifications: async () => [
        {
          notificationId: 'notification-1',
          notificationScope: 'external',
          channel: 'email',
          category: 'admin_alert',
          status: 'pending',
          recipientName: 'Admin One',
          recipientAddress: 'admin@example.com',
          subject: 'Error',
          body: 'Error',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadGarageShareRequests: async () => [
        {
          requestScope: 'garage-share-request',
          requestId: 'garage-request-1',
          dayId: 'day-1',
          date: '2026-05-01',
          circuit: 'Silverstone',
          provider: 'MSV',
          description: 'Testing',
          garageBookingId: 'day-1',
          garageOwnerUserId: 'user-1',
          garageOwnerName: 'Driver One',
          requesterUserId: 'user-2',
          requesterName: 'Driver Two',
          requesterBookingId: 'day-1',
          status: 'pending',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadFeedback: async () => [
        {
          feedbackId: 'feedback-1',
          feedbackScope: 'feedback',
          userId: 'user-1',
          userName: 'Driver One',
          userEmail: 'driver@example.com',
          type: 'feature_request',
          status: 'new',
          title: 'Make filtering easier',
          message: 'Please add saved filters to the schedule.',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadCostGroups: async () => [
        {
          groupScope: 'cost-group',
          groupId: 'group-1',
          dayId: 'day-1',
          name: 'Garage',
          category: 'garage',
          participantUserIds: ['user-1', 'user-2'],
          participantNamesJson: '{"user-1":"Driver One","user-2":"Driver Two"}',
          createdByUserId: 'user-1',
          createdByName: 'Driver One',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadCostExpenses: async () => [
        {
          expenseScope: 'cost-expense',
          expenseId: 'expense-1',
          groupId: 'group-1',
          dayId: 'day-1',
          title: 'Garage booking',
          amountPence: 12000,
          currency: 'GBP',
          paidByUserId: 'user-1',
          paidByName: 'Driver One',
          createdByUserId: 'user-1',
          createdByName: 'Driver One',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadCostSettlements: async () => [
        {
          settlementScope: 'cost-settlement',
          settlementId: 'day-1#user-2#user-1#GBP',
          dayId: 'day-1',
          debtorUserId: 'user-2',
          creditorUserId: 'user-1',
          amountPence: 6000,
          currency: 'GBP',
          breakdownHash: 'hash-1',
          status: 'sent',
          updatedByUserId: 'user-2',
          updatedByName: 'Driver Two',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadMemberPaymentPreferences: async () => [
        {
          userId: 'user-1',
          preferenceScope: 'payment-preference',
          label: 'Monzo',
          url: 'https://monzo.me/driver-one',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      ],
      loadWhatsNewViews: async () => [
        {
          userId: 'user-1',
          viewScope: 'whats-new',
          lastViewedAt: '2026-05-03T12:00:00.000Z',
          createdAt: '2026-05-03T12:00:00.000Z',
          updatedAt: '2026-05-03T12:00:00.000Z',
        },
      ],
    });

    expect(dataExport.exportVersion).toBe(7);
    expect(dataExport.exportedAt).toBe('2026-04-27T10:00:00.000Z');
    expect(dataExport.bookings).toEqual([booking]);
    expect(dataExport.costGroups).toEqual([expect.objectContaining({ groupId: 'group-1' })]);
    expect(dataExport.costExpenses).toEqual([expect.objectContaining({ expenseId: 'expense-1' })]);
    expect(dataExport.costSettlements).toEqual([
      expect.objectContaining({ settlementId: 'day-1#user-2#user-1#GBP' }),
    ]);
    expect(dataExport.memberPaymentPreferences).toEqual([
      expect.objectContaining({ userId: 'user-1', label: 'Monzo' }),
    ]);
    expect(dataExport.whatsNewViews).toEqual([
      expect.objectContaining({
        userId: 'user-1',
        lastViewedAt: '2026-05-03T12:00:00.000Z',
      }),
    ]);
    expect(dataExport.calendarFeeds).toEqual([
      expect.objectContaining({
        tokenHash: 'hash-1',
        tokenHint: 'in-token',
        hasLegacyPlaintextToken: true,
      }),
    ]);
    expect(JSON.stringify(dataExport.calendarFeeds)).not.toContain('plain-token');
    expect(summarizeAdminDataExport(dataExport)).toMatchObject({
      memberCount: 1,
      bookingCount: 1,
      calendarFeedCount: 1,
      circuitAliasCount: 1,
      dayMergeCount: 1,
      externalNotificationCount: 1,
      garageShareRequestCount: 1,
      feedbackCount: 1,
      costGroupCount: 1,
      costExpenseCount: 1,
      costSettlementCount: 1,
      memberPaymentPreferenceCount: 1,
      whatsNewViewCount: 1,
    });
  });
});
