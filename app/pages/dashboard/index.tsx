import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

export interface DashboardIndexPageProps {
  firstName: string;
  availableDaysCount: number;
  daysThisMonth: number;
  activeBookingsCount: number;
  sharedStayCount: number;
  nextDays: AvailableDay[];
  upcomingBookings: BookingRecord[];
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function typeColor(type: AvailableDay['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'blue';
    case 'track_day':
      return 'orange';
  }
}

function bookingColor(status: BookingRecord['status']) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
  }
}

export function DashboardIndexPage({
  firstName,
  availableDaysCount,
  daysThisMonth,
  activeBookingsCount,
  sharedStayCount,
  nextDays,
  upcomingBookings,
}: DashboardIndexPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description="Keep the next weekend moving by checking the live calendar, your bookings, and the stay plan from one place."
        meta={
          <HeaderStatGrid
            items={[
              {
                label: 'Upcoming days',
                value: availableDaysCount,
              },
              {
                label: 'This month',
                value: daysThisMonth,
              },
              {
                label: 'Active bookings',
                value: activeBookingsCount,
              },
              {
                label: 'Shared stays',
                value: sharedStayCount,
              },
            ]}
          />
        }
        actions={
          <Group gap="sm">
            <Button component={Link} to="/dashboard/days">
              Open available days
            </Button>
            <Button component={Link} to="/dashboard/bookings" variant="default">
              Review my bookings
            </Button>
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper className="shell-card" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Next on the calendar</Title>
                <Text size="sm" c="dimmed">
                  The earliest dates still open in the shared feed.
                </Text>
              </Stack>
              <Button component={Link} to="/dashboard/days" variant="subtle">
                View all
              </Button>
            </Group>

            {nextDays.length > 0 ? (
              <Stack gap={0}>
                {nextDays.map((day, index) => (
                  <Stack key={day.dayId} gap="sm" py="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text fw={700}>{day.circuit}</Text>
                        <Text size="sm" c="dimmed">
                          {day.date} • {day.provider}
                        </Text>
                        <Text size="sm">
                          {day.description || 'No extra details'}
                        </Text>
                      </Stack>
                      <Badge color={typeColor(day.type)}>
                        {titleCase(day.type)}
                      </Badge>
                    </Group>
                    {index < nextDays.length - 1 ? <Divider /> : null}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed">
                The live feed is waiting for its next refresh.
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper className="shell-card" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Your upcoming trips</Title>
                <Text size="sm" c="dimmed">
                  The bookings still in motion on your side.
                </Text>
              </Stack>
              <Button
                component={Link}
                to="/dashboard/bookings"
                variant="subtle"
              >
                Manage
              </Button>
            </Group>

            {upcomingBookings.length > 0 ? (
              <Stack gap={0}>
                {upcomingBookings.map((booking, index) => (
                  <Stack key={booking.bookingId} gap="sm" py="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text fw={700}>{booking.circuit}</Text>
                        <Text size="sm" c="dimmed">
                          {booking.date} • {booking.provider}
                        </Text>
                        <Text size="sm">
                          {booking.accommodationName ||
                            'Accommodation still open'}
                        </Text>
                      </Stack>
                      <Badge color={bookingColor(booking.status)}>
                        {titleCase(booking.status)}
                      </Badge>
                    </Group>
                    {index < upcomingBookings.length - 1 ? <Divider /> : null}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Stack gap="sm">
                <Text c="dimmed">
                  Nothing is booked yet. Start with the live days feed and lock
                  in the next trip.
                </Text>
                <Button component={Link} to="/dashboard/days" w="fit-content">
                  Browse available days
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
