import {
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import { formatDateOnly } from '~/lib/dates/date-only';
import type {
  RaceSeriesDetail,
  RaceSeriesRound,
} from '~/lib/days/series-detail.server';

export type RaceSeriesDetailPageProps = RaceSeriesDetail;

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

export function RaceSeriesDetailPage({
  seriesKey,
  seriesName,
  roundCount,
  bookedCount,
  maybeCount,
  manualRoundCount,
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
            <Button
              component={Link}
              to={`/dashboard/days?series=${encodeURIComponent(seriesKey)}`}
            >
              Open filtered days
            </Button>
            <Button component={Link} to="/dashboard/days" variant="default">
              All available days
            </Button>
          </Group>
        }
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
                      <Badge color={typeColor(round.type)}>
                        {titleCase(round.type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={bookingColor(round.myBookingStatus)}
                      >
                        {round.myBookingStatus
                          ? titleCase(round.myBookingStatus)
                          : 'Not added'}
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
