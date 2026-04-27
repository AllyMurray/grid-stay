import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { loadDaysDataQualityReport } from './data-quality.server';

describe('loadDaysDataQualityReport', () => {
  it('flags missing canonical fields, unknown circuits, layout text, and duplicates', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-27T12:00:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'legacy-snetterton',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Sntterton 300',
          provider: 'Caterham Motorsport',
          description: 'Caterham Academy • Round 1',
          source: { sourceType: 'caterham', sourceName: 'caterham' },
        },
        {
          dayId: 'unknown',
          date: '2026-05-12',
          type: 'track_day',
          circuit: 'Example Circuit',
          circuitName: 'Example Circuit',
          circuitKnown: false,
          provider: 'Unknown Provider',
          description: 'Open pit lane',
          source: { sourceType: 'manual', sourceName: 'manual' },
        },
        {
          dayId: 'dup-a',
          date: '2026-05-14',
          type: 'track_day',
          circuit: 'Brands Hatch',
          circuitId: 'brands-hatch',
          circuitName: 'Brands Hatch',
          layout: 'Indy',
          circuitKnown: true,
          provider: 'MSV Trackdays',
          description: 'Evening',
          source: { sourceType: 'trackdays', sourceName: 'msv-trackday' },
        },
        {
          dayId: 'dup-b',
          date: '2026-05-14',
          type: 'track_day',
          circuit: 'Brands Hatch',
          circuitId: 'brands-hatch',
          circuitName: 'Brands Hatch',
          layout: 'Indy',
          circuitKnown: true,
          provider: 'MSV Trackdays',
          description: 'Evening',
          source: { sourceType: 'trackdays', sourceName: 'msv-trackday' },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);

    const report = await loadDaysDataQualityReport();

    expect(report).toMatchObject({
      refreshedAt: '2026-04-27T12:00:00.000Z',
      dayCount: 4,
      issueCount: 5,
    });
    expect(report.issues.map((issue) => [issue.dayId, issue.type])).toEqual([
      ['legacy-snetterton', 'layout_in_circuit_name'],
      ['legacy-snetterton', 'missing_canonical_fields'],
      ['unknown', 'unknown_circuit'],
      ['dup-a', 'duplicate_event'],
      ['dup-b', 'duplicate_event'],
    ]);
  });
});
