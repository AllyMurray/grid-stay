import {
  DayAttendanceSummaryEntity,
  type DayAttendanceSummaryRecord,
} from '../entities/day-attendance-summary.server';

export interface DayAttendanceOverview {
  attendeeCount: number;
  accommodationNames: string[];
  garageOwnerCount?: number;
  garageOpenSpaceCount?: number;
}

const DAY_ATTENDANCE_SUMMARY_SCOPE = 'summary';

function toOverview(
  record: Pick<
    DayAttendanceSummaryRecord,
    'attendeeCount' | 'accommodationNames' | 'garageOwnerCount' | 'garageOpenSpaceCount'
  >,
): DayAttendanceOverview {
  return {
    attendeeCount: record.attendeeCount,
    accommodationNames: record.accommodationNames,
    garageOwnerCount: record.garageOwnerCount ?? 0,
    garageOpenSpaceCount: record.garageOpenSpaceCount ?? 0,
  };
}

export interface DayAttendanceSummaryPersistence {
  getByDayIds(dayIds: string[]): Promise<Map<string, DayAttendanceOverview>>;
  put(dayId: string, overview: DayAttendanceOverview, updatedAt: string): Promise<void>;
}

export const dayAttendanceSummaryStore: DayAttendanceSummaryPersistence = {
  async getByDayIds(dayIds) {
    if (dayIds.length === 0) {
      return new Map();
    }

    const response = await DayAttendanceSummaryEntity.get(
      dayIds.map((dayId) => ({
        dayId,
        scope: DAY_ATTENDANCE_SUMMARY_SCOPE,
      })),
    ).go();
    const records = response.data ?? [];

    return new Map(
      records
        .filter((record): record is DayAttendanceSummaryRecord => Boolean(record))
        .map((record) => [record.dayId, toOverview(record)]),
    );
  },
  async put(dayId, overview, updatedAt) {
    await DayAttendanceSummaryEntity.put({
      dayId,
      scope: DAY_ATTENDANCE_SUMMARY_SCOPE,
      attendeeCount: overview.attendeeCount,
      accommodationNames: overview.accommodationNames,
      garageOwnerCount: overview.garageOwnerCount ?? 0,
      garageOpenSpaceCount: overview.garageOpenSpaceCount ?? 0,
      updatedAt,
    }).go();
  },
};
