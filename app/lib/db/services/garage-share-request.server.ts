import {
  GarageShareRequestEntity,
  type GarageShareRequestRecord,
} from '../entities/garage-share-request.server';

export type { GarageShareRequestRecord };

export const GARAGE_SHARE_REQUEST_SCOPE = 'garage-share-request';

export interface GarageShareRequestPersistence {
  create(item: GarageShareRequestRecord): Promise<GarageShareRequestRecord>;
  update(
    requestId: string,
    changes: Partial<GarageShareRequestRecord>,
  ): Promise<GarageShareRequestRecord>;
  get(requestId: string): Promise<GarageShareRequestRecord | null>;
  listByDay(dayId: string): Promise<GarageShareRequestRecord[]>;
  listByOwner(ownerUserId: string): Promise<GarageShareRequestRecord[]>;
  listAll(): Promise<GarageShareRequestRecord[]>;
}

function sortNewestFirst(
  left: GarageShareRequestRecord,
  right: GarageShareRequestRecord,
) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.requestId.localeCompare(left.requestId);
}

export const garageShareRequestStore: GarageShareRequestPersistence = {
  async create(item) {
    const record = {
      ...item,
      requestScope: GARAGE_SHARE_REQUEST_SCOPE,
    };
    await GarageShareRequestEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(requestId, changes) {
    const updated = await GarageShareRequestEntity.patch({
      requestScope: GARAGE_SHARE_REQUEST_SCOPE,
      requestId,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async get(requestId) {
    const response = await GarageShareRequestEntity.get({
      requestScope: GARAGE_SHARE_REQUEST_SCOPE,
      requestId,
    }).go();
    return response.data ?? null;
  },
  async listByDay(dayId) {
    const response = await GarageShareRequestEntity.query.byDay({ dayId }).go();
    return response.data.sort(sortNewestFirst);
  },
  async listByOwner(ownerUserId) {
    const response = await GarageShareRequestEntity.query
      .byOwner({ garageOwnerUserId: ownerUserId })
      .go();
    return response.data.sort(sortNewestFirst);
  },
  async listAll() {
    const response = await GarageShareRequestEntity.scan.go();
    return response.data
      .filter((record) => record.requestScope === GARAGE_SHARE_REQUEST_SCOPE)
      .sort(sortNewestFirst);
  },
};
