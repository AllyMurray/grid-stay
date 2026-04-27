import type { AvailableDay } from './types';

export interface RaceSeriesSummary {
  key: string;
  name: string;
  totalCount: number;
  existingBookingCount: number;
}

function normalizeSeriesKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getLinkedSeriesName(day: AvailableDay): string | null {
  const series = day.source.metadata?.series?.trim();
  return series ? series : null;
}

export function getLinkedSeriesKey(day: AvailableDay): string | null {
  const explicitKey = day.source.metadata?.seriesKey?.trim();
  if (explicitKey) {
    return explicitKey;
  }

  const seriesName = getLinkedSeriesName(day);
  return seriesName ? normalizeSeriesKey(seriesName) : null;
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
  return getLinkedSeriesName(day);
}

export function getRaceSeriesDaysForDay(
  days: AvailableDay[],
  dayId: string,
): { seriesKey: string; seriesName: string; days: AvailableDay[] } | null {
  const selectedDay = days.find((day) => day.dayId === dayId);

  if (!selectedDay) {
    return null;
  }

  const seriesKey = getLinkedSeriesKey(selectedDay);
  const seriesName = getLinkedSeriesName(selectedDay);
  if (!seriesKey || !seriesName) {
    return null;
  }

  return {
    seriesKey,
    seriesName,
    days: days
      .filter((day) => getLinkedSeriesKey(day) === seriesKey)
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
    const seriesKey = getLinkedSeriesKey(day);
    const seriesName = getLinkedSeriesName(day);
    if (!seriesKey || !seriesName) {
      continue;
    }

    const current = groupedBySeries.get(seriesKey);

    if (current) {
      current.push(day);
      continue;
    }

    groupedBySeries.set(seriesKey, [day]);
  }

  const summaryByDayId: Record<string, RaceSeriesSummary> = {};

  for (const [seriesKey, seriesDays] of groupedBySeries.entries()) {
    const summary = {
      key: seriesKey,
      name: getLinkedSeriesName(seriesDays[0]!)!,
      totalCount: seriesDays.length,
      existingBookingCount: seriesDays.filter((day) =>
        existingBookingDayIds.has(day.dayId),
      ).length,
    } satisfies RaceSeriesSummary;

    for (const day of days) {
      if (getLinkedSeriesKey(day) === seriesKey) {
        summaryByDayId[day.dayId] = summary;
      }
    }
  }

  return summaryByDayId;
}
