import { listAvailableDays } from '../app/lib/days/aggregation.server';
import { reconcileAllSeriesSubscriptions } from '../app/lib/days/series-subscriptions.server';
import { recordAppEventSafely } from '../app/lib/db/services/app-event.server';
import {
  getAvailableDaysSnapshot,
  refreshAvailableDaysSnapshot,
} from '../app/lib/db/services/available-days-cache.server';
import { upsertAvailableDayCatalogue } from '../app/lib/db/services/available-day-catalogue.server';
import { syncDayAttendanceSummaries } from '../app/lib/db/services/booking.server';
import {
  createAvailableDayNotificationsSafely,
  createChangedDayNotificationsSafely,
  findNewAvailableDays,
} from '../app/lib/db/services/day-notification.server';
import {
  diffAvailableDays,
  recordFeedChangesSafely,
} from '../app/lib/db/services/feed-change.server';
import { listManualDays } from '../app/lib/db/services/manual-day.server';

export async function handler() {
  try {
    const previousSnapshot = await getAvailableDaysSnapshot();
    const result = await listAvailableDays();
    let catalogueRecords: Awaited<ReturnType<typeof upsertAvailableDayCatalogue>> = [];
    let catalogueError: string | undefined;
    const newDays = findNewAvailableDays(
      previousSnapshot ? previousSnapshot.days : null,
      result.days,
    );
    const feedChanges = diffAvailableDays(
      previousSnapshot ? previousSnapshot.days : null,
      result.days,
      new Date().toISOString(),
    );
    try {
      catalogueRecords = await upsertAvailableDayCatalogue(result.days);
    } catch (error) {
      catalogueError = error instanceof Error ? error.message : String(error);
      console.error('Failed to update available day catalogue', { error });
      await recordAppEventSafely({
        category: 'error',
        action: 'availableDayCatalogue.upsert.failed',
        message: 'Failed to update the retained available day catalogue.',
        subject: {
          type: 'availableDays',
          id: 'catalogue',
        },
        metadata: {
          dayCount: result.days.length,
          error: catalogueError,
        },
      });
    }
    const snapshot = await refreshAvailableDaysSnapshot(result);
    const recordedFeedChanges = await recordFeedChangesSafely(feedChanges);
    const notifications = await createAvailableDayNotificationsSafely(newDays);
    const changedNotifications = await createChangedDayNotificationsSafely(recordedFeedChanges);
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
        catalogueDayCount: catalogueRecords.length,
        errorCount: snapshot.errors.length,
        newDayCount: notifications.length,
        changedDayCount: changedNotifications.length,
        feedChangeCount: recordedFeedChanges.length,
        linkedSeriesCount: linkedSeriesResults.length,
        linkedSeriesSubscriptions,
        linkedSeriesBookings,
        catalogueError,
      }),
    );

    await recordAppEventSafely({
      category: 'operational',
      severity: snapshot.errors.length > 0 || catalogueError ? 'warning' : 'info',
      action: 'availableDays.refresh.completed',
      message:
        snapshot.errors.length > 0 || catalogueError
          ? 'Available days refresh completed with source or catalogue errors.'
          : 'Available days refresh completed.',
      subject: {
        type: 'availableDays',
        id: 'snapshot',
      },
      metadata: {
        refreshedAt: snapshot.refreshedAt,
        dayCount: snapshot.days.length,
        catalogueDayCount: catalogueRecords.length,
        errorCount: snapshot.errors.length,
        newDayCount: notifications.length,
        changedDayCount: changedNotifications.length,
        feedChangeCount: recordedFeedChanges.length,
        linkedSeriesCount: linkedSeriesResults.length,
        linkedSeriesSubscriptions,
        linkedSeriesBookings,
        catalogueError,
      },
    });

    return {
      refreshedAt: snapshot.refreshedAt,
      dayCount: snapshot.days.length,
      catalogueDayCount: catalogueRecords.length,
      errorCount: snapshot.errors.length,
      newDayCount: notifications.length,
      changedDayCount: changedNotifications.length,
      linkedSeriesCount: linkedSeriesResults.length,
      catalogueError,
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
