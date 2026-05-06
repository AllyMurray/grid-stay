import { Avatar, Badge, Button, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconCircleCheck,
  IconClock,
  IconHotelService,
} from '@tabler/icons-react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type {
  MemberBookedDay,
  MemberBookedDaysData,
  MemberDayBookingActionResult,
} from '~/lib/auth/members.server';
import { getAccommodationPlanSummary } from '~/lib/bookings/accommodation';
import type { BookingStatus } from '~/lib/constants/enums';
import { formatArrivalDateTime } from '~/lib/dates/arrival';
import { formatDateOnly } from '~/lib/dates/date-only';

interface MyMemberDayBooking {
  bookingId: string;
  status: BookingStatus;
}

export interface MemberDaysPageProps extends MemberBookedDaysData {
  myBookingsByDay: Record<string, MyMemberDayBooking>;
}

function formatDayDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDayType(type: MemberBookedDay['type']) {
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

function statusColor(status: BookingStatus) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
  }
}

function statusLabel(status: BookingStatus) {
  switch (status) {
    case 'booked':
      return 'Booked';
    case 'maybe':
      return 'Maybe';
    case 'cancelled':
      return 'Cancelled';
  }
}

function createAvailableDayHref(dayId: string) {
  const params = new URLSearchParams({ day: dayId });
  return `/dashboard/days?${params.toString()}`;
}

function MemberDayAction({
  day,
  myBooking,
}: {
  day: MemberBookedDay;
  myBooking?: MyMemberDayBooking;
}) {
  const fetcher = useFetcher<MemberDayBookingActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  if (myBooking && myBooking.status !== 'cancelled') {
    return (
      <Button component={Link} to="/dashboard/bookings" size="sm" color="brand">
        Open my booking
      </Button>
    );
  }

  return (
    <Stack gap={4} align="flex-start">
      <fetcher.Form method="post">
        <input type="hidden" name="dayId" value={day.dayId} />
        <Group gap="xs" wrap="wrap">
          <Button
            type="submit"
            name="status"
            value="maybe"
            size="sm"
            variant="default"
            disabled={isSubmitting}
          >
            Add as maybe
          </Button>
          <Button
            type="submit"
            name="status"
            value="booked"
            size="sm"
            color="brand"
            loading={isSubmitting}
          >
            Add as booked
          </Button>
        </Group>
      </fetcher.Form>

      {formError ? (
        <Text size="xs" c="red">
          {formError}
        </Text>
      ) : null}
    </Stack>
  );
}

function MemberDayRow({
  day,
  myBooking,
}: {
  day: MemberBookedDay;
  myBooking?: MyMemberDayBooking;
}) {
  const circuitLabel = day.layout ? `${day.circuit} ${day.layout}` : day.circuit;

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" gap="md" align="flex-start">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon radius="sm" variant="light" color="brand">
              <IconCalendarEvent size={18} />
            </ThemeIcon>
            <Stack gap={4}>
              <Group gap="xs" wrap="wrap">
                <Title order={3} fz="h4">
                  {circuitLabel}
                </Title>
                <Badge color={statusColor(day.status)} variant="light">
                  {statusLabel(day.status)}
                </Badge>
                {myBooking && myBooking.status !== 'cancelled' ? (
                  <Badge color={statusColor(myBooking.status)} variant="light">
                    In my bookings
                  </Badge>
                ) : null}
              </Group>
              <Text size="sm" c="dimmed">
                {formatDayDate(day.date)} • {formatDayType(day.type)} • {day.provider}
              </Text>
              <Text size="sm">{day.description}</Text>
            </Stack>
          </Group>

          <Group gap="xs" wrap="wrap" justify="flex-end">
            <Button
              component={Link}
              to={createAvailableDayHref(day.dayId)}
              size="sm"
              variant="subtle"
            >
              View day
            </Button>
            <MemberDayAction day={day} myBooking={myBooking} />
          </Group>
        </Group>

        <Group gap="xs" c="dimmed">
          <IconHotelService size={16} />
          <Text size="sm">Accommodation: {getAccommodationPlanSummary(day)}</Text>
        </Group>
        {day.arrivalDateTime ? (
          <Group gap="xs" c="dimmed">
            <IconClock size={16} />
            <Text size="sm">Arrival: {formatArrivalDateTime(day.arrivalDateTime)}</Text>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function MemberDaysPage({ member, days, myBookingsByDay }: MemberDaysPageProps) {
  const bookedCount = days.filter((day) => day.status === 'booked').length;
  const maybeCount = days.filter((day) => day.status === 'maybe').length;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Members"
        title={`${member.name}'s days`}
        description="See the upcoming days this member has shared, then add the same day to your own bookings."
        actions={
          <Button
            component={Link}
            to="/dashboard/members"
            variant="default"
            leftSection={<IconArrowLeft size={18} />}
          >
            Back to members
          </Button>
        }
        meta={
          <Group gap="sm" wrap="wrap">
            <Group gap="sm">
              <Avatar src={member.image} alt={member.name} radius="sm">
                {member.name.charAt(0).toUpperCase()}
              </Avatar>
              <Text fw={700}>{member.name}</Text>
            </Group>
            <Badge color="green" variant="light" leftSection={<IconCircleCheck size={12} />}>
              {bookedCount} booked
            </Badge>
            <Badge color="yellow" variant="light" leftSection={<IconClock size={12} />}>
              {maybeCount} maybe
            </Badge>
          </Group>
        }
      />

      {days.length > 0 ? (
        <Stack gap="md">
          {days.map((day) => (
            <MemberDayRow key={day.dayId} day={day} myBooking={myBookingsByDay[day.dayId]} />
          ))}
        </Stack>
      ) : (
        <EmptyStateCard
          title="No upcoming shared days"
          description="This member does not have any upcoming booked or maybe days yet."
        />
      )}
    </Stack>
  );
}
