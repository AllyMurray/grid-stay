import {
  SeriesSubscriptionEntity,
  type SeriesSubscriptionRecord,
} from '../entities/series-subscription.server';

export interface SeriesSubscriptionPersistence {
  create(item: SeriesSubscriptionRecord): Promise<SeriesSubscriptionRecord>;
  update(
    userId: string,
    seriesKey: string,
    changes: Partial<SeriesSubscriptionRecord>,
  ): Promise<SeriesSubscriptionRecord>;
  getByUserAndSeries(
    userId: string,
    seriesKey: string,
  ): Promise<SeriesSubscriptionRecord | null>;
  listBySeries(seriesKey: string): Promise<SeriesSubscriptionRecord[]>;
}

export const seriesSubscriptionStore: SeriesSubscriptionPersistence = {
  async create(item) {
    await SeriesSubscriptionEntity.create(item).go({
      response: 'none',
    });
    return item;
  },
  async update(userId, seriesKey, changes) {
    const updated = await SeriesSubscriptionEntity.patch({ userId, seriesKey })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async getByUserAndSeries(userId, seriesKey) {
    const response = await SeriesSubscriptionEntity.get({
      userId,
      seriesKey,
    }).go();
    return response.data ?? null;
  },
  async listBySeries(seriesKey) {
    const response = await SeriesSubscriptionEntity.query
      .bySeries({
        seriesKey,
      })
      .go();
    return response.data;
  },
};

export async function upsertSeriesSubscription(
  input: {
    userId: string;
    seriesKey: string;
    seriesName: string;
    status: 'booked' | 'maybe';
  },
  store: SeriesSubscriptionPersistence = seriesSubscriptionStore,
): Promise<SeriesSubscriptionRecord> {
  const existing = await store.getByUserAndSeries(
    input.userId,
    input.seriesKey,
  );
  const now = new Date().toISOString();

  if (existing) {
    return store.update(input.userId, input.seriesKey, {
      seriesName: input.seriesName,
      status: input.status,
      updatedAt: now,
    });
  }

  return store.create({
    userId: input.userId,
    seriesKey: input.seriesKey,
    seriesName: input.seriesName,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  } as SeriesSubscriptionRecord);
}
