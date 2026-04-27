import { listAvailableDays } from '../app/lib/days/aggregation.server';
import { reconcileAllSeriesSubscriptions } from '../app/lib/days/series-subscriptions.server';
import { recordAppEventSafely } from '../app/lib/db/services/app-event.server';
import {
  getAvailableDaysSnapshot,
  refreshAvailableDaysSnapshot,
} from '../app/lib/db/services/available-days-cache.server';
import { syncDayAttendanceSummaries } from '../app/lib/db/services/booking.server';
import {
  createAvailableDayNotificationsSafely,
  findNewAvailableDays,
} from '../app/lib/db/services/day-notification.server';
import { listManualDays } from '../app/lib/db/services/manual-day.server';

export async function handler() {
  try {
    const previousSnapshot = await getAvailableDaysSnapshot();
    const result = await listAvailableDays();
    const newDays = findNewAvailableDays(
      previousSnapshot ? previousSnapshot.days : null,
      result.days,
    );
    const snapshot = await refreshAvailableDaysSnapshot(result);
    const notifications = await createAvailableDayNotificationsSafely(newDays);
    const manualDays = await listManualDays();
    const linkedSeriesResults = await reconcileAllSeriesSubscriptions([
      ...snapshot.days,
      ...manualDays,
    ]);
    await syncDayAttendanceSummaries(snapshot.days.map((day) => day.dayId));

    const linkedSeriesSubscriptions = linkedSeriesResults.reduce(
      (count, result) => count + result.subscriptionCount,
      0,
    );
    const linkedSeriesBookings = linkedSeriesResults.reduce(
      (count, result) => count + result.bookingCount,
      0,
    );

    console.log(
      JSON.stringify({
        message: 'Available days cache refreshed',
        refreshedAt: snapshot.refreshedAt,
        dayCount: snapshot.days.length,
        errorCount: snapshot.errors.length,
        newDayCount: notifications.length,
        linkedSeriesCount: linkedSeriesResults.length,
        linkedSeriesSubscriptions,
        linkedSeriesBookings,
      }),
    );

    await recordAppEventSafely({
      category: 'operational',
      severity: snapshot.errors.length > 0 ? 'warning' : 'info',
      action: 'availableDays.refresh.completed',
      message:
        snapshot.errors.length > 0
          ? 'Available days refresh completed with source errors.'
          : 'Available days refresh completed.',
      subject: {
        type: 'availableDays',
        id: 'snapshot',
      },
      metadata: {
        refreshedAt: snapshot.refreshedAt,
        dayCount: snapshot.days.length,
        errorCount: snapshot.errors.length,
        newDayCount: notifications.length,
        linkedSeriesCount: linkedSeriesResults.length,
        linkedSeriesSubscriptions,
        linkedSeriesBookings,
      },
    });

    return {
      refreshedAt: snapshot.refreshedAt,
      dayCount: snapshot.days.length,
      errorCount: snapshot.errors.length,
      newDayCount: notifications.length,
      linkedSeriesCount: linkedSeriesResults.length,
    };
  } catch (error) {
    await recordAppEventSafely({
      category: 'error',
      action: 'availableDays.refresh.failed',
      message: 'Available days refresh failed.',
      subject: {
        type: 'availableDays',
        id: 'snapshot',
      },
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
