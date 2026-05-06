import { z } from 'zod';
import type { User } from '~/lib/auth/schemas';
import { normalizeAvailableDayCircuit } from '~/lib/days/aggregation.server';
import type { AvailableDay } from '~/lib/days/types';
import type { CircuitAliasRecord } from '~/lib/db/entities/circuit-alias.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  deleteCircuitAlias,
  listCircuitAliases,
  upsertCircuitAlias,
} from '~/lib/db/services/circuit-alias.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';

const CircuitAliasSchema = z.object({
  rawCircuit: z.string().trim().min(1, 'Enter the source circuit label.'),
  rawLayout: z.string().trim().optional().default(''),
  canonicalCircuit: z.string().trim().min(1, 'Enter the canonical circuit.'),
  canonicalLayout: z.string().trim().optional().default(''),
  note: z.string().trim().max(200).optional().default(''),
});

const DeleteCircuitAliasSchema = z.object({
  aliasKey: z.string().trim().min(1),
});

type CircuitAliasField =
  | 'rawCircuit'
  | 'rawLayout'
  | 'canonicalCircuit'
  | 'canonicalLayout'
  | 'note'
  | 'aliasKey';

export interface AdminCircuitOption {
  circuit: string;
  layout?: string;
  circuitKnown: boolean;
  dayCount: number;
  providers: string[];
}

export interface AdminCircuitsReport {
  circuits: AdminCircuitOption[];
  aliases: CircuitAliasRecord[];
  unknownCircuitCount: number;
}

export type AdminCircuitActionResult =
  | {
      ok: true;
      message: string;
      alias?: CircuitAliasRecord;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<CircuitAliasField, string[] | undefined>>;
    };

export interface AdminCircuitActionDependencies {
  saveAlias?: typeof upsertCircuitAlias;
  removeAlias?: typeof deleteCircuitAlias;
}

function compareCircuitOptions(left: AdminCircuitOption, right: AdminCircuitOption) {
  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }

  return (left.layout ?? '').localeCompare(right.layout ?? '');
}

function createCircuitOptionKey(day: AvailableDay) {
  return [day.circuit, day.layout ?? ''].join('|');
}

function summarizeCircuits(days: AvailableDay[]): AdminCircuitOption[] {
  const optionsByKey = new Map<string, AdminCircuitOption>();

  for (const day of days.map(normalizeAvailableDayCircuit)) {
    const key = createCircuitOptionKey(day);
    const current = optionsByKey.get(key);

    if (current) {
      current.dayCount += 1;
      if (!current.providers.includes(day.provider)) {
        current.providers.push(day.provider);
        current.providers.sort();
      }
      continue;
    }

    optionsByKey.set(key, {
      circuit: day.circuit,
      layout: day.layout,
      circuitKnown: day.circuitKnown ?? false,
      dayCount: 1,
      providers: [day.provider],
    });
  }

  return [...optionsByKey.values()].toSorted(compareCircuitOptions);
}

function formError(
  formErrorMessage: string,
  fieldErrors: Partial<Record<CircuitAliasField, string[] | undefined>> = {},
): AdminCircuitActionResult {
  return {
    ok: false,
    formError: formErrorMessage,
    fieldErrors,
  };
}

export async function loadAdminCircuitsReport(
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
  loadAliases: typeof listCircuitAliases = listCircuitAliases,
): Promise<AdminCircuitsReport> {
  const [snapshot, manualDays, aliases] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
    loadAliases(),
  ]);
  const circuits = summarizeCircuits([...(snapshot?.days ?? []), ...manualDays]);

  return {
    circuits,
    aliases,
    unknownCircuitCount: circuits.filter((circuit) => !circuit.circuitKnown).length,
  };
}

export async function submitAdminCircuitAction(
  formData: FormData,
  user: Pick<User, 'id'>,
  dependencies: AdminCircuitActionDependencies = {},
): Promise<AdminCircuitActionResult> {
  const intent = formData.get('intent');

  if (intent === 'deleteAlias') {
    const parsed = DeleteCircuitAliasSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return formError('Could not remove this circuit alias.', parsed.error.flatten().fieldErrors);
    }

    await (dependencies.removeAlias ?? deleteCircuitAlias)(parsed.data.aliasKey);

    return {
      ok: true,
      message: 'Circuit alias removed.',
    };
  }

  if (intent !== 'saveAlias') {
    return formError('This circuit action is not supported.');
  }

  const parsed = CircuitAliasSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return formError('Could not save this circuit alias.', parsed.error.flatten().fieldErrors);
  }

  const alias = await (dependencies.saveAlias ?? upsertCircuitAlias)(parsed.data, user);

  return {
    ok: true,
    message: 'Circuit alias saved.',
    alias,
  };
}
