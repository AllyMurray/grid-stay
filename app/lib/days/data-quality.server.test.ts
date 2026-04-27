import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/data-quality-issue-state.server', () => ({
  listDataQualityIssueStates: vi.fn(async () => []),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listDataQualityIssueStates } from '~/lib/db/services/data-quality-issue-state.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import {
  loadDaysDataQualityReport,
  submitDataQualityIssueStateAction,
} from './data-quality.server';

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
    vi.mocked(listDataQualityIssueStates).mockResolvedValue([]);

    const report = await loadDaysDataQualityReport();

    expect(report).toMatchObject({
      refreshedAt: '2026-04-27T12:00:00.000Z',
      dayCount: 4,
      issueCount: 5,
      openIssueCount: 5,
      ignoredIssueCount: 0,
      resolvedIssueCount: 0,
    });
    expect(
      report.issues.map((issue) => [issue.issueId, issue.dayId, issue.type]),
    ).toEqual([
      [
        'layout_in_circuit_name:legacy-snetterton',
        'legacy-snetterton',
        'layout_in_circuit_name',
      ],
      [
        'missing_canonical_fields:legacy-snetterton',
        'legacy-snetterton',
        'missing_canonical_fields',
      ],
      ['unknown_circuit:unknown', 'unknown', 'unknown_circuit'],
      ['duplicate_event:dup-a', 'dup-a', 'duplicate_event'],
      ['duplicate_event:dup-b', 'dup-b', 'duplicate_event'],
    ]);
  });

  it('applies saved issue states to current issues', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-27T12:00:00.000Z',
      errors: [],
      days: [
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
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listDataQualityIssueStates).mockResolvedValue([
      {
        issueId: 'unknown_circuit:unknown',
        issueScope: 'days',
        status: 'ignored',
        note: 'Known test venue',
        updatedByUserId: 'admin-1',
        updatedByName: 'Admin One',
        createdAt: '2026-04-27T11:00:00.000Z',
        updatedAt: '2026-04-27T11:00:00.000Z',
      },
    ]);

    const report = await loadDaysDataQualityReport();

    expect(report.issueCount).toBe(0);
    expect(report.ignoredIssueCount).toBe(1);
    expect(report.issues[0]).toMatchObject({
      status: 'ignored',
      stateNote: 'Known test venue',
      stateUpdatedByName: 'Admin One',
    });
  });

  it('submits saved issue state actions', async () => {
    const formData = new FormData();
    const saveState = vi.fn(async () => ({
      issueId: 'unknown_circuit:unknown',
      issueScope: 'days',
      status: 'ignored' as const,
      updatedByUserId: 'admin-1',
      updatedByName: 'Admin One',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    }));
    const reopenIssue = vi.fn();

    formData.set('intent', 'ignoreIssue');
    formData.set('issueId', 'unknown_circuit:unknown');
    formData.set('note', 'Known venue');

    await expect(
      submitDataQualityIssueStateAction(
        formData,
        { id: 'admin-1', name: 'Admin One' },
        saveState,
        reopenIssue,
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 'ignored',
    });
    expect(saveState).toHaveBeenCalledWith({
      issueId: 'unknown_circuit:unknown',
      status: 'ignored',
      note: 'Known venue',
      user: { id: 'admin-1', name: 'Admin One' },
    });
  });

  it('submits issue reopen actions', async () => {
    const formData = new FormData();
    const saveState = vi.fn();
    const reopenIssue = vi.fn();

    formData.set('intent', 'reopenIssue');
    formData.set('issueId', 'duplicate_event:day-1');

    await expect(
      submitDataQualityIssueStateAction(
        formData,
        { id: 'admin-1', name: 'Admin One' },
        saveState,
        reopenIssue,
      ),
    ).resolves.toMatchObject({
      ok: true,
      status: 'open',
    });
    expect(reopenIssue).toHaveBeenCalledWith('duplicate_event:day-1');
  });
});
