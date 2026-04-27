import { DayPlanEntity, type DayPlanRecord } from '../entities/day-plan.server';

export const SHARED_DAY_PLAN_SCOPE = 'shared';

export interface DayPlanPersistence {
  create(item: DayPlanRecord): Promise<DayPlanRecord>;
  update(
    dayId: string,
    changes: Partial<DayPlanRecord>,
  ): Promise<DayPlanRecord>;
  delete(dayId: string): Promise<void>;
  get(dayId: string): Promise<DayPlanRecord | null>;
  listAll(): Promise<DayPlanRecord[]>;
}

export const dayPlanStore: DayPlanPersistence = {
  async create(item) {
    const record = {
      ...item,
      planScope: SHARED_DAY_PLAN_SCOPE,
    };

    await DayPlanEntity.create(record).go({ response: 'none' });
    return record;
  },
  async update(dayId, changes) {
    const updated = await DayPlanEntity.patch({
      dayId,
      planScope: SHARED_DAY_PLAN_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(dayId) {
    await DayPlanEntity.delete({
      dayId,
      planScope: SHARED_DAY_PLAN_SCOPE,
    }).go({ response: 'none' });
  },
  async get(dayId) {
    const response = await DayPlanEntity.get({
      dayId,
      planScope: SHARED_DAY_PLAN_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await DayPlanEntity.scan.go();
    return response.data.filter(
      (record) => record.planScope === SHARED_DAY_PLAN_SCOPE,
    );
  },
};
