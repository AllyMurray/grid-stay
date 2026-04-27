import type { User } from '~/lib/auth/schemas';
import {
  DataQualityIssueStateEntity,
  type DataQualityIssueStateRecord,
} from '../entities/data-quality-issue-state.server';

export const DAYS_DATA_QUALITY_ISSUE_SCOPE = 'days';

export interface DataQualityIssueStatePersistence {
  create(
    item: DataQualityIssueStateRecord,
  ): Promise<DataQualityIssueStateRecord>;
  update(
    issueId: string,
    changes: Partial<DataQualityIssueStateRecord>,
  ): Promise<DataQualityIssueStateRecord>;
  delete(issueId: string): Promise<void>;
  get(issueId: string): Promise<DataQualityIssueStateRecord | null>;
  listAll(): Promise<DataQualityIssueStateRecord[]>;
}

export const dataQualityIssueStateStore: DataQualityIssueStatePersistence = {
  async create(item) {
    const record = {
      ...item,
      issueScope: DAYS_DATA_QUALITY_ISSUE_SCOPE,
    };

    await DataQualityIssueStateEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(issueId, changes) {
    const updated = await DataQualityIssueStateEntity.patch({
      issueId,
      issueScope: DAYS_DATA_QUALITY_ISSUE_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(issueId) {
    await DataQualityIssueStateEntity.delete({
      issueId,
      issueScope: DAYS_DATA_QUALITY_ISSUE_SCOPE,
    }).go({ response: 'none' });
  },
  async get(issueId) {
    const response = await DataQualityIssueStateEntity.get({
      issueId,
      issueScope: DAYS_DATA_QUALITY_ISSUE_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await DataQualityIssueStateEntity.query
      .byScope({ issueScope: DAYS_DATA_QUALITY_ISSUE_SCOPE })
      .go();
    return response.data;
  },
};

function sanitizeNote(value: FormDataEntryValue | string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function setDataQualityIssueState(
  input: {
    issueId: string;
    status: DataQualityIssueStateRecord['status'];
    note?: string;
    user: Pick<User, 'id' | 'name'>;
  },
  store: DataQualityIssueStatePersistence = dataQualityIssueStateStore,
): Promise<DataQualityIssueStateRecord> {
  const existing = await store.get(input.issueId);
  const now = new Date().toISOString();
  const changes = {
    status: input.status,
    note: sanitizeNote(input.note ?? null) || undefined,
    updatedByUserId: input.user.id,
    updatedByName: input.user.name,
    updatedAt: now,
  };

  if (existing) {
    return store.update(input.issueId, changes);
  }

  return store.create({
    issueId: input.issueId,
    issueScope: DAYS_DATA_QUALITY_ISSUE_SCOPE,
    ...changes,
    createdAt: now,
  } as DataQualityIssueStateRecord);
}

export async function reopenDataQualityIssue(
  issueId: string,
  store: DataQualityIssueStatePersistence = dataQualityIssueStateStore,
): Promise<void> {
  await store.delete(issueId);
}

export async function listDataQualityIssueStates(
  store: DataQualityIssueStatePersistence = dataQualityIssueStateStore,
): Promise<DataQualityIssueStateRecord[]> {
  return store.listAll();
}
