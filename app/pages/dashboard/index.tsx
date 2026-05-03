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
import { PageHeader } from '~/components/layout/page-header';
import { formatDateOnly } from '~/lib/dates/date-only';
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
    case 'road_drive':
      return 'teal';
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
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function bookingReferenceLabel(type?: AvailableDay['type']) {
  switch (type) {
    case 'race_day':
      return 'Race day reference';
    case 'test_day':
      return 'Test day reference';
    case 'track_day':
      return 'Track day reference';
    case 'road_drive':
      return 'Road drive reference';
    default:
      return 'Event booking reference';
  }
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function OverviewHeaderSummary({
  availableDaysCount,
  daysThisMonth,
  activeBookingsCount,
  sharedStayCount,
}: Pick<
  DashboardIndexPageProps,
  | 'availableDaysCount'
  | 'daysThisMonth'
  | 'activeBookingsCount'
  | 'sharedStayCount'
>) {
  return (
    <Stack gap={6} className="overview-header-summary">
      <Text fw={800} c="brand.4" size="md">
        {formatCount(availableDaysCount, 'upcoming day')}
      </Text>
      <Group gap="sm" wrap="wrap">
        <Text size="xs" c="dimmed" fw={700}>
          {daysThisMonth} this month
        </Text>
        <Text size="xs" c="dimmed" fw={700}>
          {formatCount(activeBookingsCount, 'active booking')}
        </Text>
        <Text size="xs" c="dimmed" fw={700}>
          {formatCount(sharedStayCount, 'shared stay')}
        </Text>
      </Group>
    </Stack>
  );
}

function nextTripTasks(booking: BookingRecord, type?: AvailableDay['type']) {
  const tasks: string[] = [];

  if (booking.status === 'maybe') {
    tasks.push('Confirm whether this date is actually happening for you.');
  }

  if (!booking.bookingReference?.trim()) {
    tasks.push(`Add the ${bookingReferenceLabel(type).toLowerCase()}.`);
  }

  if (!booking.accommodationName?.trim()) {
    tasks.push('Add the shared stay once everyone agrees where to stay.');
  }

  if (!booking.accommodationReference?.trim()) {
    tasks.push('Add the hotel booking reference.');
  }

  return tasks.length > 0
    ? tasks
    : ['Everything for this trip is already in place.'];
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

function TripDetailLine({
  label,
  value,
  dimmed = false,
  monospace = false,
}: {
  label: string;
  value: string;
  dimmed?: boolean;
  monospace?: boolean;
}) {
  return (
    <Group gap={8} wrap="wrap" align="baseline">
      <Text size="xs" fw={700} c="dimmed">
        {label}
      </Text>
      <Text
        size="sm"
        fw={700}
        c={dimmed ? 'dimmed' : undefined}
        ff={monospace ? 'monospace' : undefined}
      >
        {value}
      </Text>
    </Group>
  );
}

function CompactBookingRow({
  booking,
  referenceLabel = 'Event booking ref',
}: {
  booking: BookingRecord;
  referenceLabel?: string;
}) {
  return (
    <Stack gap={6} py="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={700}>{booking.circuit}</Text>
          <Text size="sm" c="dimmed">
            {formatOverviewDate(booking.date)} • {booking.provider}
          </Text>
        </Stack>
        <Badge color={bookingColor(booking.status)}>
          {titleCase(booking.status)}
        </Badge>
      </Group>

      <Group gap="sm" wrap="wrap">
        <TripDetailLine
          label={referenceLabel}
          value={booking.bookingReference || 'Open'}
          dimmed={!booking.bookingReference}
          monospace={Boolean(booking.bookingReference)}
        />
        <TripDetailLine
          label="Stay"
          value={booking.accommodationName || 'Open'}
          dimmed={!booking.accommodationName}
        />
        <TripDetailLine
          label="Hotel ref"
          value={booking.accommodationReference || 'Open'}
          dimmed={!booking.accommodationReference}
          monospace={Boolean(booking.accommodationReference)}
        />
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
  privateRefsOpenCount,
  nextDays,
  upcomingBookings,
}: DashboardIndexPageProps) {
  const nextBooking = upcomingBookings[0] ?? null;
  const nextLiveDay = nextDays[0] ?? null;
  const nextBookingDay = nextBooking
    ? (nextDays.find((day) => day.dayId === nextBooking.dayId) ?? null)
    : null;
  const focusDay = nextBooking ? nextBookingDay : nextLiveDay;
  const nextTripType = nextBooking?.type ?? focusDay?.type;
  const nextTripReferenceLabel = bookingReferenceLabel(nextTripType);
  const nextTripItems = nextBooking
    ? [
        {
          label: 'Trip status',
          value: titleCase(nextBooking.status),
          dimmed: false,
          monospace: false,
        },
        {
          label: nextTripReferenceLabel,
          value: nextBooking.bookingReference || 'Not added yet',
          dimmed: !nextBooking.bookingReference,
          monospace: Boolean(nextBooking.bookingReference),
        },
        {
          label: 'Shared stay',
          value: nextBooking.accommodationName || 'Not added yet',
          dimmed: !nextBooking.accommodationName,
          monospace: false,
        },
        {
          label: 'Hotel reference',
          value: nextBooking.accommodationReference || 'Not added yet',
          dimmed: !nextBooking.accommodationReference,
          monospace: Boolean(nextBooking.accommodationReference),
        },
        ...(nextBooking.notes
          ? [
              {
                label: 'Private note',
                value: nextBooking.notes,
                dimmed: false,
                monospace: false,
              },
            ]
          : []),
      ]
    : [
        {
          label: 'Trip status',
          value: 'Not added to your bookings yet',
          dimmed: true,
          monospace: false,
        },
        {
          label: 'Shared stay',
          value: 'No shared stay linked yet',
          dimmed: true,
          monospace: false,
        },
      ];
  const nextTripTaskItems = nextBooking
    ? nextTripTasks(nextBooking, nextBooking.type)
    : ['Review the live calendar and add the next date worth locking in.'];

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description="Start with the next trip, check the references you will actually need, then clear the gaps still open."
        meta={
          <OverviewHeaderSummary
            availableDaysCount={availableDaysCount}
            daysThisMonth={daysThisMonth}
            activeBookingsCount={activeBookingsCount}
            sharedStayCount={sharedStayCount}
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

      <Paper
        className="shell-card overview-focus-panel"
        p={{ base: 'md', sm: 'xl' }}
      >
        {nextBooking || focusDay ? (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="lg">
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={700} c="brand.7">
                  Next trip
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
                {nextTripType ? (
                  <Badge color={typeColor(nextTripType)}>
                    {titleCase(nextTripType)}
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

            <SimpleGrid
              cols={{ base: 1, lg: 2 }}
              spacing={{ base: 'md', sm: 'lg' }}
            >
              <Stack gap="sm">
                <Text fw={700}>Trip details</Text>
                <Stack gap={8}>
                  {nextTripItems.map((item) => (
                    <TripDetailLine
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      dimmed={item.dimmed}
                      monospace={item.monospace}
                    />
                  ))}
                </Stack>
              </Stack>
              <Stack gap="sm">
                <Text fw={700}>What to do now</Text>
                <Stack gap={6}>
                  {nextTripTaskItems.map((task) => (
                    <Text key={task} size="sm">
                      {task}
                    </Text>
                  ))}
                </Stack>
                <Group gap="sm" mt="xs">
                  <Button
                    component={Link}
                    to={nextBooking ? '/dashboard/bookings' : '/dashboard/days'}
                    w="fit-content"
                  >
                    {nextBooking ? 'Open my bookings' : 'Browse live days'}
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

      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing={{ base: 'md', sm: 'lg' }}>
        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
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

        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Upcoming trips</Title>
                <Text size="sm" c="dimmed">
                  Keep the next few dates, refs, and stay details visible
                  without opening the editor first.
                </Text>
              </Stack>
              <Button
                component={Link}
                to="/dashboard/bookings"
                variant="subtle"
              >
                Open all
              </Button>
            </Group>

            {upcomingBookings.length > 0 ? (
              <Stack gap={0}>
                {upcomingBookings.slice(0, 3).map((booking, index) => (
                  <div key={booking.bookingId}>
                    <CompactBookingRow
                      booking={booking}
                      referenceLabel={
                        booking.dayId === nextBooking?.dayId
                          ? nextTripReferenceLabel
                          : 'Event booking ref'
                      }
                    />
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

        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
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
