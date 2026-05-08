import type { User } from '~/lib/auth/schemas';
import {
  BETA_FEATURES,
  type BetaFeatureKey,
  type BetaFeatureSettings,
  createDefaultBetaFeatureSettings,
  isBetaFeatureKey,
} from '~/lib/beta-features/config';
import {
  MemberBetaFeatureEntity,
  type MemberBetaFeatureRecord,
} from '~/lib/db/entities/member-beta-feature.server';

export const MEMBER_BETA_FEATURE_SCOPE = 'beta-feature';

export type BetaFeaturePreferenceActionResult =
  | {
      ok: true;
      betaFeatures: BetaFeatureSettings;
      message: string;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<'featureKey' | 'enabled', string[] | undefined>>;
    };

export interface MemberBetaFeaturePersistence {
  put(item: MemberBetaFeatureRecord): Promise<MemberBetaFeatureRecord>;
  delete(userId: string, featureKey: BetaFeatureKey): Promise<void>;
  get(userId: string, featureKey: BetaFeatureKey): Promise<MemberBetaFeatureRecord | null>;
}

export const memberBetaFeatureStore: MemberBetaFeaturePersistence = {
  async put(item) {
    const record = {
      ...item,
      preferenceScope: MEMBER_BETA_FEATURE_SCOPE,
    };
    await MemberBetaFeatureEntity.put(record).go();
    return record;
  },
  async delete(userId, featureKey) {
    await MemberBetaFeatureEntity.delete({
      userId,
      preferenceScope: MEMBER_BETA_FEATURE_SCOPE,
      featureKey,
    }).go({ response: 'none' });
  },
  async get(userId, featureKey) {
    const response = await MemberBetaFeatureEntity.get({
      userId,
      preferenceScope: MEMBER_BETA_FEATURE_SCOPE,
      featureKey,
    }).go();
    return response.data ?? null;
  },
};

function parseEnabled(value: FormDataEntryValue | null) {
  return value === 'true' || value === 'on';
}

export async function setMemberBetaFeature(
  input: {
    userId: string;
    featureKey: BetaFeatureKey;
    enabled: boolean;
  },
  store: MemberBetaFeaturePersistence = memberBetaFeatureStore,
) {
  if (!input.enabled) {
    await store.delete(input.userId, input.featureKey);
    return null;
  }

  const existing = await store.get(input.userId, input.featureKey);
  const now = new Date().toISOString();
  return store.put({
    userId: input.userId,
    preferenceScope: MEMBER_BETA_FEATURE_SCOPE,
    featureKey: input.featureKey,
    enabled: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as MemberBetaFeatureRecord);
}

export async function isBetaFeatureEnabled(
  userId: string,
  featureKey: BetaFeatureKey,
  store: MemberBetaFeaturePersistence = memberBetaFeatureStore,
) {
  const record = await store.get(userId, featureKey);
  return record?.enabled === true;
}

export async function getMemberBetaFeatureSettings(
  userId: string,
  store: MemberBetaFeaturePersistence = memberBetaFeatureStore,
): Promise<BetaFeatureSettings> {
  const settings = createDefaultBetaFeatureSettings();
  const records = await Promise.all(BETA_FEATURES.map((feature) => store.get(userId, feature.key)));

  for (const record of records) {
    if (record?.enabled && isBetaFeatureKey(record.featureKey)) {
      settings[record.featureKey] = true;
    }
  }

  return settings;
}

export async function submitMemberBetaFeaturePreference(
  formData: FormData,
  user: User,
  store: MemberBetaFeaturePersistence = memberBetaFeatureStore,
): Promise<BetaFeaturePreferenceActionResult> {
  const featureKey = formData.get('featureKey');
  if (!isBetaFeatureKey(featureKey)) {
    return {
      ok: false,
      formError: 'Could not update this beta feature yet.',
      fieldErrors: {
        featureKey: ['Choose a beta feature.'],
      },
    };
  }

  const enabled = parseEnabled(formData.get('enabled'));
  await setMemberBetaFeature(
    {
      userId: user.id,
      featureKey,
      enabled,
    },
    store,
  );

  return {
    ok: true,
    betaFeatures: await getMemberBetaFeatureSettings(user.id, store),
    message: enabled ? 'Beta feature enabled.' : 'Beta feature disabled.',
  };
}
