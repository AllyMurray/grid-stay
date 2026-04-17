import { describe, expect, it } from 'vitest';
import {
  buildRaceSeriesSummaryByDayId,
  getRaceSeriesDaysForDay,
} from './series.server';
import type { AvailableDay } from './types';

const manualSeriesDays: AvailableDay[] = [
  {
    dayId: 'manual:academy-1',
    date: '2026-04-12',
    type: 'race_day',
    circuit: 'Snetterton',
    provider: 'Caterham Motorsport',
    description: 'Academy Round 1',
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: 'manual-1',
      metadata: {
        series: 'Caterham Academy',
      },
    },
  },
  {
    dayId: 'manual:academy-2',
    date: '2026-05-17',
    type: 'race_day',
    circuit: 'Brands Hatch',
    provider: 'Caterham Motorsport',
    description: 'Academy Round 2',
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: 'manual-2',
      metadata: {
        series: 'Caterham Academy',
      },
    },
  },
  {
    dayId: 'manual:test-day',
    date: '2026-04-01',
    type: 'test_day',
    circuit: 'Donington Park',
    provider: 'Caterham Motorsport',
    description: 'Official test day',
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: 'manual-3',
      metadata: {
        series: 'Caterham Academy',
      },
    },
  },
];

describe('manual race series helpers', () => {
  it('groups manual race days by series name', () => {
    const summaries = buildRaceSeriesSummaryByDayId(manualSeriesDays, [
      'manual:academy-1',
    ]);

    expect(summaries['manual:academy-1']).toEqual({
      name: 'Caterham Academy',
      totalCount: 2,
      existingBookingCount: 1,
    });
    expect(summaries['manual:academy-2']).toEqual({
      name: 'Caterham Academy',
      totalCount: 2,
      existingBookingCount: 1,
    });
    expect(summaries['manual:test-day']).toBeUndefined();
  });

  it('returns the linked manual race days for the selected round', () => {
    const series = getRaceSeriesDaysForDay(
      manualSeriesDays,
      'manual:academy-2',
    );

    expect(series).toEqual({
      seriesName: 'Caterham Academy',
      days: [manualSeriesDays[0]!, manualSeriesDays[1]!],
    });
  });
});
