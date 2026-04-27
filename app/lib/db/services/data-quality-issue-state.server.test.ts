import { describe, expect, it, vi } from 'vitest';

vi.mock('../entities/data-quality-issue-state.server', () => ({
  DataQualityIssueStateEntity: {},
}));

import type { DataQualityIssueStateRecord } from '../entities/data-quality-issue-state.server';
import {
  DAYS_DATA_QUALITY_ISSUE_SCOPE,
  type DataQualityIssueStatePersistence,
  reopenDataQualityIssue,
  setDataQualityIssueState,
} from './data-quality-issue-state.server';

function createMemoryStore() {
  const items = new Map<string, DataQualityIssueStateRecord>();
  const store: DataQualityIssueStatePersistence = {
    async create(item) {
      items.set(item.issueId, item);
      return item;
    },
    async update(issueId, changes) {
      const current = items.get(issueId);
      if (!current) {
        throw new Error('Issue state not found');
      }

      const updated = { ...current, ...changes };
      items.set(issueId, updated);
      return updated;
    },
    async delete(issueId) {
      items.delete(issueId);
    },
    async get(issueId) {
      return items.get(issueId) ?? null;
    },
    async listAll() {
      return [...items.values()];
    },
  };

  return { items, store };
}

const user = {
  id: 'admin-1',
  name: 'Admin One',
};

describe('data quality issue state service', () => {
  it('creates and updates saved issue state', async () => {
    const memory = createMemoryStore();

    const ignored = await setDataQualityIssueState(
      {
        issueId: 'unknown_circuit:day-1',
        status: 'ignored',
        note: 'Known source typo',
        user,
      },
      memory.store,
    );
    const resolved = await setDataQualityIssueState(
      {
        issueId: 'unknown_circuit:day-1',
        status: 'resolved',
        note: 'Fixed upstream',
        user,
      },
      memory.store,
    );

    expect(ignored.issueScope).toBe(DAYS_DATA_QUALITY_ISSUE_SCOPE);
    expect(resolved).toMatchObject({
      status: 'resolved',
      note: 'Fixed upstream',
      updatedByUserId: 'admin-1',
    });
    expect(memory.items.size).toBe(1);
  });

  it('reopens an issue by deleting saved state', async () => {
    const memory = createMemoryStore();
    await setDataQualityIssueState(
      {
        issueId: 'duplicate_event:day-1',
        status: 'ignored',
        user,
      },
      memory.store,
    );

    await reopenDataQualityIssue('duplicate_event:day-1', memory.store);

    expect(memory.items.size).toBe(0);
  });
});
