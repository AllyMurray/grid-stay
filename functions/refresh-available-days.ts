import { listAvailableDays } from '../app/lib/days/aggregation.server';
import { reconcileAllSeriesSubscriptions } from '../app/lib/days/series-subscriptions.server';
import { refreshAvailableDaysSnapshot } from '../app/lib/db/services/available-days-cache.server';
import { syncDayAttendanceSummaries } from '../app/lib/db/services/booking.server';
import { listManualDays } from '../app/lib/db/services/manual-day.server';

export async function handler() {
  const result = await listAvailableDays();
  const snapshot = await refreshAvailableDaysSnapshot(result);
  const manualDays = await listManualDays();
  const linkedSeriesResults = await reconcileAllSeriesSubscriptions([
    ...snapshot.days,
    ...manualDays,
  ]);
  await syncDayAttendanceSummaries(snapshot.days.map((day) => day.dayId));

  console.log(
    JSON.stringify({
      message: 'Available days cache refreshed',
      refreshedAt: snapshot.refreshedAt,
      dayCount: snapshot.days.length,
      errorCount: snapshot.errors.length,
      linkedSeriesCount: linkedSeriesResults.length,
      linkedSeriesSubscriptions: linkedSeriesResults.reduce(
        (count, result) => count + result.subscriptionCount,
        0,
      ),
      linkedSeriesBookings: linkedSeriesResults.reduce(
        (count, result) => count + result.bookingCount,
        0,
      ),
    }),
  );

  return {
    refreshedAt: snapshot.refreshedAt,
    dayCount: snapshot.days.length,
    errorCount: snapshot.errors.length,
    linkedSeriesCount: linkedSeriesResults.length,
  };
}
