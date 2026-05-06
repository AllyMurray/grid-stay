import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import type { DayAttendanceSummary } from '~/lib/days/types';
import type {
  CostExpenseDeleteInput,
  CostExpenseUpsertInput,
  CostGroupDeleteInput,
  CostGroupUpsertInput,
  CostSettlementStatusInput,
} from '~/lib/schemas/cost-splitting';
import { CostExpenseEntity, type CostExpenseRecord } from '../entities/cost-expense.server';
import { CostGroupEntity, type CostGroupRecord } from '../entities/cost-group.server';
import {
  CostSettlementEntity,
  type CostSettlementRecord,
} from '../entities/cost-settlement.server';
import { type BookingPersistence, bookingStore } from './booking.server';
import {
  listMemberPaymentPreferencesByUserIds,
  type MemberPaymentPreferencePersistence,
  memberPaymentPreferenceStore,
} from './member-payment-preference.server';

export const COST_GROUP_SCOPE = 'cost-group';
export const COST_EXPENSE_SCOPE = 'cost-expense';
export const COST_SETTLEMENT_SCOPE = 'cost-settlement';
export const COST_CURRENCY = 'GBP';

export interface CostParticipant {
  userId: string;
  userName: string;
}

export interface CostExpenseSummary {
  expenseId: string;
  groupId: string;
  dayId: string;
  title: string;
  amountPence: number;
  currency: 'GBP';
  paidByUserId: string;
  paidByName: string;
  notes?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface CostGroupSummary {
  groupId: string;
  dayId: string;
  name: string;
  category: CostGroupRecord['category'];
  participants: CostParticipant[];
  totalPence: number;
  currency: 'GBP';
  expenses: CostExpenseSummary[];
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface CostSettlementBreakdown {
  groupId: string;
  groupName: string;
  debtorSharePence: number;
  creditorSharePence: number;
}

export type CostSettlementStatus = 'open' | 'sent' | 'received';

export interface NetCostSettlement {
  settlementId: string;
  dayId: string;
  debtorUserId: string;
  debtorName: string;
  creditorUserId: string;
  creditorName: string;
  amountPence: number;
  currency: 'GBP';
  status: CostSettlementStatus;
  breakdownHash: string;
  breakdown: CostSettlementBreakdown[];
  paymentPreference?: {
    label: string;
    url: string;
  };
  canMarkSent: boolean;
  canConfirmReceived: boolean;
}

export interface EventCostSummary {
  dayId: string;
  currency: 'GBP';
  availableParticipants: CostParticipant[];
  groups: CostGroupSummary[];
  netSettlements: NetCostSettlement[];
  totalPence: number;
}

export interface CostGroupPersistence {
  create(item: CostGroupRecord): Promise<CostGroupRecord>;
  update(groupId: string, changes: Partial<CostGroupRecord>): Promise<CostGroupRecord>;
  delete(groupId: string): Promise<void>;
  get(groupId: string): Promise<CostGroupRecord | null>;
  listByDay(dayId: string): Promise<CostGroupRecord[]>;
  listAll(): Promise<CostGroupRecord[]>;
}

export interface CostExpensePersistence {
  create(item: CostExpenseRecord): Promise<CostExpenseRecord>;
  update(expenseId: string, changes: Partial<CostExpenseRecord>): Promise<CostExpenseRecord>;
  delete(expenseId: string): Promise<void>;
  get(expenseId: string): Promise<CostExpenseRecord | null>;
  listByDay(dayId: string): Promise<CostExpenseRecord[]>;
  listByGroup(groupId: string): Promise<CostExpenseRecord[]>;
  listAll(): Promise<CostExpenseRecord[]>;
}

export interface CostSettlementPersistence {
  put(item: CostSettlementRecord): Promise<CostSettlementRecord>;
  get(settlementId: string): Promise<CostSettlementRecord | null>;
  listByDay(dayId: string): Promise<CostSettlementRecord[]>;
  listAll(): Promise<CostSettlementRecord[]>;
}

export interface CostSplittingDependencies {
  bookingStore?: BookingPersistence;
  groupStore?: CostGroupPersistence;
  expenseStore?: CostExpensePersistence;
  settlementStore?: CostSettlementPersistence;
  paymentPreferenceStore?: MemberPaymentPreferencePersistence;
}

export const costGroupStore: CostGroupPersistence = {
  async create(item) {
    const record = {
      ...item,
      groupScope: COST_GROUP_SCOPE,
    };
    await CostGroupEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(groupId, changes) {
    const updated = await CostGroupEntity.patch({
      groupScope: COST_GROUP_SCOPE,
      groupId,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(groupId) {
    await CostGroupEntity.delete({
      groupScope: COST_GROUP_SCOPE,
      groupId,
    }).go({ response: 'none' });
  },
  async get(groupId) {
    const response = await CostGroupEntity.get({
      groupScope: COST_GROUP_SCOPE,
      groupId,
    }).go();
    return response.data ?? null;
  },
  async listByDay(dayId) {
    const response = await CostGroupEntity.query.byDay({ dayId }).go();
    return response.data.toSorted(compareCreatedAt);
  },
  async listAll() {
    const response = await CostGroupEntity.query.group({ groupScope: COST_GROUP_SCOPE }).go();
    return response.data.toSorted(compareCreatedAt);
  },
};

export const costExpenseStore: CostExpensePersistence = {
  async create(item) {
    const record = {
      ...item,
      expenseScope: COST_EXPENSE_SCOPE,
    };
    await CostExpenseEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(expenseId, changes) {
    const updated = await CostExpenseEntity.patch({
      expenseScope: COST_EXPENSE_SCOPE,
      expenseId,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(expenseId) {
    await CostExpenseEntity.delete({
      expenseScope: COST_EXPENSE_SCOPE,
      expenseId,
    }).go({ response: 'none' });
  },
  async get(expenseId) {
    const response = await CostExpenseEntity.get({
      expenseScope: COST_EXPENSE_SCOPE,
      expenseId,
    }).go();
    return response.data ?? null;
  },
  async listByDay(dayId) {
    const response = await CostExpenseEntity.query.byDay({ dayId }).go();
    return response.data.toSorted(compareCreatedAt);
  },
  async listByGroup(groupId) {
    const response = await CostExpenseEntity.query.byGroup({ groupId }).go();
    return response.data.toSorted(compareCreatedAt);
  },
  async listAll() {
    const response = await CostExpenseEntity.query
      .expense({ expenseScope: COST_EXPENSE_SCOPE })
      .go();
    return response.data.toSorted(compareCreatedAt);
  },
};

export const costSettlementStore: CostSettlementPersistence = {
  async put(item) {
    const record = {
      ...item,
      settlementScope: COST_SETTLEMENT_SCOPE,
    };
    await CostSettlementEntity.put(record).go();
    return record;
  },
  async get(settlementId) {
    const response = await CostSettlementEntity.get({
      settlementScope: COST_SETTLEMENT_SCOPE,
      settlementId,
    }).go();
    return response.data ?? null;
  },
  async listByDay(dayId) {
    const response = await CostSettlementEntity.query.byDay({ dayId }).go();
    return response.data;
  },
  async listAll() {
    const response = await CostSettlementEntity.query
      .settlement({ settlementScope: COST_SETTLEMENT_SCOPE })
      .go();
    return response.data;
  },
};

function compareCreatedAt<T extends { createdAt: string; groupId?: string; expenseId?: string }>(
  left: T,
  right: T,
) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return (left.groupId ?? left.expenseId ?? '').localeCompare(
    right.groupId ?? right.expenseId ?? '',
  );
}

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function settlementId(input: {
  dayId: string;
  debtorUserId: string;
  creditorUserId: string;
  currency: string;
}) {
  return [input.dayId, input.debtorUserId, input.creditorUserId, input.currency].join('#');
}

function hashSettlement(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 24);
}

function parseParticipantNames(record: CostGroupRecord): Map<string, string> {
  try {
    const parsed = JSON.parse(record.participantNamesJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([userId, userName]) => [userId, userName]),
    );
  } catch {
    return new Map();
  }
}

function serializeParticipantNames(participants: CostParticipant[]) {
  return JSON.stringify(
    Object.fromEntries(
      participants.map((participant) => [participant.userId, participant.userName]),
    ),
  );
}

function participantsFromAttendance(attendance: DayAttendanceSummary): CostParticipant[] {
  return attendance.attendees
    .filter((attendee) => attendee.status !== 'cancelled')
    .map((attendee) => ({
      userId: attendee.userId,
      userName: attendee.userName,
    }))
    .toSorted((left, right) => left.userName.localeCompare(right.userName));
}

async function listActiveParticipants(
  dayId: string,
  bookings: BookingPersistence,
): Promise<CostParticipant[]> {
  const dayBookings = await bookings.listByDay(dayId);
  return dayBookings
    .filter((booking) => booking.status !== 'cancelled')
    .map((booking) => ({
      userId: booking.userId,
      userName: booking.userName,
    }))
    .toSorted((left, right) => left.userName.localeCompare(right.userName));
}

function getParticipantMap(participants: CostParticipant[]) {
  return new Map(participants.map((participant) => [participant.userId, participant]));
}

function requireActiveParticipant(activeParticipants: CostParticipant[], userId: string) {
  if (!activeParticipants.some((participant) => participant.userId === userId)) {
    throw new Response('Add this day to your bookings before splitting costs.', {
      status: 400,
    });
  }
}

function buildParticipantSnapshot(
  userIds: string[],
  activeParticipants: CostParticipant[],
  existing?: CostGroupRecord,
): CostParticipant[] {
  const activeByUserId = getParticipantMap(activeParticipants);
  const existingNames = existing ? parseParticipantNames(existing) : new Map();

  return userIds.map((userId) => {
    const active = activeByUserId.get(userId);
    if (active) {
      return active;
    }

    const existingName = existingNames.get(userId);
    if (existingName) {
      return { userId, userName: existingName };
    }

    throw new Response('Choose people who are attending this day.', {
      status: 400,
    });
  });
}

function getGroupParticipants(group: CostGroupRecord): CostParticipant[] {
  const names = parseParticipantNames(group);
  return group.participantUserIds.map((userId) => ({
    userId,
    userName: names.get(userId) ?? userId,
  }));
}

function requireGroupParticipant(group: CostGroupRecord, userId: string) {
  if (!group.participantUserIds.includes(userId)) {
    throw new Response('You cannot access this cost group.', { status: 403 });
  }
}

function requireGroupOwner(group: CostGroupRecord, user: Pick<User, 'id'>) {
  if (group.createdByUserId !== user.id) {
    throw new Response('Only the group creator can edit this cost group.', {
      status: 403,
    });
  }
}

function getParticipantName(group: CostGroupRecord, userId: string) {
  return (
    getGroupParticipants(group).find((participant) => participant.userId === userId)?.userName ??
    userId
  );
}

function updateBalance(balances: Map<string, number>, userId: string, amountPence: number) {
  balances.set(userId, (balances.get(userId) ?? 0) + amountPence);
}

function expenseShares(expense: CostExpenseRecord, participantUserIds: string[]) {
  const sortedUserIds = [...participantUserIds].toSorted();
  const base = Math.floor(expense.amountPence / sortedUserIds.length);
  const remainder = expense.amountPence % sortedUserIds.length;

  return new Map(
    sortedUserIds.map((userId, index) => [userId, base + (index < remainder ? 1 : 0)]),
  );
}

function calculateGroupBalances(
  group: CostGroupRecord,
  expenses: CostExpenseRecord[],
): Map<string, number> {
  const balances = new Map(group.participantUserIds.map((userId) => [userId, 0]));

  for (const expense of expenses) {
    if (!group.participantUserIds.includes(expense.paidByUserId)) {
      continue;
    }

    updateBalance(balances, expense.paidByUserId, expense.amountPence);
    for (const [userId, sharePence] of expenseShares(expense, group.participantUserIds)) {
      updateBalance(balances, userId, -sharePence);
    }
  }

  return balances;
}

function toExpenseSummary(expense: CostExpenseRecord, currentUserId: string): CostExpenseSummary {
  return {
    expenseId: expense.expenseId,
    groupId: expense.groupId,
    dayId: expense.dayId,
    title: expense.title,
    amountPence: expense.amountPence,
    currency: expense.currency as 'GBP',
    paidByUserId: expense.paidByUserId,
    paidByName: expense.paidByName,
    notes: expense.notes,
    createdByUserId: expense.createdByUserId,
    createdByName: expense.createdByName,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    canEdit: expense.createdByUserId === currentUserId || expense.paidByUserId === currentUserId,
  };
}

function toGroupSummary(
  group: CostGroupRecord,
  expenses: CostExpenseRecord[],
  currentUserId: string,
): CostGroupSummary {
  return {
    groupId: group.groupId,
    dayId: group.dayId,
    name: group.name,
    category: group.category,
    participants: getGroupParticipants(group),
    totalPence: expenses.reduce((total, expense) => total + expense.amountPence, 0),
    currency: COST_CURRENCY,
    expenses: expenses.map((expense) => toExpenseSummary(expense, currentUserId)),
    createdByUserId: group.createdByUserId,
    createdByName: group.createdByName,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    canEdit: group.createdByUserId === currentUserId,
  };
}

function getCurrentSettlementStatus(
  settlement: {
    settlementId: string;
    amountPence: number;
    currency: 'GBP';
    breakdownHash: string;
  },
  recordsById: Map<string, CostSettlementRecord>,
): CostSettlementStatus {
  const record = recordsById.get(settlement.settlementId);
  if (
    !record ||
    record.amountPence !== settlement.amountPence ||
    record.currency !== settlement.currency ||
    record.breakdownHash !== settlement.breakdownHash
  ) {
    return 'open';
  }

  return record.status;
}

function buildSettlementBreakdown(
  debtorUserId: string,
  creditorUserId: string,
  groups: CostGroupSummary[],
  groupBalances: Map<string, Map<string, number>>,
): CostSettlementBreakdown[] {
  return groups
    .map((group) => {
      const balances = groupBalances.get(group.groupId) ?? new Map();
      return {
        groupId: group.groupId,
        groupName: group.name,
        debtorSharePence: Math.max(-(balances.get(debtorUserId) ?? 0), 0),
        creditorSharePence: Math.max(balances.get(creditorUserId) ?? 0, 0),
      };
    })
    .filter((breakdown) => breakdown.debtorSharePence > 0 && breakdown.creditorSharePence > 0);
}

function buildNetSettlements(input: {
  dayId: string;
  groups: CostGroupSummary[];
  balances: Map<string, number>;
  groupBalances: Map<string, Map<string, number>>;
  participantNames: Map<string, string>;
  settlementRecords: CostSettlementRecord[];
  paymentPreferences: Map<string, { label: string; url: string }>;
  currentUserId: string;
}): NetCostSettlement[] {
  const debtors = [...input.balances.entries()]
    .filter(([, amount]) => amount < 0)
    .map(([userId, amount]) => ({ userId, amountPence: -amount }))
    .toSorted((left, right) =>
      (input.participantNames.get(left.userId) ?? left.userId).localeCompare(
        input.participantNames.get(right.userId) ?? right.userId,
      ),
    );
  const creditors = [...input.balances.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([userId, amount]) => ({ userId, amountPence: amount }))
    .toSorted((left, right) =>
      (input.participantNames.get(left.userId) ?? left.userId).localeCompare(
        input.participantNames.get(right.userId) ?? right.userId,
      ),
    );
  const recordsById = new Map(
    input.settlementRecords.map((record) => [record.settlementId, record]),
  );
  const settlements: NetCostSettlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtors[debtorIndex] && creditors[creditorIndex]) {
    const debtor = debtors[debtorIndex]!;
    const creditor = creditors[creditorIndex]!;
    const amountPence = Math.min(debtor.amountPence, creditor.amountPence);
    const id = settlementId({
      dayId: input.dayId,
      debtorUserId: debtor.userId,
      creditorUserId: creditor.userId,
      currency: COST_CURRENCY,
    });
    const breakdown = buildSettlementBreakdown(
      debtor.userId,
      creditor.userId,
      input.groups,
      input.groupBalances,
    );
    const breakdownHash = hashSettlement({
      dayId: input.dayId,
      debtorUserId: debtor.userId,
      creditorUserId: creditor.userId,
      amountPence,
      currency: COST_CURRENCY,
      breakdown,
    });
    const status = getCurrentSettlementStatus(
      {
        settlementId: id,
        amountPence,
        currency: COST_CURRENCY,
        breakdownHash,
      },
      recordsById,
    );
    const preference = input.paymentPreferences.get(creditor.userId);

    settlements.push({
      settlementId: id,
      dayId: input.dayId,
      debtorUserId: debtor.userId,
      debtorName: input.participantNames.get(debtor.userId) ?? debtor.userId,
      creditorUserId: creditor.userId,
      creditorName: input.participantNames.get(creditor.userId) ?? creditor.userId,
      amountPence,
      currency: COST_CURRENCY,
      status,
      breakdownHash,
      breakdown,
      paymentPreference: preference ? { label: preference.label, url: preference.url } : undefined,
      canMarkSent: input.currentUserId === debtor.userId && status === 'open',
      canConfirmReceived: input.currentUserId === creditor.userId && status === 'sent',
    });

    debtor.amountPence -= amountPence;
    creditor.amountPence -= amountPence;
    if (debtor.amountPence === 0) {
      debtorIndex += 1;
    }
    if (creditor.amountPence === 0) {
      creditorIndex += 1;
    }
  }

  return settlements;
}

export async function loadEventCostSummary(
  dayId: string,
  currentUserId: string,
  attendance?: DayAttendanceSummary | null,
  dependencies: CostSplittingDependencies = {},
): Promise<EventCostSummary> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const expenses = dependencies.expenseStore ?? costExpenseStore;
  const settlements = dependencies.settlementStore ?? costSettlementStore;
  const bookings = dependencies.bookingStore ?? bookingStore;
  const activeParticipants = attendance
    ? participantsFromAttendance(attendance)
    : await listActiveParticipants(dayId, bookings);
  const [dayGroups, dayExpenses, settlementRecords] = await Promise.all([
    groups.listByDay(dayId),
    expenses.listByDay(dayId),
    settlements.listByDay(dayId),
  ]);
  const visibleGroups = dayGroups.filter((group) =>
    group.participantUserIds.includes(currentUserId),
  );
  const visibleGroupIds = new Set(visibleGroups.map((group) => group.groupId));
  const visibleExpenses = dayExpenses.filter((expense) => visibleGroupIds.has(expense.groupId));
  const expensesByGroupId = new Map<string, CostExpenseRecord[]>();

  for (const expense of visibleExpenses) {
    const current = expensesByGroupId.get(expense.groupId);
    if (current) {
      current.push(expense);
    } else {
      expensesByGroupId.set(expense.groupId, [expense]);
    }
  }

  const groupSummaries = visibleGroups.map((group) =>
    toGroupSummary(group, expensesByGroupId.get(group.groupId) ?? [], currentUserId),
  );
  const participantNames = new Map(
    activeParticipants.map((participant) => [participant.userId, participant.userName]),
  );
  const aggregateBalances = new Map<string, number>();
  const groupBalances = new Map<string, Map<string, number>>();

  for (const group of visibleGroups) {
    for (const participant of getGroupParticipants(group)) {
      participantNames.set(participant.userId, participant.userName);
      if (!aggregateBalances.has(participant.userId)) {
        aggregateBalances.set(participant.userId, 0);
      }
    }

    const balances = calculateGroupBalances(group, expensesByGroupId.get(group.groupId) ?? []);
    groupBalances.set(group.groupId, balances);
    for (const [userId, amountPence] of balances) {
      updateBalance(aggregateBalances, userId, amountPence);
    }
  }

  const creditorUserIds = [...aggregateBalances.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([userId]) => userId);
  const paymentPreferences = await listMemberPaymentPreferencesByUserIds(
    creditorUserIds,
    dependencies.paymentPreferenceStore ?? memberPaymentPreferenceStore,
  );
  const netSettlements = buildNetSettlements({
    dayId,
    groups: groupSummaries,
    balances: aggregateBalances,
    groupBalances,
    participantNames,
    settlementRecords,
    paymentPreferences,
    currentUserId,
  });

  return {
    dayId,
    currency: COST_CURRENCY,
    availableParticipants: activeParticipants,
    groups: groupSummaries,
    netSettlements,
    totalPence: groupSummaries.reduce((total, group) => total + group.totalPence, 0),
  };
}

export async function createCostGroup(
  input: CostGroupUpsertInput,
  user: Pick<User, 'id' | 'name'>,
  dependencies: CostSplittingDependencies = {},
): Promise<CostGroupRecord> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const bookings = dependencies.bookingStore ?? bookingStore;
  const activeParticipants = await listActiveParticipants(input.dayId, bookings);
  requireActiveParticipant(activeParticipants, user.id);
  const participantUserIds = unique([...input.participantUserIds, user.id]);
  const participants = buildParticipantSnapshot(participantUserIds, activeParticipants);
  const now = new Date().toISOString();

  return groups.create({
    groupScope: COST_GROUP_SCOPE,
    groupId: ulid(),
    dayId: input.dayId,
    name: input.name.trim(),
    category: input.category,
    participantUserIds,
    participantNamesJson: serializeParticipantNames(participants),
    createdByUserId: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now,
  } as CostGroupRecord);
}

export async function updateCostGroup(
  input: CostGroupUpsertInput & { groupId: string },
  user: Pick<User, 'id'>,
  dependencies: CostSplittingDependencies = {},
): Promise<CostGroupRecord> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const bookings = dependencies.bookingStore ?? bookingStore;
  const existing = await groups.get(input.groupId);

  if (!existing || existing.dayId !== input.dayId) {
    throw new Response('Cost group not found.', { status: 404 });
  }

  requireGroupOwner(existing, user);

  const activeParticipants = await listActiveParticipants(input.dayId, bookings);
  const participantUserIds = unique([...input.participantUserIds, existing.createdByUserId]);
  const participants = buildParticipantSnapshot(participantUserIds, activeParticipants, existing);

  return groups.update(existing.groupId, {
    name: input.name.trim(),
    category: input.category,
    participantUserIds,
    participantNamesJson: serializeParticipantNames(participants),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCostGroup(
  input: CostGroupDeleteInput,
  user: Pick<User, 'id'>,
  dependencies: CostSplittingDependencies = {},
): Promise<void> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const expenses = dependencies.expenseStore ?? costExpenseStore;
  const existing = await groups.get(input.groupId);

  if (!existing || existing.dayId !== input.dayId) {
    throw new Response('Cost group not found.', { status: 404 });
  }

  requireGroupOwner(existing, user);
  await Promise.all(
    (await expenses.listByGroup(existing.groupId)).map((expense) =>
      expenses.delete(expense.expenseId),
    ),
  );
  await groups.delete(existing.groupId);
}

export async function createCostExpense(
  input: CostExpenseUpsertInput,
  user: Pick<User, 'id' | 'name'>,
  dependencies: CostSplittingDependencies = {},
): Promise<CostExpenseRecord> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const expenses = dependencies.expenseStore ?? costExpenseStore;
  const group = await groups.get(input.groupId);

  if (!group || group.dayId !== input.dayId) {
    throw new Response('Cost group not found.', { status: 404 });
  }

  requireGroupParticipant(group, user.id);
  if (!group.participantUserIds.includes(input.paidByUserId)) {
    throw new Response('Choose a payer in this cost group.', { status: 400 });
  }

  const now = new Date().toISOString();
  return expenses.create({
    expenseScope: COST_EXPENSE_SCOPE,
    expenseId: ulid(),
    groupId: group.groupId,
    dayId: group.dayId,
    title: input.title.trim(),
    amountPence: input.amountPence,
    currency: COST_CURRENCY,
    paidByUserId: input.paidByUserId,
    paidByName: getParticipantName(group, input.paidByUserId),
    notes: sanitizeOptional(input.notes),
    createdByUserId: user.id,
    createdByName: user.name,
    createdAt: now,
    updatedAt: now,
  } as CostExpenseRecord);
}

export async function updateCostExpense(
  input: CostExpenseUpsertInput & { expenseId: string },
  user: Pick<User, 'id'>,
  dependencies: CostSplittingDependencies = {},
): Promise<CostExpenseRecord> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const expenses = dependencies.expenseStore ?? costExpenseStore;
  const [expense, group] = await Promise.all([
    expenses.get(input.expenseId),
    groups.get(input.groupId),
  ]);

  if (
    !expense ||
    !group ||
    expense.dayId !== input.dayId ||
    expense.groupId !== input.groupId ||
    group.dayId !== input.dayId
  ) {
    throw new Response('Cost expense not found.', { status: 404 });
  }

  requireGroupParticipant(group, user.id);
  if (expense.createdByUserId !== user.id && expense.paidByUserId !== user.id) {
    throw new Response('Only the payer or creator can edit this expense.', {
      status: 403,
    });
  }
  if (!group.participantUserIds.includes(input.paidByUserId)) {
    throw new Response('Choose a payer in this cost group.', { status: 400 });
  }

  return expenses.update(expense.expenseId, {
    title: input.title.trim(),
    amountPence: input.amountPence,
    currency: COST_CURRENCY,
    paidByUserId: input.paidByUserId,
    paidByName: getParticipantName(group, input.paidByUserId),
    notes: sanitizeOptional(input.notes),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCostExpense(
  input: CostExpenseDeleteInput,
  user: Pick<User, 'id'>,
  dependencies: CostSplittingDependencies = {},
): Promise<void> {
  const groups = dependencies.groupStore ?? costGroupStore;
  const expenses = dependencies.expenseStore ?? costExpenseStore;
  const [expense, group] = await Promise.all([
    expenses.get(input.expenseId),
    groups.get(input.groupId),
  ]);

  if (
    !expense ||
    !group ||
    expense.dayId !== input.dayId ||
    expense.groupId !== input.groupId ||
    group.dayId !== input.dayId
  ) {
    throw new Response('Cost expense not found.', { status: 404 });
  }

  requireGroupParticipant(group, user.id);
  if (expense.createdByUserId !== user.id && expense.paidByUserId !== user.id) {
    throw new Response('Only the payer or creator can delete this expense.', {
      status: 403,
    });
  }

  await expenses.delete(expense.expenseId);
}

export async function updateCostSettlementStatus(
  input: CostSettlementStatusInput,
  user: Pick<User, 'id' | 'name'>,
  dependencies: CostSplittingDependencies = {},
): Promise<CostSettlementRecord> {
  if (input.status === 'sent' && input.debtorUserId !== user.id) {
    throw new Response('Only the owing member can mark this as sent.', {
      status: 403,
    });
  }
  if (input.status === 'received' && input.creditorUserId !== user.id) {
    throw new Response('Only the recipient can confirm this payment.', {
      status: 403,
    });
  }

  const summary = await loadEventCostSummary(input.dayId, user.id, null, dependencies);
  const currentSettlement = summary.netSettlements.find(
    (settlement) =>
      settlement.debtorUserId === input.debtorUserId &&
      settlement.creditorUserId === input.creditorUserId &&
      settlement.amountPence === input.amountPence &&
      settlement.currency === input.currency &&
      settlement.breakdownHash === input.breakdownHash,
  );

  if (!currentSettlement) {
    throw new Response('This settlement has changed. Refresh and try again.', {
      status: 409,
    });
  }

  if (input.status === 'sent' && currentSettlement.status === 'received') {
    throw new Response('This payment has already been confirmed.', {
      status: 409,
    });
  }

  if (input.status === 'received' && currentSettlement.status === 'open') {
    throw new Response('Mark this payment as sent before confirming receipt.', {
      status: 409,
    });
  }

  const settlements = dependencies.settlementStore ?? costSettlementStore;
  const id = settlementId(input);
  const existing = await settlements.get(id);
  const now = new Date().toISOString();

  return settlements.put({
    settlementScope: COST_SETTLEMENT_SCOPE,
    settlementId: id,
    dayId: input.dayId,
    debtorUserId: input.debtorUserId,
    creditorUserId: input.creditorUserId,
    amountPence: input.amountPence,
    currency: COST_CURRENCY,
    breakdownHash: input.breakdownHash,
    status: input.status,
    updatedByUserId: user.id,
    updatedByName: user.name,
    sentAt:
      input.status === 'sent'
        ? (existing?.sentAt ?? now)
        : (existing?.sentAt ?? (input.status === 'received' ? now : undefined)),
    receivedAt: input.status === 'received' ? (existing?.receivedAt ?? now) : undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as CostSettlementRecord);
}
