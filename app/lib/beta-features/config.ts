export const EVENT_BRIEFING_FEATURE = 'eventBriefing';

export const BETA_FEATURES = [
  {
    key: EVENT_BRIEFING_FEATURE,
    title: 'Event briefing',
    description: 'Show a briefing view that brings together event details, plans, costs, and updates.',
  },
] as const;

export type BetaFeatureKey = (typeof BETA_FEATURES)[number]['key'];
export type BetaFeatureSettings = Record<BetaFeatureKey, boolean>;

export const BETA_FEATURE_KEYS = BETA_FEATURES.map((feature) => feature.key);

export function isBetaFeatureKey(value: unknown): value is BetaFeatureKey {
  return typeof value === 'string' && BETA_FEATURE_KEYS.includes(value as BetaFeatureKey);
}

export function createDefaultBetaFeatureSettings(): BetaFeatureSettings {
  return Object.fromEntries(
    BETA_FEATURES.map((feature) => [feature.key, false]),
  ) as BetaFeatureSettings;
}
