import type { User } from '~/lib/auth/schemas';
import { type CircuitAliasRule, createCircuitAliasKey } from '~/lib/circuits/circuit-aliases';
import { CircuitAliasEntity, type CircuitAliasRecord } from '../entities/circuit-alias.server';

export const CIRCUIT_ALIAS_SCOPE = 'circuit-alias';

export interface CircuitAliasInput {
  rawCircuit: string;
  rawLayout?: string;
  canonicalCircuit: string;
  canonicalLayout?: string;
  note?: string;
}

export interface CircuitAliasPersistence {
  put(item: CircuitAliasRecord): Promise<CircuitAliasRecord>;
  delete(aliasKey: string): Promise<void>;
  get(aliasKey: string): Promise<CircuitAliasRecord | null>;
  listAll(): Promise<CircuitAliasRecord[]>;
}

export const circuitAliasStore: CircuitAliasPersistence = {
  async put(item) {
    const record = {
      ...item,
      aliasScope: CIRCUIT_ALIAS_SCOPE,
    };

    await CircuitAliasEntity.put(record).go();
    return record;
  },
  async delete(aliasKey) {
    await CircuitAliasEntity.delete({
      aliasKey,
      aliasScope: CIRCUIT_ALIAS_SCOPE,
    }).go({ response: 'none' });
  },
  async get(aliasKey) {
    const response = await CircuitAliasEntity.get({
      aliasKey,
      aliasScope: CIRCUIT_ALIAS_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await CircuitAliasEntity.query
      .byScope({ aliasScope: CIRCUIT_ALIAS_SCOPE })
      .go();
    return response.data;
  },
};

function sanitizeOptional(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compareAliases(left: CircuitAliasRecord, right: CircuitAliasRecord) {
  if (left.canonicalCircuit !== right.canonicalCircuit) {
    return left.canonicalCircuit.localeCompare(right.canonicalCircuit);
  }

  return left.rawCircuit.localeCompare(right.rawCircuit);
}

export function toCircuitAliasRule(record: CircuitAliasRecord): CircuitAliasRule {
  return {
    aliasKey: record.aliasKey,
    rawCircuit: record.rawCircuit,
    rawLayout: record.rawLayout,
    canonicalCircuit: record.canonicalCircuit,
    canonicalLayout: record.canonicalLayout,
  };
}

export async function listCircuitAliases(
  store: CircuitAliasPersistence = circuitAliasStore,
): Promise<CircuitAliasRecord[]> {
  const aliases = await store.listAll();
  return aliases.toSorted(compareAliases);
}

export async function listCircuitAliasRules(
  store: CircuitAliasPersistence = circuitAliasStore,
): Promise<CircuitAliasRule[]> {
  return (await listCircuitAliases(store)).map(toCircuitAliasRule);
}

export async function upsertCircuitAlias(
  input: CircuitAliasInput,
  user: Pick<User, 'id'>,
  store: CircuitAliasPersistence = circuitAliasStore,
): Promise<CircuitAliasRecord> {
  const rawCircuit = input.rawCircuit.trim();
  const rawLayout = sanitizeOptional(input.rawLayout);
  const canonicalCircuit = input.canonicalCircuit.trim();
  const canonicalLayout = sanitizeOptional(input.canonicalLayout);
  const aliasKey = createCircuitAliasKey(rawCircuit, rawLayout);
  const existing = await store.get(aliasKey);
  const now = new Date().toISOString();

  return store.put({
    aliasKey,
    aliasScope: CIRCUIT_ALIAS_SCOPE,
    rawCircuit,
    rawLayout,
    canonicalCircuit,
    canonicalLayout,
    note: sanitizeOptional(input.note),
    createdByUserId: existing?.createdByUserId ?? user.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as CircuitAliasRecord);
}

export async function deleteCircuitAlias(
  aliasKey: string,
  store: CircuitAliasPersistence = circuitAliasStore,
): Promise<void> {
  await store.delete(aliasKey);
}
