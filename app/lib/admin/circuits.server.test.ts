import { describe, expect, it, vi } from 'vite-plus/test';
import type { AvailableDay } from '~/lib/days/types';
import type { CircuitAliasRecord } from '~/lib/db/entities/circuit-alias.server';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/circuit-alias.server', () => ({
  deleteCircuitAlias: vi.fn(),
  listCircuitAliases: vi.fn(),
  upsertCircuitAlias: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

import { loadAdminCircuitsReport, submitAdminCircuitAction } from './circuits.server';

const day: AvailableDay = {
  dayId: 'day-1',
  date: '2026-05-10',
  type: 'race_day',
  circuit: 'Snetterton 300',
  provider: 'Caterham Motorsport',
  description: 'Caterham Academy',
  source: {
    sourceType: 'caterham',
    sourceName: 'caterham',
  },
};

describe('admin circuit helpers', () => {
  it('summarizes current circuit labels and aliases', async () => {
    const report = await loadAdminCircuitsReport(
      async () => ({
        days: [day],
        errors: [],
        refreshedAt: '2026-04-27T10:00:00.000Z',
      }),
      async () => [],
      async () => [
        {
          aliasKey: 'sntterton-300',
          rawCircuit: 'Sntterton 300',
          canonicalCircuit: 'Snetterton',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        } as CircuitAliasRecord,
      ],
    );

    expect(report.circuits).toEqual([
      expect.objectContaining({
        circuit: 'Snetterton',
        layout: '300',
        circuitKnown: true,
        dayCount: 1,
      }),
    ]);
    expect(report.aliases).toHaveLength(1);
    expect(report.unknownCircuitCount).toBe(0);
  });

  it('validates and saves circuit aliases', async () => {
    const formData = new FormData();
    formData.set('intent', 'saveAlias');
    formData.set('rawCircuit', ' Sntterton 300 ');
    formData.set('canonicalCircuit', ' Snetterton ');
    const saveAlias = vi.fn(async () => ({
      aliasKey: 'snetterton-300',
      rawCircuit: 'Sntterton 300',
      canonicalCircuit: 'Snetterton',
    }));

    const result = await submitAdminCircuitAction(
      formData,
      { id: 'admin-1' },
      { saveAlias: saveAlias as never },
    );

    expect(result).toMatchObject({
      ok: true,
      message: 'Circuit alias saved.',
    });
    expect(saveAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        rawCircuit: 'Sntterton 300',
        canonicalCircuit: 'Snetterton',
      }),
      { id: 'admin-1' },
    );
  });

  it('deletes circuit aliases by key', async () => {
    const formData = new FormData();
    formData.set('intent', 'deleteAlias');
    formData.set('aliasKey', 'snetterton-300');
    const removeAlias = vi.fn(async () => undefined);

    const result = await submitAdminCircuitAction(formData, { id: 'admin-1' }, { removeAlias });

    expect(result).toEqual({
      ok: true,
      message: 'Circuit alias removed.',
    });
    expect(removeAlias).toHaveBeenCalledWith('snetterton-300');
  });
});
