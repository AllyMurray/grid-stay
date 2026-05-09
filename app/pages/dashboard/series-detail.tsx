import { Badge, Button, Group, Paper, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { Link, useFetcher } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type {
  RaceSeriesSubscriptionActionResult,
  RemoveRaceSeriesSubscriptionActionResult,
} from '~/lib/bookings/actions.server';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { RaceSeriesDetail, RaceSeriesRound } from '~/lib/days/series-detail.server';

export type RaceSeriesDetailPageProps = RaceSeriesDetail;
type RaceSeriesActionResult =
  | RaceSeriesSubscriptionActionResult
  | RemoveRaceSeriesSubscriptionActionResult;

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function typeColor(type: RaceSeriesRound['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'blue';
    case 'track_day':
      return 'orange';
    case 'road_drive':
      return 'teal';
  }
}

function bookingColor(status?: RaceSeriesRound['myBookingStatus']) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
}

function formatRoundDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getRoundCircuit(round: RaceSeriesRound) {
  return round.layout ? `${round.circuit} ${round.layout}` : round.circuit;
}

function SeriesSubscriptionPanel({
  seriesKey,
  subscriptionStatus,
  missingCount,
  roundCount,
}: Pick<
  RaceSeriesDetailPageProps,
  'seriesKey' | 'subscriptionStatus' | 'missingCount' | 'roundCount'
>) {
  const fetcher = useFetcher<RaceSeriesActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const success = fetcher.data?.ok ? fetcher.data : null;
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const subscribed = Boolean(subscriptionStatus);
  const addMaybeLabel =
    !subscribed && missingCount === 0 ? 'Save series as maybe' : 'Add missing dates as maybe';
  const addBookedLabel =
    !subscribed && missingCount === 0 ? 'Save series as booked' : 'Add missing dates as booked';

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={3}>
              {subscribed ? 'In My Bookings' : 'Add this series to My Bookings'}
            </Title>
            <Text size="sm" c="dimmed">
              {subscribed
                ? 'Use your saved series to add missing linked dates. Existing bookings keep their status and notes.'
                : 'Add the linked dates now and save the series for future linked days.'}
            </Text>
          </Stack>
          {subscriptionStatus ? (
            <Badge color={subscriptionStatus === 'booked' ? 'green' : 'yellow'} variant="light">
              {titleCase(subscriptionStatus)}
            </Badge>
          ) : null}
        </Group>

        <Text size="sm" c="dimmed">
          {missingCount} of {roundCount} linked {roundCount === 1 ? 'date is' : 'dates are'} not in
          My Bookings.
        </Text>

        {missingCount > 0 || !subscribed ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="addRaceSeries" />
            <input type="hidden" name="seriesKey" value={seriesKey} />
            <Group gap="xs" wrap="wrap">
              <Button
                type="submit"
                name="status"
                value="maybe"
                variant="default"
                loading={isSubmitting}
              >
                {addMaybeLabel}
              </Button>
              <Button
                type="submit"
                name="status"
                value="booked"
                loading={isSubmitting}
              >
                {addBookedLabel}
              </Button>
            </Group>
          </fetcher.Form>
        ) : (
          <Text size="sm" c="dimmed">
            All linked dates already have bookings.
          </Text>
        )}

        {subscribed ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="removeRaceSeries" />
            <input type="hidden" name="seriesKey" value={seriesKey} />
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="xs" c="dimmed">
                Removing this series does not delete existing bookings.
              </Text>
              <Button type="submit" color="red" variant="subtle" loading={isSubmitting}>
                Remove series
              </Button>
            </Group>
          </fetcher.Form>
        ) : null}

        {success && 'addedCount' in success ? (
          <Text size="sm" c="dimmed">
            Added {success.addedCount} missing {success.addedCount === 1 ? 'date' : 'dates'}.
          </Text>
        ) : null}

        {formError ? (
          <Text size="sm" c="red">
            {formError}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function RaceSeriesDetailPage({
  seriesKey,
  seriesName,
  roundCount,
  bookedCount,
  maybeCount,
  missingCount,
  manualRoundCount,
  subscriptionStatus,
  rounds,
}: RaceSeriesDetailPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Race series"
        title={seriesName}
        description="Review every linked race, test, and manual support day in this series without changing booking data."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Linked days', value: roundCount },
              { label: 'Booked', value: bookedCount },
              { label: 'Maybe', value: maybeCount },
              { label: 'Manual extras', value: manualRoundCount },
            ]}
          />
        }
        actions={
          <Group gap="sm">
            <Button component={Link} to={`/dashboard/days?series=${encodeURIComponent(seriesKey)}`}>
              Open filtered days
            </Button>
            <Button component={Link} to="/dashboard/days" variant="default">
              All available days
            </Button>
          </Group>
        }
      />

      <SeriesSubscriptionPanel
        seriesKey={seriesKey}
        subscriptionStatus={subscriptionStatus}
        missingCount={missingCount}
        roundCount={roundCount}
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Linked series days</Title>
            <Text size="sm" c="dimmed">
              Manual extras are included when they have the same series tag.
            </Text>
          </Stack>

          <ScrollArea>
            <Table striped highlightOnHover miw={820}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Circuit</Table.Th>
                  <Table.Th>Provider</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>My status</Table.Th>
                  <Table.Th>Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rounds.map((round) => (
                  <Table.Tr key={round.dayId}>
                    <Table.Td>{formatRoundDate(round.date)}</Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={700}>{getRoundCircuit(round)}</Text>
                        <Text size="xs" c="dimmed">
                          {round.description}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{round.provider}</Table.Td>
                    <Table.Td>
                      <Badge color={typeColor(round.type)}>{titleCase(round.type)}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={bookingColor(round.myBookingStatus)}>
                        {round.myBookingStatus ? titleCase(round.myBookingStatus) : 'Not added'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {round.isManual ? (
                        <Badge variant="light" color="blue">
                          Manual
                        </Badge>
                      ) : (
                        <Badge variant="light" color="gray">
                          Source feed
                        </Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Paper>
    </Stack>
  );
}
