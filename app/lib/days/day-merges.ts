import type { AvailableDay } from './types';

export interface DayMergeRule {
  sourceDayId: string;
  targetDayId: string;
}

export function applyDayMerges(days: AvailableDay[], rules: DayMergeRule[]): AvailableDay[] {
  if (rules.length === 0) {
    return days;
  }

  const dayIds = new Set(days.map((day) => day.dayId));
  const hiddenSourceIds = new Set(
    rules.filter((rule) => dayIds.has(rule.targetDayId)).map((rule) => rule.sourceDayId),
  );

  return days.filter((day) => !hiddenSourceIds.has(day.dayId));
}
