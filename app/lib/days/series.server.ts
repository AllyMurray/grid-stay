import type { AvailableDay } from './types';

export interface RaceSeriesSummary {
  name: string;
  totalCount: number;
  existingBookingCount: number;
}

function compareAvailableDays(left: AvailableDay, right: AvailableDay) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }

  return left.dayId.localeCompare(right.dayId);
}

export function getRaceSeriesName(day: AvailableDay): string | null {
  if (day.type !== 'race_day') {
    return null;
  }

  const series = day.source.metadata?.series?.trim();
  return series ? series : null;
}

export function getRaceSeriesDaysForDay(
  days: AvailableDay[],
  dayId: string,
): { seriesName: string; days: AvailableDay[] } | null {
  const selectedDay = days.find((day) => day.dayId === dayId);

  if (!selectedDay) {
    return null;
  }

  const seriesName = getRaceSeriesName(selectedDay);
  if (!seriesName) {
    return null;
  }

  return {
    seriesName,
    days: days
      .filter(
        (day) =>
          day.type === 'race_day' &&
          day.source.sourceType === selectedDay.source.sourceType &&
          getRaceSeriesName(day) === seriesName,
      )
      .sort(compareAvailableDays),
  };
}

export function buildRaceSeriesSummaryByDayId(
  days: AvailableDay[],
  bookedDayIds: Iterable<string>,
): Record<string, RaceSeriesSummary> {
  const existingBookingDayIds = new Set(bookedDayIds);
  const groupedBySeries = new Map<string, AvailableDay[]>();

  for (const day of days) {
    const seriesName = getRaceSeriesName(day);
    if (!seriesName) {
      continue;
    }

    const key = `${day.source.sourceType}:${seriesName}`;
    const current = groupedBySeries.get(key);

    if (current) {
      current.push(day);
      continue;
    }

    groupedBySeries.set(key, [day]);
  }

  const summaryByDayId: Record<string, RaceSeriesSummary> = {};

  for (const seriesDays of groupedBySeries.values()) {
    const summary = {
      name: getRaceSeriesName(seriesDays[0]!)!,
      totalCount: seriesDays.length,
      existingBookingCount: seriesDays.filter((day) =>
        existingBookingDayIds.has(day.dayId),
      ).length,
    } satisfies RaceSeriesSummary;

    for (const day of seriesDays) {
      summaryByDayId[day.dayId] = summary;
    }
  }

  return summaryByDayId;
}
