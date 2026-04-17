import { describe, expect, it } from 'vitest';
import {
  buildRaceSeriesSummaryByDayId,
  getRaceSeriesDaysForDay,
} from './series.server';
import type { AvailableDay } from './types';

const linkedSeriesDays: AvailableDay[] = [
  {
    dayId: 'race:academy-1',
    date: '2026-04-12',
    type: 'race_day',
    circuit: 'Snetterton',
    provider: 'Caterham Motorsport',
    description: 'Academy Round 1',
    source: {
      sourceType: 'caterham',
      sourceName: 'caterham',
      externalId: 'round-1',
      metadata: {
        series: 'Caterham Academy',
      },
    },
  },
  {
    dayId: 'race:academy-2',
    date: '2026-05-17',
    type: 'race_day',
    circuit: 'Brands Hatch',
    provider: 'Caterham Motorsport',
    description: 'Academy Round 2',
    source: {
      sourceType: 'caterham',
      sourceName: 'caterham',
      externalId: 'round-2',
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
  it('includes linked manual extra days in the series summary map', () => {
    const summaries = buildRaceSeriesSummaryByDayId(linkedSeriesDays, [
      'race:academy-1',
    ]);

    expect(summaries['race:academy-1']).toEqual({
      name: 'Caterham Academy',
      totalCount: 3,
      existingBookingCount: 1,
    });
    expect(summaries['race:academy-2']).toEqual({
      name: 'Caterham Academy',
      totalCount: 3,
      existingBookingCount: 1,
    });
    expect(summaries['manual:test-day']).toEqual({
      name: 'Caterham Academy',
      totalCount: 3,
      existingBookingCount: 1,
    });
  });

  it('returns every linked event when the selected day is a linked manual extra day', () => {
    const series = getRaceSeriesDaysForDay(linkedSeriesDays, 'manual:test-day');

    expect(series).toEqual({
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      days: [linkedSeriesDays[2]!, linkedSeriesDays[0]!, linkedSeriesDays[1]!],
    });
  });
});
