import {
  MemberPaymentPreferenceEntity,
  type MemberPaymentPreferenceRecord,
} from '../entities/member-payment-preference.server';

export const MEMBER_PAYMENT_PREFERENCE_SCOPE = 'payment-preference';

export interface MemberPaymentPreferencePersistence {
  put(item: MemberPaymentPreferenceRecord): Promise<MemberPaymentPreferenceRecord>;
  delete(userId: string): Promise<void>;
  get(userId: string): Promise<MemberPaymentPreferenceRecord | null>;
  listAll(): Promise<MemberPaymentPreferenceRecord[]>;
}

export const memberPaymentPreferenceStore: MemberPaymentPreferencePersistence = {
  async put(item) {
    const record = {
      ...item,
      preferenceScope: MEMBER_PAYMENT_PREFERENCE_SCOPE,
    };
    await MemberPaymentPreferenceEntity.put(record).go();
    return record;
  },
  async delete(userId) {
    await MemberPaymentPreferenceEntity.delete({
      userId,
      preferenceScope: MEMBER_PAYMENT_PREFERENCE_SCOPE,
    }).go({ response: 'none' });
  },
  async get(userId) {
    const response = await MemberPaymentPreferenceEntity.get({
      userId,
      preferenceScope: MEMBER_PAYMENT_PREFERENCE_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await MemberPaymentPreferenceEntity.scan.go();
    return response.data.filter(
      (record) => record.preferenceScope === MEMBER_PAYMENT_PREFERENCE_SCOPE,
    );
  },
};

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function setMemberPaymentPreference(
  input: {
    userId: string;
    label: string;
    url: string;
  },
  store: MemberPaymentPreferencePersistence = memberPaymentPreferenceStore,
): Promise<MemberPaymentPreferenceRecord | null> {
  const label = sanitizeOptional(input.label);
  const url = sanitizeOptional(input.url);

  if (!label || !url) {
    await store.delete(input.userId);
    return null;
  }

  const existing = await store.get(input.userId);
  const now = new Date().toISOString();
  return store.put({
    userId: input.userId,
    preferenceScope: MEMBER_PAYMENT_PREFERENCE_SCOPE,
    label,
    url,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as MemberPaymentPreferenceRecord);
}

export async function getMemberPaymentPreference(
  userId: string,
  store: MemberPaymentPreferencePersistence = memberPaymentPreferenceStore,
): Promise<MemberPaymentPreferenceRecord | null> {
  return store.get(userId);
}

export async function listMemberPaymentPreferencesByUserIds(
  userIds: string[],
  store: MemberPaymentPreferencePersistence = memberPaymentPreferenceStore,
): Promise<Map<string, MemberPaymentPreferenceRecord>> {
  const uniqueUserIds = [...new Set(userIds)];
  const records = await Promise.all(uniqueUserIds.map((userId) => store.get(userId)));

  return new Map(
    records
      .filter((record): record is MemberPaymentPreferenceRecord => Boolean(record))
      .map((record) => [record.userId, record]),
  );
}
