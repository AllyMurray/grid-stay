import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { normalizeAvailableDayCircuit } from './aggregation.server';
import type { AvailableDay } from './types';

export type DataQualityIssueType =
  | 'unknown_circuit'
  | 'missing_canonical_fields'
  | 'layout_in_circuit_name'
  | 'duplicate_event';

export interface DataQualityIssue {
  type: DataQualityIssueType;
  severity: 'warning' | 'info';
  dayId: string;
  date: string;
  circuit: string;
  provider: string;
  description: string;
  message: string;
}

export interface DaysDataQualityReport {
  refreshedAt: string;
  dayCount: number;
  issueCount: number;
  issues: DataQualityIssue[];
}

function getDuplicateKey(day: AvailableDay): string {
  const normalized = normalizeAvailableDayCircuit(day);

  return [
    normalized.date,
    normalized.type,
    normalized.circuitName ?? normalized.circuit,
    normalized.layout ?? '',
    normalized.provider,
    normalized.description,
  ].join('|');
}

function createDayIssue(
  day: AvailableDay,
  type: DataQualityIssueType,
  message: string,
  severity: DataQualityIssue['severity'] = 'warning',
): DataQualityIssue {
  return {
    type,
    severity,
    dayId: day.dayId,
    date: day.date,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    message,
  };
}

function findDayIssues(days: AvailableDay[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const duplicateGroups = new Map<string, AvailableDay[]>();

  for (const day of days) {
    const normalized = normalizeAvailableDayCircuit(day);

    if (normalized.circuitKnown === false) {
      issues.push(
        createDayIssue(
          day,
          'unknown_circuit',
          'Circuit is not in the canonical circuit catalog.',
        ),
      );
    }

    if (day.circuitName === undefined || day.circuitKnown === undefined) {
      issues.push(
        createDayIssue(
          day,
          'missing_canonical_fields',
          'Day is missing canonical circuit fields and should be refreshed.',
          'info',
        ),
      );
    }

    if (
      normalized.circuit !== day.circuit ||
      normalized.layout !== day.layout
    ) {
      issues.push(
        createDayIssue(
          day,
          'layout_in_circuit_name',
          'Circuit text appears to include a layout or source typo.',
          'info',
        ),
      );
    }

    const duplicateKey = getDuplicateKey(day);
    const duplicateGroup = duplicateGroups.get(duplicateKey);
    if (duplicateGroup) {
      duplicateGroup.push(day);
    } else {
      duplicateGroups.set(duplicateKey, [day]);
    }
  }

  for (const group of duplicateGroups.values()) {
    if (group.length <= 1) {
      continue;
    }

    for (const day of group) {
      issues.push(
        createDayIssue(
          day,
          'duplicate_event',
          `Possible duplicate event: ${group.length} days share the same normalized identity.`,
          'info',
        ),
      );
    }
  }

  return issues.sort((left, right) =>
    left.date === right.date
      ? left.type.localeCompare(right.type)
      : left.date.localeCompare(right.date),
  );
}

export async function loadDaysDataQualityReport(
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
): Promise<DaysDataQualityReport> {
  const [snapshot, manualDays] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
  ]);
  const days = [...(snapshot?.days ?? []), ...manualDays];
  const issues = findDayIssues(days);

  return {
    refreshedAt: snapshot?.refreshedAt ?? '',
    dayCount: days.length,
    issueCount: issues.length,
    issues,
  };
}
