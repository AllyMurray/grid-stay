import { describe, expect, it, vi } from 'vite-plus/test';
import { EVENT_BRIEFING_FEATURE } from './config';

vi.mock('~/lib/db/entities/member-beta-feature.server', () => ({
  MemberBetaFeatureEntity: {
    put: vi.fn(() => ({ go: vi.fn() })),
    delete: vi.fn(() => ({ go: vi.fn() })),
    get: vi.fn(() => ({ go: vi.fn() })),
  },
}));

import {
  getMemberBetaFeatureSettings,
  isBetaFeatureEnabled,
  MEMBER_BETA_FEATURE_SCOPE,
  setMemberBetaFeature,
  submitMemberBetaFeaturePreference,
  type MemberBetaFeaturePersistence,
} from './preferences.server';

function createStore(): MemberBetaFeaturePersistence {
  const records = new Map<string, Awaited<ReturnType<MemberBetaFeaturePersistence['put']>>>();
  const key = (userId: string, featureKey: string) => `${userId}:${featureKey}`;

  return {
    put: vi.fn(async (item) => {
      records.set(key(item.userId, item.featureKey), item);
      return item;
    }),
    delete: vi.fn(async (userId, featureKey) => {
      records.delete(key(userId, featureKey));
    }),
    get: vi.fn(async (userId, featureKey) => records.get(key(userId, featureKey)) ?? null),
  };
}

describe('member beta feature preferences', () => {
  it('defaults beta features to disabled', async () => {
    const store = createStore();

    await expect(getMemberBetaFeatureSettings('user-1', store)).resolves.toEqual({
      [EVENT_BRIEFING_FEATURE]: false,
    });
    await expect(
      isBetaFeatureEnabled('user-1', EVENT_BRIEFING_FEATURE, store),
    ).resolves.toBe(false);
  });

  it('stores enabled beta features and deletes disabled ones', async () => {
    const store = createStore();

    await setMemberBetaFeature(
      {
        userId: 'user-1',
        featureKey: EVENT_BRIEFING_FEATURE,
        enabled: true,
      },
      store,
    );

    await expect(
      isBetaFeatureEnabled('user-1', EVENT_BRIEFING_FEATURE, store),
    ).resolves.toBe(true);
    expect(store.put).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        preferenceScope: MEMBER_BETA_FEATURE_SCOPE,
        featureKey: EVENT_BRIEFING_FEATURE,
        enabled: true,
      }),
    );

    await setMemberBetaFeature(
      {
        userId: 'user-1',
        featureKey: EVENT_BRIEFING_FEATURE,
        enabled: false,
      },
      store,
    );

    expect(store.delete).toHaveBeenCalledWith('user-1', EVENT_BRIEFING_FEATURE);
    await expect(
      isBetaFeatureEnabled('user-1', EVENT_BRIEFING_FEATURE, store),
    ).resolves.toBe(false);
  });

  it('submits beta feature form updates for the current user', async () => {
    const store = createStore();
    const formData = new FormData();
    formData.set('featureKey', EVENT_BRIEFING_FEATURE);
    formData.set('enabled', 'true');

    await expect(
      submitMemberBetaFeaturePreference(
        formData,
        {
          id: 'user-1',
          name: 'Driver One',
          email: 'driver@example.com',
          role: 'member',
        },
        store,
      ),
    ).resolves.toEqual({
      ok: true,
      betaFeatures: {
        [EVENT_BRIEFING_FEATURE]: true,
      },
      message: 'Beta feature enabled.',
    });
  });
});
