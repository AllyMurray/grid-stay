import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  listDataQualityIssueStates,
  reopenDataQualityIssue,
  setDataQualityIssueState,
} from '~/lib/db/services/data-quality-issue-state.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { normalizeAvailableDayCircuit } from './aggregation.server';
import type { AvailableDay } from './types';

export type DataQualityIssueType =
  | 'unknown_circuit'
  | 'missing_canonical_fields'
  | 'layout_in_circuit_name'
  | 'duplicate_event';

export interface DataQualityIssue {
  issueId: string;
  type: DataQualityIssueType;
  severity: 'warning' | 'info';
  status: 'open' | 'ignored' | 'resolved';
  dayId: string;
  date: string;
  circuit: string;
  provider: string;
  description: string;
  message: string;
  stateNote?: string;
  stateUpdatedByName?: string;
  stateUpdatedAt?: string;
}

export interface DaysDataQualityReport {
  refreshedAt: string;
  dayCount: number;
  issueCount: number;
  openIssueCount: number;
  ignoredIssueCount: number;
  resolvedIssueCount: number;
  issues: DataQualityIssue[];
}

export type DataQualityIssueStateActionResult =
  | {
      ok: true;
      message: string;
      issueId: string;
      status: 'open' | 'ignored' | 'resolved';
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: {
        issueId?: string[];
        note?: string[];
      };
    };

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
    issueId: `${type}:${day.dayId}`,
    type,
    severity,
    status: 'open',
    dayId: day.dayId,
    date: day.date,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    message,
  };
}

function applyIssueStates(
  issues: DataQualityIssue[],
  states: Awaited<ReturnType<typeof listDataQualityIssueStates>>,
) {
  const stateById = new Map(states.map((state) => [state.issueId, state]));

  return issues.map((issue) => {
    const state = stateById.get(issue.issueId);
    if (!state) {
      return issue;
    }

    return {
      ...issue,
      status: state.status,
      stateNote: state.note,
      stateUpdatedByName: state.updatedByName,
      stateUpdatedAt: state.updatedAt,
    };
  });
}

function findDayIssues(days: AvailableDay[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const duplicateGroups = new Map<string, AvailableDay[]>();

  for (const day of days) {
    const normalized = normalizeAvailableDayCircuit(day);

    if (normalized.circuitKnown === false) {
      issues.push(
        createDayIssue(day, 'unknown_circuit', 'Circuit is not in the canonical circuit catalog.'),
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

    if (normalized.circuit !== day.circuit || normalized.layout !== day.layout) {
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

  return issues.toSorted((left, right) =>
    left.date === right.date
      ? left.type.localeCompare(right.type)
      : left.date.localeCompare(right.date),
  );
}

export async function loadDaysDataQualityReport(
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
  loadIssueStates: typeof listDataQualityIssueStates = listDataQualityIssueStates,
): Promise<DaysDataQualityReport> {
  const [snapshot, manualDays, issueStates] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
    loadIssueStates(),
  ]);
  const days = [...(snapshot?.days ?? []), ...manualDays];
  const issues = applyIssueStates(findDayIssues(days), issueStates);
  const openIssueCount = issues.filter((issue) => issue.status === 'open').length;
  const ignoredIssueCount = issues.filter((issue) => issue.status === 'ignored').length;
  const resolvedIssueCount = issues.filter((issue) => issue.status === 'resolved').length;

  return {
    refreshedAt: snapshot?.refreshedAt ?? '',
    dayCount: days.length,
    issueCount: openIssueCount,
    openIssueCount,
    ignoredIssueCount,
    resolvedIssueCount,
    issues,
  };
}

function readIssueId(formData: FormData) {
  const issueId = formData.get('issueId');
  return typeof issueId === 'string' ? issueId.trim() : '';
}

function readNote(formData: FormData) {
  const note = formData.get('note');
  return typeof note === 'string' ? note.trim() : '';
}

export async function submitDataQualityIssueStateAction(
  formData: FormData,
  user: Pick<User, 'id' | 'name'>,
  saveState: typeof setDataQualityIssueState = setDataQualityIssueState,
  reopenIssue: typeof reopenDataQualityIssue = reopenDataQualityIssue,
): Promise<DataQualityIssueStateActionResult> {
  const intent = formData.get('intent');
  const issueId = readIssueId(formData);

  if (!issueId) {
    return {
      ok: false,
      formError: 'Could not update this issue.',
      fieldErrors: {
        issueId: ['Issue id is required.'],
      },
    };
  }

  if (intent === 'reopenIssue') {
    await reopenIssue(issueId);
    return {
      ok: true,
      message: 'Issue reopened.',
      issueId,
      status: 'open',
    };
  }

  if (intent === 'ignoreIssue' || intent === 'resolveIssue') {
    const status = intent === 'ignoreIssue' ? 'ignored' : 'resolved';
    await saveState({
      issueId,
      status,
      note: readNote(formData),
      user,
    });

    return {
      ok: true,
      message: status === 'ignored' ? 'Issue ignored.' : 'Issue resolved.',
      issueId,
      status,
    };
  }

  return {
    ok: false,
    formError: 'This issue action is not supported.',
    fieldErrors: {},
  };
}
