import {
  MemberDaysPreferenceEntity,
  type MemberDaysPreferenceRecord,
} from '../entities/member-days-preference.server';

export const AVAILABLE_DAYS_PREFERENCE_SCOPE = 'available-days-filters';

export interface MemberDaysPreferencePersistence {
  create(item: MemberDaysPreferenceRecord): Promise<MemberDaysPreferenceRecord>;
  update(
    userId: string,
    changes: Partial<MemberDaysPreferenceRecord>,
  ): Promise<MemberDaysPreferenceRecord>;
  delete(userId: string): Promise<void>;
  getByUser(userId: string): Promise<MemberDaysPreferenceRecord | null>;
}

export const memberDaysPreferenceStore: MemberDaysPreferencePersistence = {
  async create(item) {
    const record = {
      ...item,
      preferenceScope: AVAILABLE_DAYS_PREFERENCE_SCOPE,
    };

    await MemberDaysPreferenceEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(userId, changes) {
    const updated = await MemberDaysPreferenceEntity.patch({
      userId,
      preferenceScope: AVAILABLE_DAYS_PREFERENCE_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(userId) {
    await MemberDaysPreferenceEntity.delete({
      userId,
      preferenceScope: AVAILABLE_DAYS_PREFERENCE_SCOPE,
    }).go({ response: 'none' });
  },
  async getByUser(userId) {
    const response = await MemberDaysPreferenceEntity.get({
      userId,
      preferenceScope: AVAILABLE_DAYS_PREFERENCE_SCOPE,
    }).go();
    return response.data ?? null;
  },
};
