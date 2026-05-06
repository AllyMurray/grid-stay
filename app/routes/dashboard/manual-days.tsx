import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { submitCreateManualDay } from '~/lib/days/actions.server';
import { listCircuitOptions } from '~/lib/days/aggregation.server';
import { getRaceSeriesName } from '~/lib/days/series.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listManagedManualDays } from '~/lib/db/services/manual-day.server';
import { ManualDaysPage, type ManualDaysPageProps } from '~/pages/dashboard/manual-days';
import type { Route } from './+types/manual-days';

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const [manualDays, snapshot] = await Promise.all([
    listManagedManualDays(),
    getAvailableDaysSnapshot(),
  ]);
  const circuitOptions = listCircuitOptions([...(snapshot?.days ?? []), ...manualDays]);
  const providerOptions = [
    ...new Set([
      ...(snapshot?.days.map((day) => day.provider) ?? []),
      ...manualDays.map((day) => day.provider),
    ]),
  ].toSorted();
  const seriesOptions = [
    ...new Set([
      ...(snapshot?.days.map((day) => getRaceSeriesName(day)).filter(isNonEmptyString) ?? []),
      ...manualDays
        .map((day) => (day.type === 'race_day' ? (day.series?.trim() ?? '') : ''))
        .filter(isNonEmptyString),
    ]),
  ].toSorted();

  return Response.json(
    {
      manualDays,
      circuitOptions,
      providerOptions,
      seriesOptions,
    } satisfies ManualDaysPageProps,
    {
      headers,
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const result = await submitCreateManualDay(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: 'manualDay.created',
      message: 'Manual day created.',
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'manualDay',
        id: result.dayId,
      },
      metadata: {
        date: formData.get('date')?.toString(),
        circuit: formData.get('circuit')?.toString(),
        type: formData.get('type')?.toString(),
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function ManualDaysRoute() {
  const data = useLoaderData<typeof loader>() as ManualDaysPageProps;
  return <ManualDaysPage {...data} />;
}
