import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  Schedule,
  type ScheduleEventData,
  type ScheduleViewLevel,
} from '@mantine/schedule';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import { TripStatusSummary } from '~/components/layout/trip-status-summary';
import type { CalendarFeedOptions } from '~/lib/calendar/feed.server';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

export interface BookingSchedulePageProps {
  bookings: BookingRecord[];
  calendarFeedExists?: boolean;
  calendarFeedUrl?: string | null;
  calendarFeedTokenHint?: string | null;
  calendarFeedOptions?: CalendarFeedOptions;
  today?: string;
}

type CalendarFeedActionResult =
  | {
      ok: true;
      feedExists: boolean;
      feedUrl: string | null;
      tokenHint: string | null;
      options: CalendarFeedOptions;
    }
  | {
      ok: false;
      formError: string;
    };

function toWebcalUrl(feedUrl: string) {
  return feedUrl.replace(/^https?:\/\//, 'webcal://');
}

const defaultCalendarFeedOptions: CalendarFeedOptions = {
  includeMaybe: true,
  includeStay: true,
};

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
  return formatDateOnly(date, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(date: string) {
  return formatDateOnly(date, {
    day: 'numeric',
    month: 'short',
  });
}

function formatMonthLabel(date: string) {
  return formatDateOnly(date, {
    month: 'long',
    year: 'numeric',
  });
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

function filterUpcomingScheduleBookings(
  bookings: BookingRecord[],
  today: string,
) {
  return bookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.date >= today,
  );
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

function CalendarSyncModal({
  opened,
  onClose,
  initialFeedExists,
  initialFeedUrl,
  initialTokenHint,
  initialOptions,
}: {
  opened: boolean;
  onClose: () => void;
  initialFeedExists: boolean;
  initialFeedUrl: string | null;
  initialTokenHint: string | null;
  initialOptions: CalendarFeedOptions;
}) {
  const fetcher = useFetcher<CalendarFeedActionResult>();
  const [copied, setCopied] = useState(false);
  const [includeMaybe, setIncludeMaybe] = useState(initialOptions.includeMaybe);
  const [includeStay, setIncludeStay] = useState(initialOptions.includeStay);
  const isSubmitting = fetcher.state !== 'idle';
  const actionFeedUrl = fetcher.data?.ok ? fetcher.data.feedUrl : null;
  const actionFeedExists = fetcher.data?.ok ? fetcher.data.feedExists : null;
  const actionTokenHint = fetcher.data?.ok ? fetcher.data.tokenHint : null;
  const feedUrl = actionFeedUrl ?? initialFeedUrl;
  const feedExists = actionFeedExists ?? initialFeedExists;
  const tokenHint = actionTokenHint ?? initialTokenHint;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  useEffect(() => {
    if (fetcher.data?.ok) {
      setIncludeMaybe(fetcher.data.options.includeMaybe);
      setIncludeStay(fetcher.data.options.includeStay);
    }
  }, [fetcher.data]);

  const optionInputs = (
    <>
      <input type="hidden" name="includeMaybe" value={String(includeMaybe)} />
      <input type="hidden" name="includeStay" value={String(includeStay)} />
    </>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Sync calendar"
      centered
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Subscribe from Apple Calendar, Google Calendar, Outlook, or another
          calendar app. Cancelled trips are always left out of the feed.
        </Text>

        <Stack gap="xs">
          <Text size="sm" fw={700}>
            Calendar contents
          </Text>
          <Checkbox
            label="Include trips marked maybe"
            checked={includeMaybe}
            onChange={(event) => setIncludeMaybe(event.currentTarget.checked)}
          />
          <Checkbox
            label="Include shared stay names"
            checked={includeStay}
            onChange={(event) => setIncludeStay(event.currentTarget.checked)}
          />
        </Stack>

        {formError ? (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        ) : null}

        {feedUrl ? (
          <>
            <TextInput
              label="Private calendar link"
              value={feedUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <Group gap="sm" wrap="wrap">
              <Button component="a" href={toWebcalUrl(feedUrl)}>
                Subscribe on this device
              </Button>
              <Button
                component="a"
                href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
                  feedUrl,
                )}`}
                target="_blank"
                rel="noreferrer"
                variant="default"
              >
                Add to Google Calendar
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(feedUrl);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </Group>
          </>
        ) : feedExists ? (
          <Text size="sm">
            A private calendar feed is active
            {tokenHint ? `, ending ${tokenHint}` : ''}. Regenerate the link to
            copy a fresh URL.
          </Text>
        ) : (
          <Text size="sm">
            Create a private calendar link first. Anyone with the link can see
            the trips in your schedule.
          </Text>
        )}

        <Divider />

        <Group justify="space-between" align="center" gap="md">
          <Text size="sm" c="dimmed">
            Saving options updates this feed. Regenerating the link turns off
            the previous one.
          </Text>
          <Group gap="xs" justify="flex-end">
            {feedExists ? (
              <fetcher.Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="saveCalendarFeedOptions"
                />
                {optionInputs}
                <Button type="submit" variant="default" loading={isSubmitting}>
                  Save options
                </Button>
              </fetcher.Form>
            ) : null}
            <fetcher.Form method="post">
              <input
                type="hidden"
                name="intent"
                value={
                  feedExists ? 'regenerateCalendarFeed' : 'createCalendarFeed'
                }
              />
              {optionInputs}
              <Button type="submit" variant="default" loading={isSubmitting}>
                {feedExists ? 'Regenerate link' : 'Create link'}
              </Button>
            </fetcher.Form>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

function MobileBookingList({ bookings }: { bookings: BookingRecord[] }) {
  const sections = groupBookingsByMonth(bookings);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Title order={3}>Upcoming trips</Title>
            <Text size="sm" c="dimmed">
              A simple month-by-month view of the trips still ahead.
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

export function BookingSchedulePage({
  bookings,
  calendarFeedExists = false,
  calendarFeedUrl = null,
  calendarFeedTokenHint = null,
  calendarFeedOptions = defaultCalendarFeedOptions,
  today = new Date().toISOString().slice(0, 10),
}: BookingSchedulePageProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false, {
    getInitialValueInEffect: false,
  });
  const [syncOpened, syncHandlers] = useDisclosure(false);
  const sortedBookings = useMemo(
    () => [...bookings].sort(sortBookings),
    [bookings],
  );
  const scheduleBookings = useMemo(
    () => filterUpcomingScheduleBookings(sortedBookings, today),
    [sortedBookings, today],
  );
  const confirmedCount = scheduleBookings.filter(
    (booking) => booking.status === 'booked',
  ).length;
  const maybeCount = scheduleBookings.filter(
    (booking) => booking.status === 'maybe',
  ).length;
  const sharedStayCount = scheduleBookings.filter((booking) =>
    Boolean(booking.accommodationName?.trim()),
  ).length;
  const scheduleEvents = useMemo(
    () => buildScheduleEvents(scheduleBookings),
    [scheduleBookings],
  );
  const [view, setView] = useState<ScheduleViewLevel>('month');
  const [currentDate, setCurrentDate] = useState<string>(
    scheduleBookings[0]?.date ?? today,
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    getDefaultSelectedBookingId(scheduleBookings, today),
  );

  useEffect(() => {
    if (scheduleBookings.length === 0) {
      setSelectedBookingId(null);
      return;
    }

    setSelectedBookingId((current) => {
      if (
        current &&
        scheduleBookings.some((booking) => booking.bookingId === current)
      ) {
        return current;
      }

      return getDefaultSelectedBookingId(scheduleBookings, today);
    });
  }, [scheduleBookings, today]);

  useEffect(() => {
    if (scheduleBookings.length === 0) {
      return;
    }

    setCurrentDate((current) => current || scheduleBookings[0]!.date);
  }, [scheduleBookings]);

  const selectedBooking =
    scheduleBookings.find(
      (booking) => booking.bookingId === selectedBookingId,
    ) ?? null;

  return (
    <Stack gap="xl">
      <CalendarSyncModal
        opened={syncOpened}
        onClose={syncHandlers.close}
        initialFeedExists={calendarFeedExists || Boolean(calendarFeedUrl)}
        initialFeedUrl={calendarFeedUrl}
        initialTokenHint={calendarFeedTokenHint}
        initialOptions={calendarFeedOptions}
      />
      <PageHeader
        eyebrow="Trip calendar"
        title="Schedule"
        description="See your upcoming trips at a glance, then jump into My Bookings whenever you need the full history or private details."
        meta={
          <TripStatusSummary
            totalCount={scheduleBookings.length}
            confirmedCount={confirmedCount}
            maybeCount={maybeCount}
            sharedStayCount={sharedStayCount}
          />
        }
        actions={
          <Group gap="sm" wrap="wrap">
            <Button type="button" variant="default" onClick={syncHandlers.open}>
              Sync calendar
            </Button>
            <Button component={Link} to="/dashboard/bookings" variant="default">
              View all bookings
            </Button>
          </Group>
        }
      />

      {scheduleBookings.length === 0 ? (
        <EmptyStateCard
          title={
            bookings.length > 0
              ? 'No upcoming trips'
              : 'No trips to schedule yet'
          }
          description={
            bookings.length > 0
              ? 'Your past and cancelled trips are still available in My Bookings.'
              : 'Add the next race, test, or track day first, then come back here for a cleaner season view.'
          }
          action={
            <Button
              component={Link}
              to={
                bookings.length > 0 ? '/dashboard/bookings' : '/dashboard/days'
              }
            >
              {bookings.length > 0
                ? 'View all bookings'
                : 'Browse available days'}
            </Button>
          }
        />
      ) : isMobile ? (
        <MobileBookingList bookings={scheduleBookings} />
      ) : (
        <>
          <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
            <Stack gap="md">
              <Group justify="space-between" align="flex-end" gap="md">
                <Stack gap={2}>
                  <Title order={3}>Calendar</Title>
                  <Text size="sm" c="dimmed">
                    Month and year views work best for whole-day bookings, so
                    this page stays focused on upcoming trips rather than editor
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
                  const bookingForDay = scheduleBookings.find(
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
