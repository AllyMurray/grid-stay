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
import {
  IconCarGarage,
  IconChecklist,
  IconHotelService,
  IconLock,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import {
  getAccommodationPlanSummary,
  hasArrangedAccommodation,
  hasBookedAccommodation,
  needsAccommodationPlan,
} from '~/lib/bookings/accommodation';
import { formatArrivalDateTime } from '~/lib/dates/arrival';
import { formatDateOnly } from '~/lib/dates/date-only';
import type {
  AvailableDay,
  DayAttendanceSummary,
  SharedAttendee,
} from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

export interface OverviewGroupDay {
  day: AvailableDay;
  attendeeCount: number;
  accommodationNames: string[];
  garageOpenSpaceCount: number;
}

export interface DashboardIndexPageProps {
  firstName: string;
  availableDaysCount: number;
  daysThisMonth: number;
  activeBookingsCount: number;
  accommodationPlanCount: number;
  maybeBookingsCount: number;
  tripsMissingStayCount: number;
  missingBookingReferenceCount: number;
  missingHotelReferenceCount: number;
  pendingGarageRequestsCount: number;
  nextDays: AvailableDay[];
  upcomingBookings: BookingRecord[];
  nextTripAttendance: DayAttendanceSummary | null;
  groupDays: OverviewGroupDay[];
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
  accommodationPlanCount,
}: Pick<
  DashboardIndexPageProps,
  | 'availableDaysCount'
  | 'daysThisMonth'
  | 'activeBookingsCount'
  | 'accommodationPlanCount'
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
          {formatCount(accommodationPlanCount, 'accommodation plan')}
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

  if (needsAccommodationPlan(booking)) {
    tasks.push('Set whether you need a hotel for this trip.');
  }

  if (
    hasBookedAccommodation(booking) &&
    !booking.accommodationReference?.trim()
  ) {
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
  href = '/dashboard/bookings?view=manage',
  actionLabel = 'Open',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  value: number;
  color: string;
  href?: string;
  actionLabel?: string;
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
      {value > 0 ? (
        <Button component={Link} to={href} size="compact-sm" variant="default">
          {actionLabel}
        </Button>
      ) : null}
    </Group>
  );
}

function AllClearPanel() {
  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={34} radius="sm" variant="light" color="green">
          <IconChecklist size={18} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text fw={700}>Nothing needs fixing</Text>
          <Text size="sm" c="dimmed">
            Your active bookings have decisions and private references covered.
          </Text>
        </Stack>
      </Group>
      <Group gap="sm" wrap="wrap">
        <Button
          component={Link}
          to="/dashboard/group-calendar"
          variant="default"
        >
          Check group calendar
        </Button>
        <Button component={Link} to="/dashboard/days" variant="subtle">
          Browse available days
        </Button>
      </Group>
    </Stack>
  );
}

function formatAttendeeStatus(status: SharedAttendee['status']) {
  return status === 'booked' ? 'booked' : titleCase(status);
}

function formatAttendeeLine(attendee: SharedAttendee) {
  const arrival = attendee.arrivalDateTime
    ? `arriving ${formatArrivalDateTime(attendee.arrivalDateTime)}`
    : null;
  const accommodation = hasArrangedAccommodation(attendee)
    ? getAccommodationPlanSummary(attendee)
    : null;

  return [formatAttendeeStatus(attendee.status), arrival, accommodation]
    .filter(Boolean)
    .join(' • ');
}

function GroupContextPanel({
  attendance,
}: {
  attendance: DayAttendanceSummary | null;
}) {
  const activeAttendees =
    attendance?.attendees.filter(
      (attendee) => attendee.status !== 'cancelled',
    ) ?? [];
  const visibleAttendees = activeAttendees.slice(0, 4);
  const extraAttendeeCount = Math.max(
    activeAttendees.length - visibleAttendees.length,
    0,
  );
  const accommodationNames = attendance?.accommodationNames ?? [];
  const garageOpenSpaceCount = attendance?.garageOpenSpaceCount ?? 0;
  const garageOwnerCount = attendance?.garageOwnerCount ?? 0;

  return (
    <Stack gap="sm">
      <Text fw={700}>Group context</Text>
      {activeAttendees.length > 0 ? (
        <Stack gap="xs">
          {visibleAttendees.map((attendee) => (
            <Group key={attendee.bookingId} justify="space-between" gap="sm">
              <Text size="sm" fw={700}>
                {attendee.userName}
              </Text>
              <Text size="sm" c="dimmed" ta="right">
                {formatAttendeeLine(attendee)}
              </Text>
            </Group>
          ))}
          {extraAttendeeCount > 0 ? (
            <Text size="sm" c="dimmed">
              {formatCount(extraAttendeeCount, 'more member')}
            </Text>
          ) : null}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          No other group plans are visible for this day yet.
        </Text>
      )}

      <Group gap="xs" wrap="wrap">
        <Badge variant="light" color="blue">
          {formatCount(accommodationNames.length, 'shared stay')}
        </Badge>
        <Badge variant="light" color="orange">
          {garageOwnerCount} garages
        </Badge>
        <Badge variant="light" color="green">
          {formatCount(garageOpenSpaceCount, 'open garage space')}
        </Badge>
      </Group>
    </Stack>
  );
}

function OpportunityRow({ groupDay }: { groupDay: OverviewGroupDay }) {
  const { day } = groupDay;

  return (
    <Stack gap={4} py="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={700}>{day.circuit}</Text>
          <Text size="sm" c="dimmed">
            {formatOverviewDate(day.date)} • {day.provider}
          </Text>
          <Text size="sm">
            {formatCount(groupDay.attendeeCount, 'member')} going
            {groupDay.accommodationNames.length > 0
              ? ` • ${formatCount(groupDay.accommodationNames.length, 'stay')}`
              : ''}
            {groupDay.garageOpenSpaceCount > 0
              ? ` • ${formatCount(groupDay.garageOpenSpaceCount, 'garage space')} open`
              : ''}
          </Text>
        </Stack>
        <Button
          component={Link}
          to={`/dashboard/days?day=${encodeURIComponent(day.dayId)}`}
          size="compact-sm"
          variant="default"
        >
          View day
        </Button>
      </Group>
    </Stack>
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
          label="Accommodation"
          value={getAccommodationPlanSummary(booking)}
          dimmed={!hasArrangedAccommodation(booking)}
        />
        {hasBookedAccommodation(booking) ? (
          <TripDetailLine
            label="Hotel ref"
            value={booking.accommodationReference || 'Open'}
            dimmed={!booking.accommodationReference}
            monospace={Boolean(booking.accommodationReference)}
          />
        ) : null}
      </Group>
    </Stack>
  );
}

export function DashboardIndexPage({
  firstName,
  availableDaysCount,
  daysThisMonth,
  activeBookingsCount,
  accommodationPlanCount,
  maybeBookingsCount,
  tripsMissingStayCount,
  missingBookingReferenceCount,
  missingHotelReferenceCount,
  pendingGarageRequestsCount,
  nextDays,
  upcomingBookings,
  nextTripAttendance,
  groupDays,
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
          label: 'Accommodation',
          value: getAccommodationPlanSummary(nextBooking),
          dimmed: !hasArrangedAccommodation(nextBooking),
          monospace: false,
        },
        ...(hasBookedAccommodation(nextBooking)
          ? [
              {
                label: 'Hotel reference',
                value: nextBooking.accommodationReference || 'Not added yet',
                dimmed: !nextBooking.accommodationReference,
                monospace: Boolean(nextBooking.accommodationReference),
              },
            ]
          : []),
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
          label: 'Accommodation',
          value: 'No accommodation plan yet',
          dimmed: true,
          monospace: false,
        },
      ];
  const nextTripTaskItems = nextBooking
    ? nextTripTasks(nextBooking, nextBooking.type)
    : ['Review the live calendar and add the next date worth locking in.'];
  const attentionTotal =
    maybeBookingsCount +
    tripsMissingStayCount +
    missingBookingReferenceCount +
    missingHotelReferenceCount +
    pendingGarageRequestsCount;
  const focusDayId = nextBooking?.dayId ?? focusDay?.dayId;
  const focusDayHref = focusDayId
    ? `/dashboard/days?day=${encodeURIComponent(focusDayId)}`
    : '/dashboard/days';

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description="Start with the next useful action: your next trip, group plans around it, and anything still open."
        meta={
          <OverviewHeaderSummary
            availableDaysCount={availableDaysCount}
            daysThisMonth={daysThisMonth}
            activeBookingsCount={activeBookingsCount}
            accommodationPlanCount={accommodationPlanCount}
          />
        }
        actions={
          <Group gap="sm">
            <Button component={Link} to="/dashboard/bookings">
              Open my bookings
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
              cols={{ base: 1, lg: 3 }}
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
              <GroupContextPanel attendance={nextTripAttendance} />
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
                    to={
                      nextBooking
                        ? '/dashboard/bookings?view=manage'
                        : '/dashboard/days'
                    }
                    w="fit-content"
                  >
                    {nextBooking ? 'Edit booking' : 'Browse live days'}
                  </Button>
                  <Button
                    component={Link}
                    to={focusDayHref}
                    variant="default"
                    w="fit-content"
                  >
                    View day
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
                  Clear these first so the next trip is not missing decisions,
                  refs, or garage responses.
                </Text>
              </Stack>
              <Button
                component={Link}
                to="/dashboard/bookings?view=manage"
                variant="subtle"
              >
                Review trips
              </Button>
            </Group>

            {attentionTotal === 0 ? (
              <AllClearPanel />
            ) : (
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
                  icon={<IconHotelService size={18} />}
                  title="Accommodation plan open"
                  description="Trips that still need a hotel decision."
                  value={tripsMissingStayCount}
                  color="blue"
                />
                <Divider />
                <AttentionRow
                  icon={<IconLock size={18} />}
                  title="Event refs open"
                  description="Active trips missing event booking references."
                  value={missingBookingReferenceCount}
                  color="gray"
                />
                <Divider />
                <AttentionRow
                  icon={<IconHotelService size={18} />}
                  title="Hotel refs open"
                  description="Booked hotels missing accommodation references."
                  value={missingHotelReferenceCount}
                  color="orange"
                />
                <Divider />
                <AttentionRow
                  icon={<IconCarGarage size={18} />}
                  title="Garage requests"
                  description="Incoming requests waiting for your response."
                  value={pendingGarageRequestsCount}
                  color="green"
                  href="/dashboard/bookings?view=manage"
                  actionLabel="Review"
                />
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Upcoming trips</Title>
                <Text size="sm" c="dimmed">
                  Keep the next few dates, refs, and accommodation details
                  visible without opening the editor first.
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
                Add the first trip from the live days feed and accommodation
                progress will start here.
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="md">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={3}>Opportunities to join</Title>
                <Text size="sm" c="dimmed">
                  Upcoming dates where other members already have plans.
                </Text>
              </Stack>
              <Button
                component={Link}
                to="/dashboard/group-calendar"
                variant="subtle"
              >
                Group calendar
              </Button>
            </Group>

            {groupDays.length > 0 ? (
              <Stack gap={0}>
                {groupDays.slice(0, 3).map((groupDay, index) => (
                  <div key={groupDay.day.dayId}>
                    <OpportunityRow groupDay={groupDay} />
                    {index < Math.min(groupDays.length, 3) - 1 ? (
                      <Divider />
                    ) : null}
                  </div>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No group-booked days appear in the next feed preview yet. The
                group calendar will show the full month view.
              </Text>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
