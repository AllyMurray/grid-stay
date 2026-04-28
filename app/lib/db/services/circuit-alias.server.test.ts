import { describe, expect, it, vi } from 'vitest';
import type { CircuitAliasRecord } from '../entities/circuit-alias.server';
import {
  type CircuitAliasPersistence,
  listCircuitAliasRules,
  upsertCircuitAlias,
} from './circuit-alias.server';

vi.mock('../entities/circuit-alias.server', () => ({
  CircuitAliasEntity: {},
}));

function createMemoryStore(): CircuitAliasPersistence {
  const records = new Map<string, CircuitAliasRecord>();

  return {
    async put(item) {
      records.set(item.aliasKey, item);
      return item;
    },
    async delete(aliasKey) {
      records.delete(aliasKey);
    },
    async get(aliasKey) {
      return records.get(aliasKey) ?? null;
    },
    async listAll() {
      return [...records.values()];
    },
  };
}

describe('circuit alias service', () => {
  it('upserts aliases with normalized keys and exports alias rules', async () => {
    const store = createMemoryStore();

    const alias = await upsertCircuitAlias(
      {
        rawCircuit: ' Sntterton ',
        rawLayout: '300',
        canonicalCircuit: 'Snetterton',
        canonicalLayout: '300',
      },
      { id: 'admin-1' },
      store,
    );

    expect(alias).toMatchObject({
      aliasKey: 'snetterton-300',
      rawCircuit: 'Sntterton',
      canonicalCircuit: 'Snetterton',
    });
    await expect(listCircuitAliasRules(store)).resolves.toEqual([
      {
        aliasKey: 'snetterton-300',
        rawCircuit: 'Sntterton',
        rawLayout: '300',
        canonicalCircuit: 'Snetterton',
        canonicalLayout: '300',
      },
    ]);
  });
});
