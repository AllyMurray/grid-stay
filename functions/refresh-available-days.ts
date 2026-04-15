import { listAvailableDays } from '../app/lib/days/aggregation.server';
import { refreshAvailableDaysSnapshot } from '../app/lib/db/services/available-days-cache.server';
import { syncDayAttendanceSummaries } from '../app/lib/db/services/booking.server';

export async function handler() {
  const result = await listAvailableDays();
  const snapshot = await refreshAvailableDaysSnapshot(result);
  await syncDayAttendanceSummaries(snapshot.days.map((day) => day.dayId));

  console.log(
    JSON.stringify({
      message: 'Available days cache refreshed',
      refreshedAt: snapshot.refreshedAt,
      dayCount: snapshot.days.length,
      errorCount: snapshot.errors.length,
    }),
  );

  return {
    refreshedAt: snapshot.refreshedAt,
    dayCount: snapshot.days.length,
    errorCount: snapshot.errors.length,
  };
}
