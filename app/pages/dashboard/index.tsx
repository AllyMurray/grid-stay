import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconChecklist, IconLock, IconUsersGroup } from '@tabler/icons-react';
import type { ReactNode } from 'react';
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
  maybeBookingsCount: number;
  tripsMissingStayCount: number;
  tripsWithSharedStayCount: number;
  privateRefsOpenCount: number;
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

function formatOverviewDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function hasPrivateReferences(booking: BookingRecord) {
  return Boolean(
    booking.bookingReference?.trim() || booking.accommodationReference?.trim(),
  );
}

function nextActionText(booking: BookingRecord) {
  if (booking.status === 'maybe') {
    return 'Confirm whether this trip is going ahead.';
  }

  if (!booking.accommodationName?.trim()) {
    return 'Add the shared stay name once the group agrees it.';
  }

  if (!hasPrivateReferences(booking)) {
    return 'Store the private references while they are easy to find.';
  }

  return 'This trip is aligned and ready for the weekend.';
}

function AttentionRow({
  icon,
  title,
  description,
  value,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  value: number;
  color: string;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <ThemeIcon size={34} radius="sm" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Stack gap={2}>
          <Text fw={700}>{title}</Text>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Stack>
      </Group>
      <Text fw={800} fz={28} lh={1}>
        {value}
      </Text>
    </Group>
  );
}

function CompactBookingRow({ booking }: { booking: BookingRecord }) {
  return (
    <Stack gap={4} py="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={700}>{booking.circuit}</Text>
          <Text size="sm" c="dimmed">
            {formatOverviewDate(booking.date)} • {booking.provider}
          </Text>
          <Text size="sm" lineClamp={1}>
            {booking.accommodationName || 'Shared stay still open'}
          </Text>
        </Stack>
        <Badge color={bookingColor(booking.status)}>
          {titleCase(booking.status)}
        </Badge>
      </Group>
    </Stack>
  );
}

function CompactDayRow({ day }: { day: AvailableDay }) {
  return (
    <Stack gap={4} py="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={700}>{day.circuit}</Text>
          <Text size="sm" c="dimmed">
            {formatOverviewDate(day.date)} • {day.provider}
          </Text>
          <Text size="sm" lineClamp={1}>
            {day.description || 'No extra details'}
          </Text>
        </Stack>
        <Badge color={typeColor(day.type)}>{titleCase(day.type)}</Badge>
      </Group>
    </Stack>
  );
}

export function DashboardIndexPage({
  firstName,
  availableDaysCount,
  daysThisMonth,
  activeBookingsCount,
  sharedStayCount,
  maybeBookingsCount,
  tripsMissingStayCount,
  tripsWithSharedStayCount,
  privateRefsOpenCount,
  nextDays,
  upcomingBookings,
}: DashboardIndexPageProps) {
  const nextBooking = upcomingBookings[0] ?? null;
  const nextLiveDay = nextDays[0] ?? null;
  const focusDay = nextBooking
    ? (nextDays.find((day) => day.dayId === nextBooking.dayId) ?? nextLiveDay)
    : nextLiveDay;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description="Start with the next event, then clear the gaps in your trip plan and the shared stay plan."
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
            <Button component={Link} to="/dashboard/bookings">
              Review my bookings
            </Button>
            <Button component={Link} to="/dashboard/days" variant="default">
              Open available days
            </Button>
          </Group>
        }
      />

      <Paper className="shell-card overview-focus-panel" p="xl">
        {nextBooking || focusDay ? (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="lg">
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={700} c="brand.7">
                  Next event
                </Text>
                <Title order={2}>
                  {nextBooking?.circuit ?? focusDay?.circuit}
                </Title>
                <Text size="sm" c="dimmed">
                  {formatOverviewDate(
                    nextBooking?.date ?? focusDay?.date ?? '',
                  )}{' '}
                  • {nextBooking?.provider ?? focusDay?.provider}
                </Text>
                <Text size="sm">
                  {nextBooking?.description ||
                    focusDay?.description ||
                    'No extra details'}
                </Text>
              </Stack>
              <Group gap="xs" align="flex-start">
                {focusDay ? (
                  <Badge color={typeColor(focusDay.type)}>
                    {titleCase(focusDay.type)}
                  </Badge>
                ) : null}
                {nextBooking ? (
                  <Badge
                    color={bookingColor(nextBooking.status)}
                    variant="light"
                  >
                    {titleCase(nextBooking.status)}
                  </Badge>
                ) : null}
              </Group>
            </Group>

            <Divider />

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
              <Stack gap={4}>
                <Text fw={700}>Trip status</Text>
                <Text size="sm">
                  {nextBooking
                    ? titleCase(nextBooking.status)
                    : 'Not added to your bookings yet'}
                </Text>
                <Text size="sm" c="dimmed">
                  {nextBooking
                    ? 'Your booking status is already attached to this event.'
                    : 'Open the live days feed to add this date to your trip plan.'}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text fw={700}>Shared stay</Text>
                <Text size="sm">
                  {nextBooking?.accommodationName || 'Still open'}
                </Text>
                <Text size="sm" c="dimmed">
                  {nextBooking?.accommodationName
                    ? 'The stay name is already visible to the group.'
                    : 'The group has not settled on a shared stay name yet.'}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text fw={700}>What to do now</Text>
                <Text size="sm">
                  {nextBooking
                    ? nextActionText(nextBooking)
                    : 'Review the live calendar and choose the next date worth locking in.'}
                </Text>
                <Group gap="sm" mt="xs">
                  <Button
                    component={Link}
                    to={nextBooking ? '/dashboard/bookings' : '/dashboard/days'}
                    w="fit-content"
                  >
                    {nextBooking ? 'Open this trip' : 'Browse live days'}
                  </Button>
                </Group>
              </Stack>
            </SimpleGrid>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Text size="sm" fw={700} c="brand.7">
              Next event
            </Text>
            <Title order={3}>Nothing is lined up yet</Title>
            <Text size="sm" c="dimmed">
              The live feed is waiting for the next refresh. As soon as dates
              arrive, this page will surface the next event and the gaps worth
              closing first.
            </Text>
            <Button component={Link} to="/dashboard/days" w="fit-content">
              Open available days
            </Button>
          </Stack>
        )}
      </Paper>

      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="lg">
        <Paper className="shell-card" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>What needs attention</Title>
                <Text size="sm" c="dimmed">
                  Clear these first so the next weekend does not drift.
                </Text>
              </Stack>
              <Button
                component={Link}
                to="/dashboard/bookings"
                variant="subtle"
              >
                Review trips
              </Button>
            </Group>

            <Stack gap="md">
              <AttentionRow
                icon={<IconChecklist size={18} />}
                title="Still deciding"
                description="Trips that are still marked maybe."
                value={maybeBookingsCount}
                color="yellow"
              />
              <Divider />
              <AttentionRow
                icon={<IconUsersGroup size={18} />}
                title="Shared stay open"
                description="Trips without a stay name visible to the group."
                value={tripsMissingStayCount}
                color="blue"
              />
              <Divider />
              <AttentionRow
                icon={<IconLock size={18} />}
                title="Private refs open"
                description="Trips still missing private booking references."
                value={privateRefsOpenCount}
                color="gray"
              />
            </Stack>
          </Stack>
        </Paper>

        <Paper className="shell-card" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Shared stay progress</Title>
                <Text size="sm" c="dimmed">
                  Track how much of the trip list already lines up around a
                  shared stay.
                </Text>
              </Stack>
              <Text fw={800} fz={28} lh={1}>
                {activeBookingsCount > 0
                  ? `${tripsWithSharedStayCount}/${activeBookingsCount}`
                  : '0/0'}
              </Text>
            </Group>

            {upcomingBookings.length > 0 ? (
              <Stack gap={0}>
                {upcomingBookings.slice(0, 3).map((booking, index) => (
                  <div key={booking.bookingId}>
                    <CompactBookingRow booking={booking} />
                    {index < Math.min(upcomingBookings.length, 3) - 1 ? (
                      <Divider />
                    ) : null}
                  </div>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Add the first trip from the live days feed and shared stay
                progress will start here.
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper className="shell-card" p="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Live calendar</Title>
                <Text size="sm" c="dimmed">
                  The next dates still open in the shared feed.
                </Text>
              </Stack>
              <Button component={Link} to="/dashboard/days" variant="subtle">
                View all
              </Button>
            </Group>

            {nextDays.length > 0 ? (
              <Stack gap={0}>
                {nextDays.slice(0, 3).map((day, index) => (
                  <div key={day.dayId}>
                    <CompactDayRow day={day} />
                    {index < Math.min(nextDays.length, 3) - 1 ? (
                      <Divider />
                    ) : null}
                  </div>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                The live feed is waiting for its next refresh.
              </Text>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
