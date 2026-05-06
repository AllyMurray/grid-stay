import { type AppEvent, listRecentAppEvents } from '~/lib/db/services/app-event.server';

export interface AdminOperationsReport {
  events: AppEvent[];
  errorCount: number;
  warningCount: number;
  lastErrorAt?: string;
}

export async function loadAdminOperationsReport(
  loadEvents: typeof listRecentAppEvents = listRecentAppEvents,
): Promise<AdminOperationsReport> {
  const events = await loadEvents(100);
  const errorEvents = events.filter((event) => event.severity === 'error');

  return {
    events,
    errorCount: errorEvents.length,
    warningCount: events.filter((event) => event.severity === 'warning').length,
    lastErrorAt: errorEvents[0]?.createdAt,
  };
}
