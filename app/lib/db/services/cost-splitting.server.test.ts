import { describe, expect, it, vi } from 'vitest';
import type { BookingRecord } from '../entities/booking.server';
import type { CostExpenseRecord } from '../entities/cost-expense.server';
import type { CostGroupRecord } from '../entities/cost-group.server';
import type { CostSettlementRecord } from '../entities/cost-settlement.server';
import type { MemberPaymentPreferenceRecord } from '../entities/member-payment-preference.server';
import type { BookingPersistence } from './booking.server';
import type {
  CostExpensePersistence,
  CostGroupPersistence,
  CostSettlementPersistence,
} from './cost-splitting.server';

vi.mock('../entities/cost-group.server', () => ({
  CostGroupEntity: {
    create: vi.fn(() => ({ go: vi.fn() })),
    patch: vi.fn(() => ({ set: vi.fn(() => ({ go: vi.fn() })) })),
    delete: vi.fn(() => ({ go: vi.fn() })),
    get: vi.fn(() => ({ go: vi.fn() })),
    query: { byDay: vi.fn(() => ({ go: vi.fn() })) },
  },
}));

vi.mock('../entities/cost-expense.server', () => ({
  CostExpenseEntity: {
    create: vi.fn(() => ({ go: vi.fn() })),
    patch: vi.fn(() => ({ set: vi.fn(() => ({ go: vi.fn() })) })),
    delete: vi.fn(() => ({ go: vi.fn() })),
    get: vi.fn(() => ({ go: vi.fn() })),
    query: {
      byDay: vi.fn(() => ({ go: vi.fn() })),
      byGroup: vi.fn(() => ({ go: vi.fn() })),
    },
  },
}));

vi.mock('../entities/cost-settlement.server', () => ({
  CostSettlementEntity: {
    put: vi.fn(() => ({ go: vi.fn() })),
    get: vi.fn(() => ({ go: vi.fn() })),
    query: { byDay: vi.fn(() => ({ go: vi.fn() })) },
  },
}));

vi.mock('./booking.server', () => ({
  bookingStore: {},
  listAttendanceByDay: vi.fn(),
}));

vi.mock('./member-payment-preference.server', () => ({
  memberPaymentPreferenceStore: {},
  listMemberPaymentPreferencesByUserIds: vi.fn(
    async (
      userIds: string[],
      store: {
        get(userId: string): Promise<MemberPaymentPreferenceRecord | null>;
      },
    ) => {
      const records = await Promise.all(
        userIds.map((userId) => store.get(userId)),
      );
      return new Map(
        records
          .filter((record): record is MemberPaymentPreferenceRecord =>
            Boolean(record),
          )
          .map((record) => [record.userId, record]),
      );
    },
  ),
}));

import {
  createCostGroup,
  loadEventCostSummary,
  updateCostSettlementStatus,
} from './cost-splitting.server';

const participants = [
  {
    bookingId: 'booking-1',
    userId: 'user-1',
    userName: 'Driver One',
    dayId: 'day-1',
    status: 'booked',
  },
  {
    bookingId: 'booking-2',
    userId: 'user-2',
    userName: 'Driver Two',
    dayId: 'day-1',
    status: 'maybe',
  },
  {
    bookingId: 'booking-3',
    userId: 'user-3',
    userName: 'Driver Three',
    dayId: 'day-1',
    status: 'booked',
  },
] as BookingRecord[];

function participantNames(userIds: string[]) {
  return JSON.stringify(
    Object.fromEntries(
      participants
        .filter((participant) => userIds.includes(participant.userId))
        .map((participant) => [participant.userId, participant.userName]),
    ),
  );
}

function createMemory() {
  const groups: CostGroupRecord[] = [
    {
      groupScope: 'cost-group',
      groupId: 'garage',
      dayId: 'day-1',
      name: 'Garage 4',
      category: 'garage',
      participantUserIds: ['user-1', 'user-2'],
      participantNamesJson: participantNames(['user-1', 'user-2']),
      createdByUserId: 'user-1',
      createdByName: 'Driver One',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    },
    {
      groupScope: 'cost-group',
      groupId: 'food',
      dayId: 'day-1',
      name: 'Friday dinner',
      category: 'food',
      participantUserIds: ['user-2', 'user-3'],
      participantNamesJson: participantNames(['user-2', 'user-3']),
      createdByUserId: 'user-2',
      createdByName: 'Driver Two',
      createdAt: '2026-05-01T11:00:00.000Z',
      updatedAt: '2026-05-01T11:00:00.000Z',
    },
  ] as CostGroupRecord[];
  const expenses: CostExpenseRecord[] = [
    {
      expenseScope: 'cost-expense',
      expenseId: 'garage-booking',
      groupId: 'garage',
      dayId: 'day-1',
      title: 'Garage booking',
      amountPence: 10_000,
      currency: 'GBP',
      paidByUserId: 'user-1',
      paidByName: 'Driver One',
      createdByUserId: 'user-1',
      createdByName: 'Driver One',
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
    },
    {
      expenseScope: 'cost-expense',
      expenseId: 'food-bill',
      groupId: 'food',
      dayId: 'day-1',
      title: 'Dinner',
      amountPence: 6_000,
      currency: 'GBP',
      paidByUserId: 'user-3',
      paidByName: 'Driver Three',
      createdByUserId: 'user-3',
      createdByName: 'Driver Three',
      createdAt: '2026-05-01T13:00:00.000Z',
      updatedAt: '2026-05-01T13:00:00.000Z',
    },
  ] as CostExpenseRecord[];
  const settlements = new Map<string, CostSettlementRecord>();
  const groupStore: CostGroupPersistence = {
    create: vi.fn(async (item) => {
      groups.push(item);
      return item;
    }),
    update: vi.fn(async (groupId, changes) => {
      const index = groups.findIndex((group) => group.groupId === groupId);
      groups[index] = { ...groups[index]!, ...changes };
      return groups[index]!;
    }),
    delete: vi.fn(async (groupId) => {
      groups.splice(
        groups.findIndex((group) => group.groupId === groupId),
        1,
      );
    }),
    get: vi.fn(
      async (groupId) =>
        groups.find((group) => group.groupId === groupId) ?? null,
    ),
    listByDay: vi.fn(async (dayId) =>
      groups.filter((group) => group.dayId === dayId),
    ),
    listAll: vi.fn(async () => groups),
  };
  const expenseStore: CostExpensePersistence = {
    create: vi.fn(async (item) => {
      expenses.push(item);
      return item;
    }),
    update: vi.fn(async (expenseId, changes) => {
      const index = expenses.findIndex(
        (expense) => expense.expenseId === expenseId,
      );
      expenses[index] = { ...expenses[index]!, ...changes };
      return expenses[index]!;
    }),
    delete: vi.fn(async (expenseId) => {
      expenses.splice(
        expenses.findIndex((expense) => expense.expenseId === expenseId),
        1,
      );
    }),
    get: vi.fn(
      async (expenseId) =>
        expenses.find((expense) => expense.expenseId === expenseId) ?? null,
    ),
    listByDay: vi.fn(async (dayId) =>
      expenses.filter((expense) => expense.dayId === dayId),
    ),
    listByGroup: vi.fn(async (groupId) =>
      expenses.filter((expense) => expense.groupId === groupId),
    ),
    listAll: vi.fn(async () => expenses),
  };
  const settlementStore: CostSettlementPersistence = {
    put: vi.fn(async (item) => {
      settlements.set(item.settlementId, item);
      return item;
    }),
    get: vi.fn(async (settlementId) => settlements.get(settlementId) ?? null),
    listByDay: vi.fn(async (dayId) =>
      [...settlements.values()].filter(
        (settlement) => settlement.dayId === dayId,
      ),
    ),
    listAll: vi.fn(async () => [...settlements.values()]),
  };
  const bookingStore: BookingPersistence = {
    create: vi.fn(async (item) => item),
    update: vi.fn(async () => participants[0]!),
    delete: vi.fn(async () => undefined),
    listByUser: vi.fn(async () => []),
    findByUserAndDay: vi.fn(async () => null),
    getByUser: vi.fn(async () => null),
    listByDay: vi.fn(async (dayId: string) =>
      participants.filter((participant) => participant.dayId === dayId),
    ),
  };
  const paymentPreferenceStore = {
    put: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(async (userId: string) =>
      userId === 'user-1'
        ? ({
            userId,
            preferenceScope: 'payment-preference',
            label: 'Monzo',
            url: 'https://monzo.me/driver-one',
            createdAt: '2026-05-01T09:00:00.000Z',
            updatedAt: '2026-05-01T09:00:00.000Z',
          } as MemberPaymentPreferenceRecord)
        : null,
    ),
    listAll: vi.fn(async () => []),
  };

  return {
    groups,
    expenses,
    settlements,
    dependencies: {
      bookingStore,
      groupStore,
      expenseStore,
      settlementStore,
      paymentPreferenceStore,
    },
  };
}

describe('cost splitting service', () => {
  it('shows only participant cost groups and nets event balances', async () => {
    const memory = createMemory();

    const summary = await loadEventCostSummary(
      'day-1',
      'user-2',
      null,
      memory.dependencies,
    );

    expect(summary.groups.map((group) => group.groupId)).toEqual([
      'garage',
      'food',
    ]);
    expect(summary.netSettlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          debtorUserId: 'user-2',
          creditorUserId: 'user-1',
          amountPence: 5000,
          status: 'open',
          paymentPreference: {
            label: 'Monzo',
            url: 'https://monzo.me/driver-one',
          },
        }),
        expect.objectContaining({
          debtorUserId: 'user-2',
          creditorUserId: 'user-3',
          amountPence: 3000,
        }),
      ]),
    );

    const userOneSummary = await loadEventCostSummary(
      'day-1',
      'user-1',
      null,
      memory.dependencies,
    );
    expect(userOneSummary.groups.map((group) => group.groupId)).toEqual([
      'garage',
    ]);
  });

  it('stores sent and received settlement status against the current amount', async () => {
    const memory = createMemory();
    const initial = await loadEventCostSummary(
      'day-1',
      'user-2',
      null,
      memory.dependencies,
    );
    const settlement = initial.netSettlements.find(
      (candidate) => candidate.creditorUserId === 'user-1',
    );

    expect(settlement).toBeDefined();
    await updateCostSettlementStatus(
      {
        dayId: 'day-1',
        debtorUserId: 'user-2',
        creditorUserId: 'user-1',
        amountPence: settlement!.amountPence,
        currency: 'GBP',
        breakdownHash: settlement!.breakdownHash,
        status: 'sent',
      },
      {
        id: 'user-2',
        name: 'Driver Two',
      },
      memory.dependencies,
    );

    const sent = await loadEventCostSummary(
      'day-1',
      'user-1',
      null,
      memory.dependencies,
    );
    const sentSettlement = sent.netSettlements.find(
      (candidate) => candidate.debtorUserId === 'user-2',
    );
    expect(sentSettlement?.status).toBe('sent');
    expect(sentSettlement?.canConfirmReceived).toBe(true);

    await updateCostSettlementStatus(
      {
        dayId: 'day-1',
        debtorUserId: 'user-2',
        creditorUserId: 'user-1',
        amountPence: sentSettlement!.amountPence,
        currency: 'GBP',
        breakdownHash: sentSettlement!.breakdownHash,
        status: 'received',
      },
      {
        id: 'user-1',
        name: 'Driver One',
      },
      memory.dependencies,
    );

    const received = await loadEventCostSummary(
      'day-1',
      'user-1',
      null,
      memory.dependencies,
    );
    expect(
      received.netSettlements.find(
        (candidate) => candidate.debtorUserId === 'user-2',
      )?.status,
    ).toBe('received');
  });

  it('does not let a sent update downgrade a received settlement', async () => {
    const memory = createMemory();
    const initial = await loadEventCostSummary(
      'day-1',
      'user-2',
      null,
      memory.dependencies,
    );
    const settlement = initial.netSettlements.find(
      (candidate) => candidate.creditorUserId === 'user-1',
    );

    expect(settlement).toBeDefined();
    await updateCostSettlementStatus(
      {
        dayId: 'day-1',
        debtorUserId: 'user-2',
        creditorUserId: 'user-1',
        amountPence: settlement!.amountPence,
        currency: 'GBP',
        breakdownHash: settlement!.breakdownHash,
        status: 'sent',
      },
      { id: 'user-2', name: 'Driver Two' },
      memory.dependencies,
    );
    const sent = await loadEventCostSummary(
      'day-1',
      'user-1',
      null,
      memory.dependencies,
    );
    const sentSettlement = sent.netSettlements.find(
      (candidate) => candidate.debtorUserId === 'user-2',
    );

    await updateCostSettlementStatus(
      {
        dayId: 'day-1',
        debtorUserId: 'user-2',
        creditorUserId: 'user-1',
        amountPence: sentSettlement!.amountPence,
        currency: 'GBP',
        breakdownHash: sentSettlement!.breakdownHash,
        status: 'received',
      },
      { id: 'user-1', name: 'Driver One' },
      memory.dependencies,
    );

    await expect(
      updateCostSettlementStatus(
        {
          dayId: 'day-1',
          debtorUserId: 'user-2',
          creditorUserId: 'user-1',
          amountPence: sentSettlement!.amountPence,
          currency: 'GBP',
          breakdownHash: sentSettlement!.breakdownHash,
          status: 'sent',
        },
        { id: 'user-2', name: 'Driver Two' },
        memory.dependencies,
      ),
    ).rejects.toMatchObject({
      status: 409,
    });

    const received = await loadEventCostSummary(
      'day-1',
      'user-1',
      null,
      memory.dependencies,
    );
    expect(
      received.netSettlements.find(
        (candidate) => candidate.debtorUserId === 'user-2',
      )?.status,
    ).toBe('received');
  });

  it('requires cost group participants to be attending the day', async () => {
    const memory = createMemory();

    await expect(
      createCostGroup(
        {
          dayId: 'day-1',
          name: 'Hotel room',
          category: 'hotel',
          participantUserIds: ['missing-user'],
        },
        {
          id: 'user-1',
          name: 'Driver One',
        },
        memory.dependencies,
      ),
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});
