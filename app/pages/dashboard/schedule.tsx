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
import { useMediaQuery } from '@mantine/hooks';
import {
  Schedule,
  type ScheduleEventData,
  type ScheduleViewLevel,
} from '@mantine/schedule';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

export interface BookingSchedulePageProps {
  bookings: BookingRecord[];
}

interface ScheduleBookingEventPayload {
  bookingId: string;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function bookingColor(status: BookingRecord['status']) {
  switch (status) {
    case 'booked':
      return '#2f6f4f';
    case 'maybe':
      return '#8a5b1c';
    case 'cancelled':
      return '#565d66';
  }
}

function bookingVariant(status: BookingRecord['status']) {
  switch (status) {
    case 'booked':
      return 'filled' as const;
    case 'maybe':
      return 'filled' as const;
    case 'cancelled':
      return 'light' as const;
  }
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function sortBookings(a: BookingRecord, b: BookingRecord) {
  if (a.status === 'cancelled' && b.status !== 'cancelled') {
    return 1;
  }

  if (b.status === 'cancelled' && a.status !== 'cancelled') {
    return -1;
  }

  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return a.circuit.localeCompare(b.circuit);
}

function getDefaultSelectedBookingId(
  bookings: BookingRecord[],
  today = new Date().toISOString().slice(0, 10),
) {
  const nextActiveBooking = bookings.find(
    (booking) => booking.status !== 'cancelled' && booking.date >= today,
  );

  return nextActiveBooking?.bookingId ?? bookings[0]?.bookingId ?? null;
}

function buildScheduleEvents(
  bookings: BookingRecord[],
): ScheduleEventData<ScheduleBookingEventPayload>[] {
  return bookings.map((booking) => ({
    id: booking.bookingId,
    title: booking.circuit,
    start: `${booking.date} 00:00:00`,
    end: dayjs(booking.date).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
    color: bookingColor(booking.status),
    variant: bookingVariant(booking.status),
    payload: { bookingId: booking.bookingId },
  }));
}

function groupBookingsByMonth(bookings: BookingRecord[]) {
  const groups = new Map<string, BookingRecord[]>();

  for (const booking of bookings) {
    const label = formatMonthLabel(booking.date);
    const current = groups.get(label);
    if (current) {
      current.push(booking);
      continue;
    }

    groups.set(label, [booking]);
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function getSharedStayLabel(booking: BookingRecord) {
  if (booking.accommodationName?.trim()) {
    return booking.accommodationName;
  }

  return booking.status === 'cancelled'
    ? 'No shared stay on this trip'
    : 'No shared stay added yet';
}

function getReferenceLabel(booking: BookingRecord) {
  if (booking.bookingReference?.trim()) {
    return booking.bookingReference;
  }

  return 'No booking reference saved';
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={700}>
        {value}
      </Text>
    </Stack>
  );
}

function ScheduleLegend() {
  return (
    <Group gap="xs" wrap="wrap">
      {(['booked', 'maybe', 'cancelled'] as const).map((status) => (
        <Badge
          key={status}
          color={bookingColor(status)}
          variant={bookingVariant(status)}
        >
          {titleCase(status)}
        </Badge>
      ))}
    </Group>
  );
}

function MobileBookingList({ bookings }: { bookings: BookingRecord[] }) {
  const sections = groupBookingsByMonth(bookings);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Title order={3}>Upcoming and planned trips</Title>
            <Text size="sm" c="dimmed">
              A simple month-by-month view of everything you have already added.
            </Text>
          </Stack>
          <ScheduleLegend />
        </Group>

        {sections.map((section) => (
          <Stack key={section.label} gap="xs">
            <Text size="sm" fw={700} c="dimmed">
              {section.label}
            </Text>
            <Stack gap={0}>
              {section.items.map((booking, index) => (
                <div key={booking.bookingId}>
                  <Group
                    align="flex-start"
                    gap="md"
                    className="schedule-mobile-row"
                  >
                    <Stack gap={2} className="schedule-mobile-date">
                      <Text fw={800}>{formatShortDate(booking.date)}</Text>
                      <Text size="xs" c="dimmed">
                        {booking.provider}
                      </Text>
                    </Stack>

                    <Stack gap={4} className="schedule-mobile-summary">
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700}>{booking.circuit}</Text>
                        <Badge
                          color={bookingColor(booking.status)}
                          variant={bookingVariant(booking.status)}
                          size="sm"
                        >
                          {titleCase(booking.status)}
                        </Badge>
                      </Group>
                      {booking.description ? (
                        <Text size="sm" c="dimmed">
                          {booking.description}
                        </Text>
                      ) : null}
                      <Text size="sm">{getSharedStayLabel(booking)}</Text>
                    </Stack>
                  </Group>
                  {index < section.items.length - 1 ? <Divider /> : null}
                </div>
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

export function BookingSchedulePage({ bookings }: BookingSchedulePageProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false, {
    getInitialValueInEffect: false,
  });
  const sortedBookings = useMemo(
    () => [...bookings].sort(sortBookings),
    [bookings],
  );
  const bookedCount = bookings.filter((booking) => booking.status === 'booked');
  const maybeCount = bookings.filter((booking) => booking.status === 'maybe');
  const sharedStayCount = bookings.filter((booking) =>
    Boolean(booking.accommodationName?.trim()),
  ).length;
  const scheduleEvents = useMemo(
    () => buildScheduleEvents(sortedBookings),
    [sortedBookings],
  );
  const [view, setView] = useState<ScheduleViewLevel>('month');
  const [currentDate, setCurrentDate] = useState<string>(
    sortedBookings[0]?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    getDefaultSelectedBookingId(sortedBookings),
  );

  useEffect(() => {
    if (sortedBookings.length === 0) {
      setSelectedBookingId(null);
      return;
    }

    setSelectedBookingId((current) => {
      if (
        current &&
        sortedBookings.some((booking) => booking.bookingId === current)
      ) {
        return current;
      }

      return getDefaultSelectedBookingId(sortedBookings);
    });
  }, [sortedBookings]);

  useEffect(() => {
    if (sortedBookings.length === 0) {
      return;
    }

    setCurrentDate((current) => current || sortedBookings[0]!.date);
  }, [sortedBookings]);

  const selectedBooking =
    sortedBookings.find((booking) => booking.bookingId === selectedBookingId) ??
    null;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Trip calendar"
        title="Schedule"
        description="See the season at a glance here, then jump into My Bookings whenever you need to edit the private details."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Trips tracked', value: bookings.length },
              { label: 'Confirmed', value: bookedCount.length },
              { label: 'Still deciding', value: maybeCount.length },
              { label: 'Shared stays', value: sharedStayCount },
            ]}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/bookings" variant="default">
            Manage bookings
          </Button>
        }
      />

      {sortedBookings.length === 0 ? (
        <EmptyStateCard
          title="No trips to schedule yet"
          description="Add the next race, test, or track day first, then come back here for a cleaner season view."
          action={
            <Button component={Link} to="/dashboard/days">
              Browse available days
            </Button>
          }
        />
      ) : isMobile ? (
        <MobileBookingList bookings={sortedBookings} />
      ) : (
        <>
          <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-end" gap="md">
                <Stack gap={2}>
                  <Title order={3}>Calendar</Title>
                  <Text size="sm" c="dimmed">
                    Month and year views work best for whole-day bookings, so
                    this page stays focused on the season rather than editor
                    controls.
                  </Text>
                </Stack>
                <ScheduleLegend />
              </Group>

              <Schedule
                date={currentDate}
                onDateChange={setCurrentDate}
                view={view}
                onViewChange={setView}
                defaultView="month"
                events={scheduleEvents}
                mode="static"
                layout="default"
                onEventClick={(event) =>
                  setSelectedBookingId(
                    String(event.payload?.bookingId ?? event.id),
                  )
                }
                onDayClick={(date) => {
                  const bookingForDay = sortedBookings.find(
                    (booking) => booking.date === date,
                  );

                  if (bookingForDay) {
                    setSelectedBookingId(bookingForDay.bookingId);
                  }
                }}
                monthViewProps={{
                  firstDayOfWeek: 1,
                  maxEventsPerDay: 4,
                }}
                yearViewProps={{
                  firstDayOfWeek: 1,
                }}
              />
            </Stack>
          </Paper>

          {selectedBooking ? (
            <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
              <Stack gap="md">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={4}>
                    <Text size="sm" fw={700} c="brand.7">
                      Selected trip
                    </Text>
                    <Title order={3}>{selectedBooking.circuit}</Title>
                    <Text size="sm" c="dimmed">
                      {formatLongDate(selectedBooking.date)} •{' '}
                      {selectedBooking.provider}
                    </Text>
                    {selectedBooking.description ? (
                      <Text size="sm">{selectedBooking.description}</Text>
                    ) : null}
                  </Stack>

                  <Group gap="xs" wrap="wrap" justify="flex-end">
                    <Badge
                      color={bookingColor(selectedBooking.status)}
                      variant={bookingVariant(selectedBooking.status)}
                      size="lg"
                    >
                      {titleCase(selectedBooking.status)}
                    </Badge>
                    <Button
                      component={Link}
                      to="/dashboard/bookings"
                      variant="default"
                    >
                      Manage in My Bookings
                    </Button>
                  </Group>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                  <DetailField
                    label="Shared stay"
                    value={getSharedStayLabel(selectedBooking)}
                  />
                  <DetailField
                    label="Booking reference"
                    value={getReferenceLabel(selectedBooking)}
                  />
                  <DetailField
                    label="Accommodation reference"
                    value={
                      selectedBooking.accommodationReference?.trim() ||
                      'No accommodation reference saved'
                    }
                  />
                  <DetailField
                    label="Notes"
                    value={
                      selectedBooking.notes?.trim() || 'No private notes saved'
                    }
                  />
                </SimpleGrid>
              </Stack>
            </Paper>
          ) : null}
        </>
      )}
    </Stack>
  );
}
