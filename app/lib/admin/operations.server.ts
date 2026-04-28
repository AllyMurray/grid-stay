import {
  type AppEvent,
  listRecentAppEvents,
} from '~/lib/db/services/app-event.server';
import {
  type ExternalNotificationRecord,
  listRecentExternalNotifications,
} from '~/lib/db/services/external-notification.server';

export interface AdminOperationsReport {
  events: AppEvent[];
  externalNotifications: ExternalNotificationRecord[];
  errorCount: number;
  warningCount: number;
  pendingExternalNotificationCount: number;
  lastErrorAt?: string;
}

export async function loadAdminOperationsReport(
  loadEvents: typeof listRecentAppEvents = listRecentAppEvents,
  loadExternalNotifications: typeof listRecentExternalNotifications = listRecentExternalNotifications,
): Promise<AdminOperationsReport> {
  const [events, externalNotifications] = await Promise.all([
    loadEvents(100),
    loadExternalNotifications(50),
  ]);
  const errorEvents = events.filter((event) => event.severity === 'error');

  return {
    events,
    externalNotifications,
    errorCount: errorEvents.length,
    warningCount: events.filter((event) => event.severity === 'warning').length,
    pendingExternalNotificationCount: externalNotifications.filter(
      (notification) => notification.status === 'pending',
    ).length,
    lastErrorAt: errorEvents[0]?.createdAt,
  };
}
