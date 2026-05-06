import { normalizeCircuitLabel } from '~/lib/circuit-sources/shared.server';
import type { AvailableDay } from '~/lib/days/types';
import { resolveCanonicalCircuit } from './canonical.server';

export interface CircuitAliasRule {
  aliasKey: string;
  rawCircuit: string;
  rawLayout?: string;
  canonicalCircuit: string;
  canonicalLayout?: string;
}

export function createCircuitAliasKey(circuit: string, layout?: string): string {
  return normalizeCircuitLabel([circuit, layout].filter(Boolean).join(' '))
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function getDayAliasKeys(day: AvailableDay): string[] {
  return [
    createCircuitAliasKey(day.circuit, day.layout),
    createCircuitAliasKey(day.circuit),
    day.circuitName ? createCircuitAliasKey(day.circuitName, day.layout) : undefined,
    day.circuitName ? createCircuitAliasKey(day.circuitName) : undefined,
  ].filter((key): key is string => Boolean(key));
}

export function applyCircuitAliases(
  days: AvailableDay[],
  aliases: CircuitAliasRule[],
): AvailableDay[] {
  if (aliases.length === 0) {
    return days;
  }

  const aliasesByKey = new Map(aliases.map((alias) => [alias.aliasKey, alias]));

  return days.map((day) => {
    const alias = getDayAliasKeys(day)
      .map((key) => aliasesByKey.get(key))
      .find((match): match is CircuitAliasRule => Boolean(match));

    if (!alias) {
      return day;
    }

    const canonical = resolveCanonicalCircuit(alias.canonicalCircuit, alias.canonicalLayout);

    return {
      ...day,
      circuit: canonical.circuitName,
      circuitId: canonical.circuitId,
      circuitName: canonical.circuitName,
      layout: canonical.layout,
      circuitKnown: canonical.known,
    };
  });
}
