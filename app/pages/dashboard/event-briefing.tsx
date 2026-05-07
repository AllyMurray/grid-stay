import {
  Alert,
  Badge,
  Box,
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
  IconAlertCircle,
  IconBell,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconClock,
  IconLock,
  IconMapPin,
  IconReceipt2,
  IconRoad,
  IconUsers,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import { getAccommodationPlanSummary } from '~/lib/bookings/accommodation';
import type { EventBriefingData, EventBriefingPrompt } from '~/lib/bookings/event-briefing.server';
import { formatArrivalDateTime, resolveArrivalDateTime } from '~/lib/dates/arrival';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { SharedAttendee } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { EventCostSummary } from '~/lib/db/services/cost-splitting.server';

export interface EventBriefingPageProps {
  data: EventBriefingData;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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

function typeColor(type: BookingRecord['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'orange';
    case 'track_day':
      return 'blue';
    case 'road_drive':
      return 'green';
  }
}

function formatDayLongDate(date: string) {
  return formatDateOnly(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function createBookingHref(bookingId: string) {
  const params = new URLSearchParams({ booking: bookingId });
  return `/dashboard/bookings?${params.toString()}`;
}

function createDayHref(dayId: string) {
  const params = new URLSearchParams({ day: dayId });
  return `/dashboard/days?${params.toString()}`;
}

function SectionHeading({
  icon,
  title,
  description,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <ThemeIcon variant="light" color={color} size={34}>
        {icon}
      </ThemeIcon>
      <Stack gap={2}>
        <Text fw={800}>{title}</Text>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Stack>
    </Group>
  );
}

function DetailLine({
  label,
  value,
  privateField = false,
}: {
  label: string;
  value?: ReactNode;
  privateField?: boolean;
}) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
      <Stack gap={0}>
        <Text size="sm" fw={700}>
          {label}
        </Text>
        {privateField ? (
          <Text size="xs" c="dimmed">
            Visible only to you
          </Text>
        ) : null}
      </Stack>
      <Box style={{ minWidth: 0, textAlign: 'right' }}>
        {value ? (
          typeof value === 'string' || typeof value === 'number' ? (
            <Text size="sm" ta="right">
              {value}
            </Text>
          ) : (
            value
          )
        ) : (
          <Text size="sm" ta="right">
            Not set
          </Text>
        )}
      </Box>
    </Group>
  );
}

function BriefingPromptList({
  title,
  emptyText,
  prompts,
  color,
}: {
  title: string;
  emptyText: string;
  prompts: EventBriefingPrompt[];
  color: string;
}) {
  return (
    <Stack gap="sm">
      <Text fw={800}>{title}</Text>
      {prompts.length > 0 ? (
        <Stack gap="sm">
          {prompts.map((prompt) => (
            <Group key={prompt.id} justify="space-between" align="flex-start" gap="md">
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={700}>
                  {prompt.title}
                </Text>
                <Text size="sm" c="dimmed">
                  {prompt.description}
                </Text>
              </Stack>
              <Button component={Link} to={prompt.href} variant="light" color={color} size="xs">
                {prompt.actionLabel}
              </Button>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {emptyText}
        </Text>
      )}
    </Stack>
  );
}

function ReadinessPanel({ prompts }: { prompts: EventBriefingPrompt[] }) {
  const needsAttention = prompts.filter((prompt) => prompt.severity === 'needs_attention');
  const optional = prompts.filter((prompt) => prompt.severity === 'optional');

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconAlertCircle size={20} />}
          title="Readiness"
          description="A quick scan of what is missing before the event."
          color={needsAttention.length > 0 ? 'yellow' : 'green'}
        />
        {needsAttention.length === 0 ? (
          <Alert color="green" variant="light">
            No required briefing items need attention.
          </Alert>
        ) : null}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <BriefingPromptList
            title="Needs attention"
            emptyText="Nothing required is missing."
            prompts={needsAttention}
            color="yellow"
          />
          <BriefingPromptList
            title="Optional"
            emptyText="No optional prompts right now."
            prompts={optional}
            color="brand"
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function EventSummaryPanel({ data }: { data: EventBriefingData }) {
  const bookingHref = createBookingHref(data.booking.bookingId);
  const dayHref = createDayHref(data.day.dayId);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="lg">
          <Stack gap="xs">
            <Group gap="xs" wrap="wrap">
              <Badge color={typeColor(data.day.type)}>{titleCase(data.day.type)}</Badge>
              <Badge color={bookingColor(data.booking.status)}>
                {titleCase(data.booking.status)}
              </Badge>
              {data.day.availability ? (
                <Badge color="gray" variant="light">
                  {data.day.availability}
                </Badge>
              ) : null}
            </Group>
            <Title order={2}>{data.day.circuit}</Title>
            <Text c="dimmed">
              {formatDayLongDate(data.day.date)} • {data.day.provider}
            </Text>
            {data.day.description ? <Text>{data.day.description}</Text> : null}
          </Stack>
          <Group gap="xs" justify="flex-end">
            <Button
              component={Link}
              to={bookingHref}
              variant="default"
              leftSection={<IconLock size={16} />}
            >
              Edit booking
            </Button>
            <Button
              component={Link}
              to={dayHref}
              variant="default"
              leftSection={<IconRoad size={16} />}
            >
              Open day plan
            </Button>
            {data.day.bookingUrl ? (
              <Button
                component="a"
                href={data.day.bookingUrl}
                target="_blank"
                rel="noreferrer"
                variant="light"
              >
                Provider booking
              </Button>
            ) : null}
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}

function MyPlanPanel({ booking }: { booking: BookingRecord }) {
  const arrivalDateTime = resolveArrivalDateTime(booking);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconLock size={20} />}
          title="My plan"
          description="Private references stay visible only to you."
          color="brand"
        />
        <Stack gap="sm">
          <DetailLine label="Status" value={titleCase(booking.status)} />
          <DetailLine
            label="Arrival"
            value={arrivalDateTime ? formatArrivalDateTime(arrivalDateTime) : undefined}
          />
          <DetailLine label="Accommodation" value={getAccommodationPlanSummary(booking)} />
          <DetailLine label="Booking reference" value={booking.bookingReference} privateField />
          <DetailLine
            label="Accommodation reference"
            value={booking.accommodationReference}
            privateField
          />
          <DetailLine label="Private notes" value={booking.notes} privateField />
        </Stack>
      </Stack>
    </Paper>
  );
}

function SharedPlanPanel({ data }: { data: EventBriefingData }) {
  const plan = data.sharedPlan;
  const dinnerDetails = [
    plan?.dinnerVenue ? `Venue: ${plan.dinnerVenue}` : null,
    plan?.dinnerTime ? `Time: ${plan.dinnerTime}` : null,
    plan?.dinnerHeadcount ? `Headcount: ${plan.dinnerHeadcount}` : null,
    plan?.dinnerNotes ? `Notes: ${plan.dinnerNotes}` : null,
  ].filter(Boolean);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconMapPin size={20} />}
          title="Shared logistics"
          description="Group-visible paddock notes and dinner details."
          color="green"
        />
        <Stack gap="sm">
          <DetailLine label="Planning note" value={plan?.notes} />
          <DetailLine
            label="Dinner"
            value={
              dinnerDetails.length > 0 ? (
                <Stack gap={2} align="flex-end">
                  {dinnerDetails.map((detail) => (
                    <Text key={detail} size="sm" ta="right">
                      {detail}
                    </Text>
                  ))}
                </Stack>
              ) : undefined
            }
          />
          <DetailLine
            label="Updated"
            value={plan ? `${formatTimestamp(plan.updatedAt)} by ${plan.updatedByName}` : undefined}
          />
        </Stack>
      </Stack>
    </Paper>
  );
}

function getAccommodationGroups(attendees: SharedAttendee[]) {
  const groups = new Map<string, SharedAttendee[]>();

  for (const attendee of attendees) {
    if (attendee.status === 'cancelled' || !attendee.accommodationName?.trim()) {
      continue;
    }

    const name = attendee.accommodationName.trim();
    const current = groups.get(name);
    if (current) {
      current.push(attendee);
    } else {
      groups.set(name, [attendee]);
    }
  }

  return [...groups.entries()].toSorted(([left], [right]) => left.localeCompare(right));
}

function AttendeesPanel({ attendees }: { attendees: SharedAttendee[] }) {
  const activeAttendees = attendees.filter((attendee) => attendee.status !== 'cancelled');

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconUsers size={20} />}
          title="Attendees"
          description="Public group status, arrival, and stay summaries."
          color="blue"
        />
        {activeAttendees.length > 0 ? (
          <Stack gap="sm">
            {activeAttendees.map((attendee, index) => (
              <Stack key={attendee.bookingId} gap="sm">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={700}>{attendee.userName}</Text>
                      <Badge color={bookingColor(attendee.status)} size="sm">
                        {titleCase(attendee.status)}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {getAccommodationPlanSummary(attendee)}
                    </Text>
                  </Stack>
                  <Text size="sm" ta="right" c="dimmed">
                    {attendee.arrivalDateTime
                      ? formatArrivalDateTime(attendee.arrivalDateTime)
                      : 'No arrival set'}
                  </Text>
                </Group>
                {index < activeAttendees.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No active attendees are recorded for this event yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function AccommodationPanel({ attendees }: { attendees: SharedAttendee[] }) {
  const groups = getAccommodationGroups(attendees);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconBuildingSkyscraper size={20} />}
          title="Accommodation"
          description="Shared stay names from active attendee plans."
          color="orange"
        />
        {groups.length > 0 ? (
          <Stack gap="sm">
            {groups.map(([name, attendeesForStay], index) => (
              <Stack key={name} gap="sm">
                <Group justify="space-between" gap="md">
                  <Text fw={700}>{name}</Text>
                  <Text size="sm" c="dimmed">
                    {attendeesForStay.map((attendee) => attendee.userName).join(', ')}
                  </Text>
                </Group>
                {index < groups.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No shared accommodation names are saved yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function GaragePanel({ data }: { data: EventBriefingData }) {
  const options = data.attendance.garageShareOptions ?? [];

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconRoad size={20} />}
          title="Garage sharing"
          description="Garage owners, capacity, open spaces, and your request state."
          color="grape"
        />
        {options.length > 0 ? (
          <Stack gap="sm">
            {options.map((option, index) => (
              <Stack key={option.garageBookingId} gap="sm">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={700}>{option.ownerName}</Text>
                      {option.garageLabel ? <Badge color="gray">{option.garageLabel}</Badge> : null}
                      {option.myRequestStatus ? (
                        <Badge color={option.myRequestStatus === 'approved' ? 'green' : 'yellow'}>
                          Your request {titleCase(option.myRequestStatus)}
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {option.garageCapacity} capacity • {option.openSpaceCount} open •{' '}
                      {option.pendingRequestCount} pending
                    </Text>
                  </Stack>
                  <Text size="sm" c="dimmed" ta="right">
                    {option.ownerArrivalDateTime
                      ? `Arriving ${formatArrivalDateTime(option.ownerArrivalDateTime)}`
                      : 'No owner arrival set'}
                  </Text>
                </Group>
                {index < options.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No garages are recorded for this event yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function CostsPanel({ summary }: { summary: EventCostSummary }) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconReceipt2 size={20} />}
          title="Shared costs"
          description="Cost groups and settlement status visible to you."
          color="teal"
        />
        <DetailLine label="Visible total" value={formatMoney(summary.totalPence)} />
        {summary.groups.length > 0 ? (
          <Stack gap="sm">
            {summary.groups.map((group, index) => (
              <Stack key={group.groupId} gap="sm">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={2}>
                    <Text fw={700}>{group.name}</Text>
                    <Text size="sm" c="dimmed">
                      {group.participants.map((participant) => participant.userName).join(', ')}
                    </Text>
                  </Stack>
                  <Text size="sm" fw={700}>
                    {formatMoney(group.totalPence)}
                  </Text>
                </Group>
                {index < summary.groups.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No cost groups are visible to you yet.
          </Text>
        )}
        {summary.netSettlements.length > 0 ? (
          <>
            <Divider />
            <Stack gap="xs">
              <Text fw={800}>Settlements</Text>
              {summary.netSettlements.map((settlement) => (
                <Group key={settlement.settlementId} justify="space-between" gap="md">
                  <Text size="sm">
                    {settlement.debtorName} owes {settlement.creditorName}
                  </Text>
                  <Badge color={settlement.status === 'received' ? 'green' : 'yellow'}>
                    {formatMoney(settlement.amountPence)} • {titleCase(settlement.status)}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

function UpdatesPanel({ data }: { data: EventBriefingData }) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <SectionHeading
          icon={<IconBell size={20} />}
          title="Latest updates"
          description="Available-day source notifications linked to this event."
          color="brand"
        />
        {data.latestUpdates.length > 0 ? (
          <Stack gap="sm">
            {data.latestUpdates.map((update, index) => (
              <Stack key={update.notificationId} gap="sm">
                <Group justify="space-between" gap="md" align="flex-start">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="wrap">
                      <Badge color={update.type === 'changed_available_day' ? 'yellow' : 'brand'}>
                        {update.type === 'changed_available_day' ? 'Changed day' : 'New day'}
                      </Badge>
                      {!update.isRead ? <Badge color="brand">Unread</Badge> : null}
                    </Group>
                    <Text size="sm">{update.description}</Text>
                  </Stack>
                  <Text size="sm" c="dimmed" ta="right">
                    {formatTimestamp(update.createdAt)}
                  </Text>
                </Group>
                {index < data.latestUpdates.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No source updates are recorded for this event yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

export function EventBriefingPage({ data }: EventBriefingPageProps) {
  const bookingHref = createBookingHref(data.booking.bookingId);
  const dayHref = createDayHref(data.day.dayId);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Event board"
        title="Event Briefing"
        description={`${data.day.circuit} on ${formatDayLongDate(data.day.date)}`}
        meta={
          <Group gap="sm" wrap="wrap">
            <Badge color={bookingColor(data.booking.status)} size="lg">
              {titleCase(data.booking.status)}
            </Badge>
            <Badge color="blue" size="lg">
              {data.attendance.attendeeCount} attending or maybe
            </Badge>
            <Badge color="orange" size="lg">
              {data.attendance.garageOpenSpaceCount ?? 0} garage spaces
            </Badge>
          </Group>
        }
        actions={
          <>
            <Button
              component={Link}
              to={bookingHref}
              variant="default"
              leftSection={<IconLock size={16} />}
            >
              My booking
            </Button>
            <Button
              component={Link}
              to={dayHref}
              variant="default"
              leftSection={<IconCalendarEvent size={16} />}
            >
              Day plan
            </Button>
          </>
        }
      />

      <EventSummaryPanel data={data} />
      <ReadinessPanel prompts={data.readinessPrompts} />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <MyPlanPanel booking={data.booking} />
        <SharedPlanPanel data={data} />
        <AttendeesPanel attendees={data.attendance.attendees} />
        <GaragePanel data={data} />
        <AccommodationPanel attendees={data.attendance.attendees} />
        <CostsPanel summary={data.costSummary} />
      </SimpleGrid>

      <UpdatesPanel data={data} />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Group justify="space-between" gap="md" align="center">
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray">
              <IconClock size={18} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Weather, documents, and event-published updates are outside this V1 briefing.
            </Text>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
}
