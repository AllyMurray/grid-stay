import { describe, expect, it } from 'vite-plus/test';
import { applyDayMerges } from './day-merges';
import type { AvailableDay } from './types';

function createDay(dayId: string): AvailableDay {
  return {
    dayId,
    date: '2026-05-10',
    type: 'race_day',
    circuit: 'Snetterton',
    provider: 'Caterham Motorsport',
    description: dayId,
    source: {
      sourceType: 'caterham',
      sourceName: 'caterham',
    },
  };
}

describe('day merges', () => {
  it('hides source days only when the target day exists', () => {
    expect(
      applyDayMerges(
        [createDay('source'), createDay('target')],
        [
          { sourceDayId: 'source', targetDayId: 'target' },
          { sourceDayId: 'missing-source', targetDayId: 'missing-target' },
        ],
      ).map((day) => day.dayId),
    ).toEqual(['target']);
  });
});
