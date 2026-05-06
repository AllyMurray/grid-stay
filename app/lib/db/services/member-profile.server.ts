import { MemberProfileEntity, type MemberProfileRecord } from '../entities/member-profile.server';

const MEMBER_PROFILE_SCOPE = 'profile';

export interface MemberProfilePersistence {
  create(item: MemberProfileRecord): Promise<MemberProfileRecord>;
  update(userId: string, changes: Partial<MemberProfileRecord>): Promise<MemberProfileRecord>;
  delete(userId: string): Promise<void>;
  getByUser(userId: string): Promise<MemberProfileRecord | null>;
  listAll(): Promise<MemberProfileRecord[]>;
}

export const memberProfileStore: MemberProfilePersistence = {
  async create(item) {
    const record = {
      ...item,
      profileScope: MEMBER_PROFILE_SCOPE,
    };

    await MemberProfileEntity.create(record).go({
      response: 'none',
    });
    return record;
  },
  async update(userId, changes) {
    const updated = await MemberProfileEntity.patch({
      userId,
      profileScope: MEMBER_PROFILE_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(userId) {
    await MemberProfileEntity.delete({
      userId,
      profileScope: MEMBER_PROFILE_SCOPE,
    }).go({ response: 'none' });
  },
  async getByUser(userId) {
    const response = await MemberProfileEntity.get({
      userId,
      profileScope: MEMBER_PROFILE_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await MemberProfileEntity.query
      .allProfiles({
        profileScope: MEMBER_PROFILE_SCOPE,
      })
      .go();
    return response.data;
  },
};

function sanitizeDisplayName(value: string): string | undefined {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
}

export async function setMemberDisplayName(
  input: {
    userId: string;
    displayName: string;
    updatedByUserId: string;
  },
  store: MemberProfilePersistence = memberProfileStore,
): Promise<MemberProfileRecord | null> {
  const displayName = sanitizeDisplayName(input.displayName);

  if (!displayName) {
    await store.delete(input.userId);
    return null;
  }

  const existing = await store.getByUser(input.userId);
  const now = new Date().toISOString();

  if (existing) {
    return store.update(input.userId, {
      displayName,
      updatedByUserId: input.updatedByUserId,
      updatedAt: now,
    });
  }

  return store.create({
    userId: input.userId,
    profileScope: MEMBER_PROFILE_SCOPE,
    displayName,
    updatedByUserId: input.updatedByUserId,
    createdAt: now,
    updatedAt: now,
  } as MemberProfileRecord);
}

export async function getMemberProfile(
  userId: string,
  store: MemberProfilePersistence = memberProfileStore,
): Promise<MemberProfileRecord | null> {
  return store.getByUser(userId);
}

export async function listMemberProfiles(
  store: MemberProfilePersistence = memberProfileStore,
): Promise<MemberProfileRecord[]> {
  return store.listAll();
}
