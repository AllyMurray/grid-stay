import type { FeedChangeRecord } from '~/lib/db/entities/feed-change.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listRecentFeedChanges } from '~/lib/db/services/feed-change.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import type { AvailableDay, DaySourceError } from './types';

const STALE_REFRESH_HOURS = 36;
const STALE_REFRESH_MS = STALE_REFRESH_HOURS * 60 * 60 * 1000;

const MISSING_SNAPSHOT_ERROR: DaySourceError = {
  source: 'cache',
  message:
    'Available days have not been refreshed yet. Please try again after the next scheduled sync.',
};

export interface AdminFeedSourceSummary {
  key: string;
  label: string;
  sourceType: AvailableDay['source']['sourceType'];
  dayCount: number;
}

export interface AdminFeedHealth {
  status: 'healthy' | 'warning' | 'stale' | 'empty';
  message: string;
}

export interface AdminFeedStatusReport {
  sourceErrors: DaySourceError[];
  refreshedAt: string;
  dayCount: number;
  snapshotDayCount: number;
  manualDayCount: number;
  dateRange: {
    firstDate: string;
    lastDate: string;
  } | null;
  sourceSummaries: AdminFeedSourceSummary[];
  recentChanges: FeedChangeRecord[];
  health: AdminFeedHealth;
}

function getSourceLabel(day: AvailableDay): string {
  if (day.source.sourceType === 'manual') {
    return 'Manual days';
  }

  return day.source.sourceName;
}

function summarizeSources(days: AvailableDay[]): AdminFeedSourceSummary[] {
  const summaries = new Map<string, AdminFeedSourceSummary>();

  for (const day of days) {
    const key = `${day.source.sourceType}:${day.source.sourceName}`;
    const existing = summaries.get(key);

    if (existing) {
      existing.dayCount += 1;
      continue;
    }

    summaries.set(key, {
      key,
      label: getSourceLabel(day),
      sourceType: day.source.sourceType,
      dayCount: 1,
    });
  }

  return [...summaries.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function getDateRange(days: AvailableDay[]) {
  const dates = days.map((day) => day.date).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);

  return firstDate && lastDate ? { firstDate, lastDate } : null;
}

function getHealth(input: {
  refreshedAt: string;
  dayCount: number;
  sourceErrorCount: number;
  now: Date;
}): AdminFeedHealth {
  if (!input.refreshedAt) {
    return {
      status: 'empty',
      message: 'No available-days snapshot has been written yet.',
    };
  }

  const refreshedTime = new Date(input.refreshedAt).getTime();
  if (
    Number.isFinite(refreshedTime) &&
    input.now.getTime() - refreshedTime > STALE_REFRESH_MS
  ) {
    return {
      status: 'stale',
      message: `Last successful refresh is more than ${STALE_REFRESH_HOURS} hours old.`,
    };
  }

  if (input.sourceErrorCount > 0) {
    return {
      status: 'warning',
      message: 'The latest refresh completed with one or more source errors.',
    };
  }

  if (input.dayCount === 0) {
    return {
      status: 'warning',
      message: 'The latest refresh completed but produced no available days.',
    };
  }

  return {
    status: 'healthy',
    message: 'The latest available-days snapshot is current and error-free.',
  };
}

export async function loadAdminFeedStatusReport(
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
  now: Date = new Date(),
  loadFeedChanges: typeof listRecentFeedChanges = listRecentFeedChanges,
): Promise<AdminFeedStatusReport> {
  const [snapshot, manualDays, recentChanges] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
    loadFeedChanges(25),
  ]);
  const snapshotDays = snapshot?.days ?? [];
  const days = [...snapshotDays, ...manualDays];
  const sourceErrors = snapshot?.errors ?? [MISSING_SNAPSHOT_ERROR];
  const refreshedAt = snapshot?.refreshedAt ?? '';

  return {
    sourceErrors,
    refreshedAt,
    dayCount: days.length,
    snapshotDayCount: snapshotDays.length,
    manualDayCount: manualDays.length,
    dateRange: getDateRange(days),
    sourceSummaries: summarizeSources(days),
    recentChanges,
    health: getHealth({
      refreshedAt,
      dayCount: days.length,
      sourceErrorCount: sourceErrors.length,
      now,
    }),
  };
}
