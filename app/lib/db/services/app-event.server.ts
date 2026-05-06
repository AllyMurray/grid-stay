import { ulid } from 'ulid';
import { AppEventEntity, type AppEventRecord } from '../entities/app-event.server';

export const APP_EVENT_SCOPE = 'app';

export interface AppEventInput {
  category: AppEventRecord['category'];
  severity?: AppEventRecord['severity'];
  action: string;
  message: string;
  actor?: {
    userId?: string;
    name?: string;
  };
  subject?: {
    type?: string;
    id?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface AppEvent extends Omit<AppEventRecord, 'metadataJson'> {
  metadata?: Record<string, unknown>;
}

export interface AppEventPersistence {
  create(item: AppEventRecord): Promise<AppEventRecord>;
  listAll(): Promise<AppEventRecord[]>;
}

export const appEventStore: AppEventPersistence = {
  async create(item) {
    await AppEventEntity.create(item).go({ response: 'none' });
    return item;
  },
  async listAll() {
    const response = await AppEventEntity.query.byScope({ eventScope: APP_EVENT_SCOPE }).go();
    return response.data;
  },
};

function serializeMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata || Object.keys(metadata).length === 0) {
    return undefined;
  }

  return JSON.stringify(metadata);
}

function parseMetadata(metadataJson: string | undefined): Record<string, unknown> | undefined {
  if (!metadataJson) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function toEvent(record: AppEventRecord): AppEvent {
  const { metadataJson, ...event } = record;
  const metadata = parseMetadata(metadataJson);
  return metadata ? { ...event, metadata } : event;
}

function sortNewestFirst(left: AppEventRecord, right: AppEventRecord) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.eventId.localeCompare(left.eventId);
}

function createRecord(input: AppEventInput): AppEventRecord {
  return {
    eventId: ulid(),
    eventScope: APP_EVENT_SCOPE,
    category: input.category,
    severity: input.severity ?? (input.category === 'error' ? 'error' : 'info'),
    action: input.action,
    message: input.message,
    actorUserId: input.actor?.userId,
    actorName: input.actor?.name,
    subjectType: input.subject?.type,
    subjectId: input.subject?.id,
    metadataJson: serializeMetadata(input.metadata),
    createdAt: input.createdAt ?? new Date().toISOString(),
  } as AppEventRecord;
}

export async function recordAppEvent(
  input: AppEventInput,
  store: AppEventPersistence = appEventStore,
): Promise<AppEvent> {
  return toEvent(await store.create(createRecord(input)));
}

export async function recordAppEventSafely(
  input: AppEventInput,
  store: AppEventPersistence = appEventStore,
): Promise<void> {
  try {
    await recordAppEvent(input, store);
  } catch (error) {
    console.error('Failed to record app event', {
      action: input.action,
      error,
    });
  }
}

export async function listRecentAppEvents(
  limit = 100,
  store: AppEventPersistence = appEventStore,
): Promise<AppEvent[]> {
  const records = await store.listAll();
  return records.toSorted(sortNewestFirst).slice(0, limit).map(toEvent);
}
