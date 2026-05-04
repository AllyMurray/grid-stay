import {
  AVAILABLE_DAYS_PREFERENCE_SCOPE,
  type MemberDaysPreferencePersistence,
  memberDaysPreferenceStore,
} from '~/lib/db/services/member-days-preference.server';
import { normalizeCircuitName } from './aggregation.server';
import type { DaysFilters } from './dashboard-feed.server';

export interface SavedDaysFilters extends DaysFilters {
  notifyOnNewMatches: boolean;
  externalChannel: '' | 'email' | 'whatsapp';
}

export type DaysPreferenceActionResult =
  | {
      ok: true;
      savedFilters: SavedDaysFilters | null;
      message: string;
    }
  | {
      ok: false;
      formError: string;
    };

function normalizeText(value: FormDataEntryValue | string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSavedType(value: string): DaysFilters['type'] {
  switch (value) {
    case 'race_day':
    case 'test_day':
    case 'track_day':
    case 'road_drive':
      return value;
    default:
      return '';
  }
}

export function hasSavedDaysFilters(filters: SavedDaysFilters | null): boolean {
  return Boolean(
    filters &&
      (filters.month ||
        filters.series ||
        filters.circuits.length > 0 ||
        filters.provider ||
        filters.type ||
        filters.showPast),
  );
}

export function sanitizeSavedDaysFilters(input: {
  month?: string | null;
  series?: string | null;
  circuits?: readonly string[] | null;
  provider?: string | null;
  type?: string | null;
  showPast?: boolean | null;
  notifyOnNewMatches?: boolean | null;
  externalChannel?: string | null;
}): SavedDaysFilters {
  const notifyOnNewMatches = Boolean(input.notifyOnNewMatches);
  const showPast = Boolean(input.showPast);

  return {
    month: normalizeText(input.month ?? ''),
    series: normalizeText(input.series ?? ''),
    circuits: [
      ...new Set(
        (input.circuits ?? [])
          .map((circuit) => normalizeCircuitName(circuit.trim()))
          .filter(Boolean),
      ),
    ].sort(),
    provider: normalizeText(input.provider ?? ''),
    type: parseSavedType(normalizeText(input.type ?? '')),
    ...(showPast ? { showPast } : {}),
    notifyOnNewMatches,
    externalChannel: '',
  };
}

export function getSavedDaysFiltersFromFormData(
  formData: FormData,
): SavedDaysFilters {
  const notifyValue = normalizeText(formData.get('notifyOnNewMatches'));

  return sanitizeSavedDaysFilters({
    month: normalizeText(formData.get('month')),
    series: normalizeText(formData.get('series')),
    circuits: formData
      .getAll('circuit')
      .map((value) => normalizeText(value))
      .filter(Boolean),
    provider: normalizeText(formData.get('provider')),
    type: normalizeText(formData.get('type')),
    showPast: normalizeText(formData.get('showPast')) === 'true',
    notifyOnNewMatches: notifyValue === 'on' || notifyValue === 'true',
  });
}

export function getSavedDaysFiltersFromRecord(input: {
  month?: string | null;
  series?: string | null;
  circuits?: readonly string[] | null;
  provider?: string | null;
  type?: string | null;
  showPast?: boolean;
  notifyOnNewMatches?: boolean;
  externalChannel?: string;
}): SavedDaysFilters {
  return sanitizeSavedDaysFilters({
    month: input.month,
    series: input.series,
    circuits: input.circuits,
    provider: input.provider,
    type: input.type,
    showPast: input.showPast,
    notifyOnNewMatches: input.notifyOnNewMatches,
    externalChannel: input.externalChannel,
  });
}

export async function getSavedDaysFilters(
  userId: string,
  store: MemberDaysPreferencePersistence = memberDaysPreferenceStore,
): Promise<SavedDaysFilters | null> {
  const record = await store.getByUser(userId);
  if (!record) {
    return null;
  }

  const filters = getSavedDaysFiltersFromRecord({
    month: record.month,
    series: record.series,
    circuits: record.circuits,
    provider: record.provider,
    type: record.dayType,
    showPast: record.showPast,
    notifyOnNewMatches: record.notifyOnNewMatches,
    externalChannel: record.externalChannel,
  });

  return hasSavedDaysFilters(filters) ? filters : null;
}

export async function saveSavedDaysFilters(
  userId: string,
  filters: SavedDaysFilters,
  store: MemberDaysPreferencePersistence = memberDaysPreferenceStore,
): Promise<SavedDaysFilters | null> {
  const sanitized = sanitizeSavedDaysFilters(filters);
  if (!hasSavedDaysFilters(sanitized)) {
    await store.delete(userId);
    return null;
  }

  const existing = await store.getByUser(userId);
  const now = new Date().toISOString();
  const changes = {
    month: sanitized.month,
    series: sanitized.series,
    circuits: sanitized.circuits,
    provider: sanitized.provider,
    dayType: sanitized.type || undefined,
    showPast: sanitized.showPast || undefined,
    notifyOnNewMatches: sanitized.notifyOnNewMatches,
    externalChannel: undefined,
    updatedAt: now,
  };

  if (existing) {
    await store.update(userId, changes);
  } else {
    await store.create({
      userId,
      preferenceScope: AVAILABLE_DAYS_PREFERENCE_SCOPE,
      ...changes,
      createdAt: now,
    } as Parameters<MemberDaysPreferencePersistence['create']>[0]);
  }

  return sanitized;
}

export async function clearSavedDaysFilters(
  userId: string,
  store: MemberDaysPreferencePersistence = memberDaysPreferenceStore,
): Promise<void> {
  await store.delete(userId);
}

export async function submitSaveDaysFilters(
  formData: FormData,
  userId: string,
  store: MemberDaysPreferencePersistence = memberDaysPreferenceStore,
): Promise<DaysPreferenceActionResult> {
  const savedFilters = await saveSavedDaysFilters(
    userId,
    getSavedDaysFiltersFromFormData(formData),
    store,
  );

  return {
    ok: true,
    savedFilters,
    message: savedFilters
      ? 'Saved this available-days view.'
      : 'Cleared your saved available-days view.',
  };
}

export async function submitClearSavedDaysFilters(
  userId: string,
  store: MemberDaysPreferencePersistence = memberDaysPreferenceStore,
): Promise<DaysPreferenceActionResult> {
  await clearSavedDaysFilters(userId, store);

  return {
    ok: true,
    savedFilters: null,
    message: 'Cleared your saved available-days view.',
  };
}
