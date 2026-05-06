import { describe, expect, it } from 'vite-plus/test';
import type { AvailableDay } from '~/lib/days/types';
import { applyCircuitAliases, createCircuitAliasKey } from './circuit-aliases';

const day: AvailableDay = {
  dayId: 'day-1',
  date: '2026-05-10',
  type: 'race_day',
  circuit: 'Example Circuit',
  provider: 'Example Provider',
  description: 'Race day',
  source: {
    sourceType: 'caterham',
    sourceName: 'caterham',
  },
};

describe('circuit aliases', () => {
  it('creates stable normalized alias keys', () => {
    expect(createCircuitAliasKey(' Sntterton ', '300')).toBe('snetterton-300');
  });

  it('applies aliases to available days with canonical circuit details', () => {
    expect(
      applyCircuitAliases(
        [day],
        [
          {
            aliasKey: createCircuitAliasKey('Example Circuit'),
            rawCircuit: 'Example Circuit',
            canonicalCircuit: 'Snetterton',
            canonicalLayout: '300',
          },
        ],
      ),
    ).toEqual([
      expect.objectContaining({
        circuit: 'Snetterton',
        circuitId: 'snetterton',
        circuitName: 'Snetterton',
        layout: '300',
        circuitKnown: true,
      }),
    ]);
  });
});
