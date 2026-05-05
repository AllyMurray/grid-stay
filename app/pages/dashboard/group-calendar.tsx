import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  MultiSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBuildingSkyscraper,
  IconCalendarMonth,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconUsersGroup,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type {
  GroupCalendarAttendee,
  GroupCalendarData,
  GroupCalendarEvent,
} from '~/lib/auth/members.server';
import { getAccommodationPlanSummary } from '~/lib/bookings/accommodation';
import { formatArrivalDateTime } from '~/lib/dates/arrival';
import { formatDateOnly } from '~/lib/dates/date-only';

type VisibleStatus = 'booked' | 'maybe';

interface FilteredCalendarEvent extends GroupCalendarEvent {
  filteredAttendees: GroupCalendarAttendee[];
  filteredBookedCount: number;
  filteredMaybeCount: number;
}

interface MonthCell {
  date: string;
  inMonth: boolean;
}

const visibleStatusOptions: VisibleStatus[] = ['booked', 'maybe'];
const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const maxVisibleCircuitLabels = 2;
const maxVisibleAttendeeInitials = 4;

function formatMonthTitle(value: string) {
  return formatDateOnly(value, {
    month: 'long',
    year: 'numeric',
  });
}

function formatLongDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDayNumber(value: string) {
  return formatDateOnly(value, { day: 'numeric' });
}

function formatDayType(type: GroupCalendarEvent['type']) {
  switch (type) {
    case 'race_day':
      return 'Race day';
    case 'test_day':
      return 'Test day';
    case 'track_day':
      return 'Track day';
    case 'road_drive':
      return 'Road drive';
  }
}

function statusColor(status: VisibleStatus) {
  return status === 'booked' ? 'green' : 'yellow';
}

function statusLabel(status: VisibleStatus) {
  return status === 'booked' ? 'Booked' : 'Maybe';
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1) ?? '') : '';
  const initials = `${first.charAt(0)}${last.charAt(0) || first.charAt(1)}`;

  return initials.toUpperCase();
}

function getCircuitLabel(event: GroupCalendarEvent) {
  return event.layout ? `${event.circuit} ${event.layout}` : event.circuit;
}

function getCircuitLabels(events: GroupCalendarEvent[]) {
  return [...new Set(events.map(getCircuitLabel))];
}

function createAvailableDayHref(dayId: string) {
  const params = new URLSearchParams({ day: dayId });
  return `/dashboard/days?${params.toString()}`;
}

function buildMonthCells(month: string): MonthCell[] {
  const start = dayjs(month).startOf('month');
  const end = dayjs(month).endOf('month');
  const startOffset = (start.day() + 6) % 7;
  const firstCell = start.subtract(startOffset, 'day');
  const totalCells = Math.ceil((startOffset + end.date()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const date = firstCell.add(index, 'day');
    return {
      date: date.format('YYYY-MM-DD'),
      inMonth: date.month() === start.month(),
    };
  });
}

function filterEvent(
  event: GroupCalendarEvent,
  selectedMemberIds: Set<string>,
  visibleStatuses: Set<VisibleStatus>,
): FilteredCalendarEvent | null {
  const filteredAttendees = event.attendees.filter(
    (attendee) =>
      visibleStatuses.has(attendee.status) &&
      (selectedMemberIds.size === 0 || selectedMemberIds.has(attendee.userId)),
  );

  if (filteredAttendees.length === 0) {
    return null;
  }

  return {
    ...event,
    filteredAttendees,
    filteredBookedCount: filteredAttendees.filter(
      (attendee) => attendee.status === 'booked',
    ).length,
    filteredMaybeCount: filteredAttendees.filter(
      (attendee) => attendee.status === 'maybe',
    ).length,
  };
}

function groupEventsByDate(events: FilteredCalendarEvent[]) {
  const groups = new Map<string, FilteredCalendarEvent[]>();

  for (const event of events) {
    const current = groups.get(event.date);
    if (current) {
      current.push(event);
      continue;
    }

    groups.set(event.date, [event]);
  }

  return groups;
}

function getAttendeesForStatus(
  events: FilteredCalendarEvent[],
  status: VisibleStatus,
) {
  const attendees: GroupCalendarAttendee[] = [];
  const seenUserIds = new Set<string>();

  for (const event of events) {
    for (const attendee of event.filteredAttendees) {
      if (attendee.status !== status || seenUserIds.has(attendee.userId)) {
        continue;
      }

      attendees.push(attendee);
      seenUserIds.add(attendee.userId);
    }
  }

  return attendees;
}

function getDayCellLabel(date: string, events: FilteredCalendarEvent[]) {
  if (events.length === 0) {
    return `${formatLongDate(date)}: no member plans`;
  }

  const bookedCount = events.reduce(
    (count, event) => count + event.filteredBookedCount,
    0,
  );
  const maybeCount = events.reduce(
    (count, event) => count + event.filteredMaybeCount,
    0,
  );
  const circuitLabels = getCircuitLabels(events);
  const eventLabel = events.length === 1 ? 'event' : 'events';

  return `${formatLongDate(date)}: ${events.length} ${eventLabel}, ${bookedCount} booked, ${maybeCount} maybe, tracks: ${circuitLabels.join(', ')}`;
}

function CalendarInitialsGroup({
  attendees,
  status,
}: {
  attendees: GroupCalendarAttendee[];
  status: VisibleStatus;
}) {
  if (attendees.length === 0) {
    return null;
  }

  const visibleAttendees = attendees.slice(0, maxVisibleAttendeeInitials);
  const remainingCount = attendees.length - visibleAttendees.length;

  return (
    <Group
      gap={0}
      wrap="nowrap"
      className="group-calendar-initials-group"
      role="img"
      aria-label={`${statusLabel(status)}: ${attendees
        .map((attendee) => attendee.userName)
        .join(', ')}`}
    >
      {visibleAttendees.map((attendee) => (
        <Avatar
          key={attendee.userId}
          aria-hidden="true"
          className="group-calendar-initial-avatar"
          color={statusColor(status)}
          radius="xl"
          size={22}
          variant="filled"
        >
          {getInitials(attendee.userName)}
        </Avatar>
      ))}
      {remainingCount > 0 ? (
        <Avatar
          aria-hidden="true"
          className="group-calendar-initial-avatar"
          color={statusColor(status)}
          radius="xl"
          size={22}
          variant="light"
        >
          +{remainingCount}
        </Avatar>
      ) : null}
    </Group>
  );
}

function CalendarStatusSummary({
  attendees,
  count,
  status,
}: {
  attendees: GroupCalendarAttendee[];
  count: number;
  status: VisibleStatus;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <Group gap={4} wrap="nowrap" className="group-calendar-status-summary">
      <Badge color={statusColor(status)} size="xs">
        {count}
      </Badge>
      <Text size="xs" className="group-calendar-count-label">
        {status}
      </Text>
      <CalendarInitialsGroup attendees={attendees} status={status} />
    </Group>
  );
}

function AttendeeList({
  title,
  attendees,
  status,
}: {
  title: string;
  attendees: GroupCalendarAttendee[];
  status: VisibleStatus;
}) {
  if (attendees.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge color={statusColor(status)}>{attendees.length}</Badge>
        <Text size="sm" fw={800}>
          {title}
        </Text>
      </Group>

      <Stack gap="xs">
        {attendees.map((attendee) => (
          <Group
            key={attendee.userId}
            gap="sm"
            wrap="nowrap"
            align="flex-start"
          >
            <Avatar
              src={attendee.userImage}
              alt={attendee.userName}
              size={34}
              radius="sm"
            />
            <Stack gap={2}>
              <Text size="sm" fw={800}>
                {attendee.userName}
              </Text>
              {attendee.arrivalDateTime ? (
                <Group gap="xs" c="dimmed">
                  <IconClock size={14} />
                  <Text size="xs">
                    {formatArrivalDateTime(attendee.arrivalDateTime)}
                  </Text>
                </Group>
              ) : null}
              <Group gap="xs" c="dimmed">
                <IconBuildingSkyscraper size={14} />
                <Text size="xs">{getAccommodationPlanSummary(attendee)}</Text>
              </Group>
            </Stack>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

function EventDetailCard({ event }: { event: FilteredCalendarEvent }) {
  const bookedAttendees = event.filteredAttendees.filter(
    (attendee) => attendee.status === 'booked',
  );
  const maybeAttendees = event.filteredAttendees.filter(
    (attendee) => attendee.status === 'maybe',
  );

  return (
    <Paper className="shell-card" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Group gap="xs" wrap="wrap">
              <Title order={3}>{getCircuitLabel(event)}</Title>
              <Badge color="brand" variant="light">
                {formatDayType(event.type)}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {event.provider} • {event.description}
            </Text>
          </Stack>

          <Button
            component={Link}
            to={createAvailableDayHref(event.dayId)}
            variant="default"
            size="sm"
          >
            Open day
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <AttendeeList
            title="Booked"
            attendees={bookedAttendees}
            status="booked"
          />
          <AttendeeList
            title="Maybe"
            attendees={maybeAttendees}
            status="maybe"
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function CalendarDayCell({
  cell,
  events,
  selected,
  onSelect,
}: {
  cell: MonthCell;
  events: FilteredCalendarEvent[];
  selected: boolean;
  onSelect: () => void;
}) {
  const bookedCount = events.reduce(
    (count, event) => count + event.filteredBookedCount,
    0,
  );
  const maybeCount = events.reduce(
    (count, event) => count + event.filteredMaybeCount,
    0,
  );
  const bookedAttendees = getAttendeesForStatus(events, 'booked');
  const maybeAttendees = getAttendeesForStatus(events, 'maybe');
  const hasEvents = events.length > 0;
  const circuitLabels = getCircuitLabels(events);
  const visibleCircuitLabels = circuitLabels.slice(0, maxVisibleCircuitLabels);
  const hiddenCircuitCount = circuitLabels.length - visibleCircuitLabels.length;

  return (
    <UnstyledButton
      className="group-calendar-day"
      data-in-month={cell.inMonth ? 'true' : undefined}
      data-has-events={hasEvents ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      disabled={!cell.inMonth || !hasEvents}
      aria-label={getDayCellLabel(cell.date, events)}
      onClick={onSelect}
    >
      <Stack gap={6} h="100%">
        <Group justify="space-between" gap={4} wrap="nowrap">
          <Text size="sm" fw={800}>
            {formatDayNumber(cell.date)}
          </Text>
          {events.length > 1 ? (
            <Badge size="xs" variant="light" color="brand">
              {events.length}
            </Badge>
          ) : null}
        </Group>

        {hasEvents ? (
          <Stack gap={5} mt="auto">
            <Stack gap={2} className="group-calendar-track-list">
              {visibleCircuitLabels.map((label) => (
                <Text
                  key={label}
                  component="span"
                  className="group-calendar-track-name"
                  fw={800}
                >
                  {label}
                </Text>
              ))}
              {hiddenCircuitCount > 0 ? (
                <Text
                  component="span"
                  className="group-calendar-track-more"
                  c="dimmed"
                  fw={700}
                >
                  +{hiddenCircuitCount} more
                </Text>
              ) : null}
            </Stack>

            <CalendarStatusSummary
              attendees={bookedAttendees}
              count={bookedCount}
              status="booked"
            />
            <CalendarStatusSummary
              attendees={maybeAttendees}
              count={maybeCount}
              status="maybe"
            />
          </Stack>
        ) : null}
      </Stack>
    </UnstyledButton>
  );
}

export function GroupCalendarPage({
  members,
  events,
  today,
}: GroupCalendarData) {
  const [month, setMonth] = useState(dayjs(today).startOf('month'));
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [visibleStatuses, setVisibleStatuses] =
    useState<VisibleStatus[]>(visibleStatusOptions);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerOpened, drawerHandlers] = useDisclosure(false);

  const filteredEvents = useMemo(() => {
    const selectedMembers = new Set(selectedMemberIds);
    const statuses = new Set(visibleStatuses);

    return events
      .map((event) => filterEvent(event, selectedMembers, statuses))
      .filter((event): event is FilteredCalendarEvent => Boolean(event));
  }, [events, selectedMemberIds, visibleStatuses]);

  const eventsByDate = useMemo(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents],
  );
  const monthCells = useMemo(
    () => buildMonthCells(month.format('YYYY-MM-DD')),
    [month],
  );
  const selectedEvents = selectedDate
    ? (eventsByDate.get(selectedDate) ?? [])
    : [];
  const monthEvents = filteredEvents.filter((event) =>
    dayjs(event.date).isSame(month, 'month'),
  );
  const monthActiveDateCount = new Set(monthEvents.map((event) => event.date))
    .size;
  const monthBookedCount = monthEvents.reduce(
    (count, event) => count + event.filteredBookedCount,
    0,
  );
  const monthMaybeCount = monthEvents.reduce(
    (count, event) => count + event.filteredMaybeCount,
    0,
  );
  const shownMemberCount =
    selectedMemberIds.length > 0 ? selectedMemberIds.length : members.length;
  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.name,
  }));

  return (
    <Stack gap="xl">
      <Drawer
        opened={drawerOpened}
        onClose={drawerHandlers.close}
        title={selectedDate ? formatLongDate(selectedDate) : 'Member plans'}
        position="right"
        size="lg"
      >
        {selectedEvents.length > 0 ? (
          <Stack gap="md">
            {selectedEvents.map((event) => (
              <EventDetailCard key={event.dayId} event={event} />
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No member plans match the current filters for this date.
          </Text>
        )}
      </Drawer>

      <PageHeader
        eyebrow="Shared plans"
        title="Group Calendar"
        description="See where members are booked or maybe across the month without opening every member profile."
        meta={
          <Group gap="xs" wrap="wrap">
            <Badge leftSection={<IconCalendarMonth size={14} />} color="brand">
              {monthActiveDateCount}{' '}
              {monthActiveDateCount === 1 ? 'active date' : 'active dates'}
            </Badge>
            <Badge leftSection={<IconCircleCheck size={14} />} color="green">
              {monthBookedCount} booked
            </Badge>
            <Badge color="yellow">{monthMaybeCount} maybe</Badge>
            <Badge leftSection={<IconUsersGroup size={14} />} color="gray">
              {shownMemberCount}{' '}
              {selectedMemberIds.length > 0 ? 'selected' : 'members'}
            </Badge>
          </Group>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <MultiSelect
            label="Show people"
            description="Leave blank to show everyone."
            placeholder="Everyone"
            data={memberOptions}
            value={selectedMemberIds}
            onChange={setSelectedMemberIds}
            searchable
            clearable
          />
          <Checkbox.Group
            label="Show statuses"
            value={visibleStatuses}
            onChange={(value) => setVisibleStatuses(value as VisibleStatus[])}
          >
            <Group gap="md" mt="xs">
              <Checkbox value="booked" label="Booked" />
              <Checkbox value="maybe" label="Maybe" />
            </Group>
          </Checkbox.Group>
        </SimpleGrid>
      </Paper>

      {events.length === 0 ? (
        <EmptyStateCard
          title="No group plans yet"
          description="Booked and maybe trips will appear here once members add them."
          action={
            <Button component={Link} to="/dashboard/days">
              Browse available days
            </Button>
          }
        />
      ) : (
        <Paper className="shell-card" p={{ base: 'sm', sm: 'md' }}>
          <Stack gap="md">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <ActionIcon
                variant="default"
                aria-label="Previous month"
                onClick={() =>
                  setMonth((current) => current.subtract(1, 'month'))
                }
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Title order={2} ta="center" fz={{ base: 'h3', sm: 'h2' }}>
                {formatMonthTitle(month.format('YYYY-MM-DD'))}
              </Title>
              <ActionIcon
                variant="default"
                aria-label="Next month"
                onClick={() => setMonth((current) => current.add(1, 'month'))}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>

            <div className="group-calendar-grid">
              {weekDayLabels.map((label) => (
                <Text
                  key={label}
                  className="group-calendar-weekday"
                  size="xs"
                  fw={800}
                  c="dimmed"
                >
                  {label}
                </Text>
              ))}
              {monthCells.map((cell) => {
                const cellEvents = cell.inMonth
                  ? (eventsByDate.get(cell.date) ?? [])
                  : [];

                return (
                  <CalendarDayCell
                    key={cell.date}
                    cell={cell}
                    events={cellEvents}
                    selected={selectedDate === cell.date}
                    onSelect={() => {
                      setSelectedDate(cell.date);
                      drawerHandlers.open();
                    }}
                  />
                );
              })}
            </div>

            {filteredEvents.length === 0 ? (
              <>
                <Divider />
                <Text size="sm" c="dimmed">
                  No group plans match the current people and status filters.
                </Text>
              </>
            ) : null}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
