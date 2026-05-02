import { Box, Group, Stack, Text } from '@mantine/core';

export interface TripStatusSummaryProps {
  totalCount: number;
  confirmedCount: number;
  maybeCount: number;
  sharedStayCount: number;
}

function formatTripsTracked(value: number) {
  return `${value} ${value === 1 ? 'trip' : 'trips'} tracked`;
}

function formatSharedStayCount(value: number) {
  return `${value} ${value === 1 ? 'shared stay' : 'shared stays'}`;
}

export function TripStatusSummary({
  totalCount,
  confirmedCount,
  maybeCount,
  sharedStayCount,
}: TripStatusSummaryProps) {
  const statusTotal = confirmedCount + maybeCount;
  const confirmedWidth =
    statusTotal > 0 ? `${(confirmedCount / statusTotal) * 100}%` : '0%';
  const maybeWidth =
    statusTotal > 0 ? `${(maybeCount / statusTotal) * 100}%` : '0%';

  return (
    <Stack gap={6} className="trip-status-summary">
      <Text fw={800} c="brand.4" size="md">
        {formatTripsTracked(totalCount)}
      </Text>
      <Box
        className="trip-status-summary-bar"
        role="img"
        aria-label={`${confirmedCount} confirmed, ${maybeCount} maybe`}
      >
        {confirmedCount > 0 ? (
          <Box
            className="trip-status-summary-segment trip-status-summary-confirmed"
            style={{ width: confirmedWidth }}
          />
        ) : null}
        {maybeCount > 0 ? (
          <Box
            className="trip-status-summary-segment trip-status-summary-maybe"
            style={{ width: maybeWidth }}
          />
        ) : null}
      </Box>
      <Group gap="sm" wrap="wrap">
        <Text size="xs" c="green.4" fw={800}>
          {confirmedCount} confirmed
        </Text>
        <Text size="xs" c="yellow.4" fw={800}>
          {maybeCount} maybe
        </Text>
        <Text size="xs" c="dimmed">
          {formatSharedStayCount(sharedStayCount)}
        </Text>
      </Group>
    </Stack>
  );
}
