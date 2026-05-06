import { describe, expect, it, vi } from 'vite-plus/test';
import type { MemberDaysPreferenceRecord } from '~/lib/db/entities/member-days-preference.server';
import type { MemberDaysPreferencePersistence } from '~/lib/db/services/member-days-preference.server';

vi.mock('~/lib/db/services/member-days-preference.server', () => ({
  AVAILABLE_DAYS_PREFERENCE_SCOPE: 'available-days-filters',
  memberDaysPreferenceStore: {},
}));

import {
  getSavedDaysFilters,
  getSavedDaysFiltersFromFormData,
  saveSavedDaysFilters,
} from './preferences.server';

function createStore(
  existing: MemberDaysPreferenceRecord | null = null,
): MemberDaysPreferencePersistence {
  return {
    create: vi.fn(async (item) => item),
    update: vi.fn(async (_userId, changes) => ({
      ...(existing as MemberDaysPreferenceRecord),
      ...changes,
    })),
    delete: vi.fn(async () => undefined),
    getByUser: vi.fn(async () => existing),
    listAll: vi.fn(async () => (existing ? [existing] : [])),
  };
}

describe('available-days preferences', () => {
  it('normalizes saved filters from form data', () => {
    const formData = new FormData();
    formData.set('month', ' 2026-05 ');
    formData.set('series', ' caterham-academy ');
    formData.append('circuit', 'Sntterton 300');
    formData.append('circuit', 'Snetterton');
    formData.set('provider', ' Caterham Motorsport ');
    formData.set('type', 'not-a-day-type');

    expect(getSavedDaysFiltersFromFormData(formData)).toEqual({
      month: '2026-05',
      series: 'caterham-academy',
      circuits: ['Snetterton'],
      provider: 'Caterham Motorsport',
      type: '',
      notifyOnNewMatches: false,
      externalChannel: '',
    });
  });

  it('normalizes notification filter settings from form data', () => {
    const formData = new FormData();
    formData.set('month', '2026-05');
    formData.set('notifyOnNewMatches', 'on');

    expect(getSavedDaysFiltersFromFormData(formData)).toEqual({
      month: '2026-05',
      series: '',
      circuits: [],
      provider: '',
      type: '',
      notifyOnNewMatches: true,
      externalChannel: '',
    });
  });

  it('normalizes the saved show-past view flag from form data', () => {
    const formData = new FormData();
    formData.set('showPast', 'true');

    expect(getSavedDaysFiltersFromFormData(formData)).toEqual({
      month: '',
      series: '',
      circuits: [],
      provider: '',
      type: '',
      showPast: true,
      notifyOnNewMatches: false,
      externalChannel: '',
    });
  });

  it('creates a separate preference record for non-empty filters', async () => {
    const store = createStore();

    const result = await saveSavedDaysFilters(
      'user-1',
      {
        month: '2026-05',
        series: 'caterham-academy',
        circuits: ['Sntterton 300', 'Brands Hatch Indy'],
        provider: 'Caterham Motorsport',
        type: 'race_day',
        showPast: true,
        notifyOnNewMatches: true,
        externalChannel: '',
      },
      store,
    );

    expect(result).toEqual({
      month: '2026-05',
      series: 'caterham-academy',
      circuits: ['Brands Hatch', 'Snetterton'],
      provider: 'Caterham Motorsport',
      type: 'race_day',
      showPast: true,
      notifyOnNewMatches: true,
      externalChannel: '',
    });
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        preferenceScope: 'available-days-filters',
        month: '2026-05',
        series: 'caterham-academy',
        circuits: ['Brands Hatch', 'Snetterton'],
        provider: 'Caterham Motorsport',
        dayType: 'race_day',
        showPast: true,
        notifyOnNewMatches: true,
        externalChannel: undefined,
      }),
    );
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('deletes the preference record when the saved filters are empty', async () => {
    const store = createStore();

    const result = await saveSavedDaysFilters(
      'user-1',
      {
        month: '',
        series: '',
        circuits: [],
        provider: '',
        type: '',
        notifyOnNewMatches: true,
        externalChannel: '',
      },
      store,
    );

    expect(result).toBeNull();
    expect(store.delete).toHaveBeenCalledWith('user-1');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('returns null for empty stored preference records', async () => {
    const store = createStore({
      userId: 'user-1',
      preferenceScope: 'available-days-filters',
      circuits: [],
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    } as MemberDaysPreferenceRecord);

    await expect(getSavedDaysFilters('user-1', store)).resolves.toBeNull();
  });

  it('returns stored notification settings with saved filters', async () => {
    const store = createStore({
      userId: 'user-1',
      preferenceScope: 'available-days-filters',
      month: '2026-05',
      circuits: [],
      notifyOnNewMatches: true,
      externalChannel: 'email',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    } as MemberDaysPreferenceRecord);

    await expect(getSavedDaysFilters('user-1', store)).resolves.toEqual({
      month: '2026-05',
      series: '',
      circuits: [],
      provider: '',
      type: '',
      notifyOnNewMatches: true,
      externalChannel: '',
    });
  });
});
