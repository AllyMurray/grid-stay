import {
  countWhatsNewEntriesAfter,
  type WhatsNewEntry,
  whatsNewEntries,
} from '~/lib/whats-new';
import {
  WhatsNewViewEntity,
  type WhatsNewViewRecord,
} from '../entities/whats-new-view.server';

export const WHATS_NEW_VIEW_SCOPE = 'whats-new';

export interface WhatsNewViewPersistence {
  put(item: WhatsNewViewRecord): Promise<WhatsNewViewRecord>;
  getByUser(userId: string): Promise<WhatsNewViewRecord | null>;
  listAll(): Promise<WhatsNewViewRecord[]>;
}

export interface WhatsNewViewDependencies {
  store?: WhatsNewViewPersistence;
  entries?: WhatsNewEntry[];
}

export const whatsNewViewStore: WhatsNewViewPersistence = {
  async put(item) {
    const record = {
      ...item,
      viewScope: WHATS_NEW_VIEW_SCOPE,
    };

    await WhatsNewViewEntity.put(record).go();
    return record;
  },
  async getByUser(userId) {
    const response = await WhatsNewViewEntity.get({
      userId,
      viewScope: WHATS_NEW_VIEW_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await WhatsNewViewEntity.scan.go();
    return response.data.filter(
      (record) => record.viewScope === WHATS_NEW_VIEW_SCOPE,
    );
  },
};

export async function countNewWhatsNewEntries(
  userId: string,
  dependencies: WhatsNewViewDependencies = {},
): Promise<number> {
  const store = dependencies.store ?? whatsNewViewStore;
  const entries = dependencies.entries ?? whatsNewEntries;
  const view = await store.getByUser(userId);

  return countWhatsNewEntriesAfter(view?.lastViewedAt, entries);
}

export async function markWhatsNewViewed(
  userId: string,
  dependencies: WhatsNewViewDependencies = {},
  viewedAt = new Date().toISOString(),
): Promise<WhatsNewViewRecord> {
  const store = dependencies.store ?? whatsNewViewStore;
  const existing = await store.getByUser(userId);

  return store.put({
    userId,
    viewScope: WHATS_NEW_VIEW_SCOPE,
    lastViewedAt: viewedAt,
    createdAt: existing?.createdAt ?? viewedAt,
    updatedAt: viewedAt,
  } as WhatsNewViewRecord);
}
