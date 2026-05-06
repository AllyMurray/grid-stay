import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Schedule, type ScheduleEventData, type ScheduleViewLevel } from '@mantine/schedule';
import dayjs from 'dayjs';
import { type UIEvent, useEffect, useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import { TripStatusSummary } from '~/components/layout/trip-status-summary';
import {
  getAccommodationPlanSummary,
  hasArrangedAccommodation,
  hasBookedAccommodation,
} from '~/lib/bookings/accommodation';
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

const SCHEDULE_LIST_BATCH_SIZE = 7;
const SCHEDULE_CALENDAR_VIEWS: ScheduleViewLevel[] = ['week', 'month', 'year'];
const calendarViewSelectProps = { views: SCHEDULE_CALENDAR_VIEWS };

export type ScheduleDisplayMode = 'list' | 'calendar';

export interface BookingSchedulePanelProps extends BookingSchedulePageProps {
  displayMode?: ScheduleDisplayMode;
  onDisplayModeChange?: (mode: ScheduleDisplayMode) => void;
  showDisplayModeControl?: boolean;
  manageBookingsHref?: string;
  showPastBookings?: boolean;
}

interface ScheduleBookingEventPayload {
  bookingId: string;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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

function filterUpcomingScheduleBookings(bookings: BookingRecord[], today: string) {
  return bookings.filter((booking) => booking.status !== 'cancelled' && booking.date >= today);
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

function getAccommodationLabel(booking: BookingRecord) {
  return booking.status === 'cancelled'
    ? 'No accommodation plan on this trip'
    : getAccommodationPlanSummary(booking);
}

function getReferenceLabel(booking: BookingRecord) {
  if (booking.bookingReference?.trim()) {
    return booking.bookingReference;
  }

  return 'No booking reference saved';
}

function createManageBookingHref(baseHref: string, bookingId: string) {
  const [path, query = ''] = baseHref.split('?');
  const params = new URLSearchParams(query);
  params.delete('view');
  params.set('booking', bookingId);
  return `${path}?${params.toString()}`;
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
        <Badge key={status} color={bookingColor(status)} variant={bookingVariant(status)}>
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
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

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
    <Modal opened={opened} onClose={onClose} title="Sync calendar" centered size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Subscribe from Apple Calendar, Google Calendar, Outlook, or another calendar app.
          Cancelled trips are always left out of the feed.
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
            label="Include accommodation details"
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
            {tokenHint ? `, ending ${tokenHint}` : ''}. Regenerate the link to copy a fresh URL.
          </Text>
        ) : (
          <Text size="sm">
            Create a private calendar link first. Anyone with the link can see the trips in your
            schedule.
          </Text>
        )}

        <Divider />

        <Group justify="space-between" align="center" gap="md">
          <Text size="sm" c="dimmed">
            Saving options updates this feed. Regenerating the link turns off the previous one.
          </Text>
          <Group gap="xs" justify="flex-end">
            {feedExists ? (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="saveCalendarFeedOptions" />
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
                value={feedExists ? 'regenerateCalendarFeed' : 'createCalendarFeed'}
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

function ScheduleListRow({
  booking,
  selected,
  onSelect,
}: {
  booking: BookingRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      className="schedule-list-row"
      data-selected={selected ? 'true' : undefined}
      onClick={onSelect}
      aria-label={`Select ${booking.circuit} on ${formatLongDate(booking.date)}`}
    >
      <Group align="flex-start" gap="md" wrap="nowrap">
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
          <Text size="sm">{getAccommodationLabel(booking)}</Text>
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

function ScheduleListView({
  bookings,
  selectedBookingId,
  onSelectBooking,
  showPastBookings,
}: {
  bookings: BookingRecord[];
  selectedBookingId: string | null;
  onSelectBooking: (bookingId: string) => void;
  showPastBookings: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(SCHEDULE_LIST_BATCH_SIZE);
  const visibleBookings = bookings.slice(0, visibleCount);
  const sections = groupBookingsByMonth(visibleBookings);
  const hasMore = visibleCount < bookings.length;

  const loadMore = () => {
    setVisibleCount((current) => Math.min(current + SCHEDULE_LIST_BATCH_SIZE, bookings.length));
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore) {
      return;
    }

    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 96) {
      loadMore();
    }
  };

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Title order={3}>
              {showPastBookings ? 'Trips' : 'Upcoming trips'}
            </Title>
            <Text size="sm" c="dimmed">
              Showing {visibleBookings.length} of {bookings.length}{' '}
              {showPastBookings ? 'trips' : 'upcoming trips'}. Scroll to load
              the next 7.
            </Text>
          </Stack>
          <ScheduleLegend />
        </Group>

        <ScrollArea.Autosize
          mah={{ base: 520, sm: 640 }}
          type="auto"
          scrollbars="y"
          offsetScrollbars
          viewportProps={{
            onScroll: handleScroll,
          }}
        >
          <Stack gap="lg" pr="sm">
            {sections.map((section) => (
              <Stack key={section.label} gap="xs">
                <Text size="sm" fw={700} c="dimmed">
                  {section.label}
                </Text>
                <Stack gap={0}>
                  {section.items.map((booking, index) => (
                    <div key={booking.bookingId}>
                      <ScheduleListRow
                        booking={booking}
                        selected={booking.bookingId === selectedBookingId}
                        onSelect={() => onSelectBooking(booking.bookingId)}
                      />
                      {index < section.items.length - 1 ? <Divider /> : null}
                    </div>
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        {hasMore ? (
          <Button type="button" variant="default" onClick={loadMore}>
            Load next 7 trips
          </Button>
        ) : (
          <Text size="sm" c="dimmed">
            All upcoming trips loaded.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function SelectedBookingSummary({
  booking,
  manageBookingsHref,
}: {
  booking: BookingRecord;
  manageBookingsHref: string;
}) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Text size="sm" fw={700} c="brand.7">
              Selected trip
            </Text>
            <Title order={3}>{booking.circuit}</Title>
            <Text size="sm" c="dimmed">
              {formatLongDate(booking.date)} • {booking.provider}
            </Text>
            {booking.description ? <Text size="sm">{booking.description}</Text> : null}
          </Stack>

          <Group gap="xs" wrap="wrap" justify="flex-end">
            <Badge
              color={bookingColor(booking.status)}
              variant={bookingVariant(booking.status)}
              size="lg"
            >
              {titleCase(booking.status)}
            </Badge>
            <Button
              component={Link}
              to={createManageBookingHref(
                manageBookingsHref,
                booking.bookingId,
              )}
              variant="default"
            >
              Edit booking
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
          <DetailField label="Accommodation" value={getAccommodationLabel(booking)} />
          <DetailField label="Booking reference" value={getReferenceLabel(booking)} />
          {hasBookedAccommodation(booking) ? (
            <DetailField
              label="Hotel reference"
              value={booking.accommodationReference?.trim() || 'No hotel reference saved'}
            />
          ) : null}
          <DetailField label="Notes" value={booking.notes?.trim() || 'No private notes saved'} />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function CalendarView({
  currentDate,
  view,
  events,
  bookings,
  onDateChange,
  onViewChange,
  onSelectBooking,
}: {
  currentDate: string;
  view: ScheduleViewLevel;
  events: ScheduleEventData<ScheduleBookingEventPayload>[];
  bookings: BookingRecord[];
  onDateChange: (date: string) => void;
  onViewChange: (view: ScheduleViewLevel) => void;
  onSelectBooking: (bookingId: string) => void;
}) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Title order={3}>Calendar</Title>
            <Text size="sm" c="dimmed">
              Week, month, and year views are available for checking where your trips land in the
              season.
            </Text>
          </Stack>
          <ScheduleLegend />
        </Group>

        <Schedule
          date={currentDate}
          onDateChange={onDateChange}
          view={view}
          onViewChange={onViewChange}
          defaultView="month"
          events={events}
          mode="static"
          layout="default"
          onEventClick={(event) => onSelectBooking(String(event.payload?.bookingId ?? event.id))}
          onDayClick={(date) => {
            const bookingForDay = bookings.find((booking) => booking.date === date);

            if (bookingForDay) {
              onSelectBooking(bookingForDay.bookingId);
            }
          }}
          weekViewProps={{
            viewSelectProps: calendarViewSelectProps,
          }}
          monthViewProps={{
            firstDayOfWeek: 1,
            maxEventsPerDay: 4,
            viewSelectProps: calendarViewSelectProps,
          }}
          yearViewProps={{
            firstDayOfWeek: 1,
            viewSelectProps: calendarViewSelectProps,
          }}
        />
      </Stack>
    </Paper>
  );
}

export function BookingSchedulePanel({
  bookings,
  displayMode: controlledDisplayMode,
  onDisplayModeChange,
  showDisplayModeControl = true,
  manageBookingsHref = '/dashboard/bookings',
  calendarFeedExists = false,
  calendarFeedUrl = null,
  calendarFeedTokenHint = null,
  calendarFeedOptions = defaultCalendarFeedOptions,
  today = new Date().toISOString().slice(0, 10),
  showPastBookings = false,
}: BookingSchedulePanelProps) {
  const isCompactCalendar = useMediaQuery('(max-width: 62em)', false, {
    getInitialValueInEffect: false,
  });
  const [syncOpened, syncHandlers] = useDisclosure(false);
  const [internalDisplayMode, setInternalDisplayMode] = useState<ScheduleDisplayMode>('list');
  const displayMode = controlledDisplayMode ?? internalDisplayMode;
  const visibleDisplayMode = isCompactCalendar ? 'list' : displayMode;
  const sortedBookings = useMemo(() => [...bookings].toSorted(sortBookings), [bookings]);
  const scheduleBookings = useMemo(
    () =>
      showPastBookings
        ? sortedBookings.filter((booking) => booking.status !== 'cancelled')
        : filterUpcomingScheduleBookings(sortedBookings, today),
    [showPastBookings, sortedBookings, today],
  );
  const scheduleEvents = useMemo(() => buildScheduleEvents(scheduleBookings), [scheduleBookings]);
  const [view, setView] = useState<ScheduleViewLevel>('month');
  const [currentDate, setCurrentDate] = useState<string>(scheduleBookings[0]?.date ?? today);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    getDefaultSelectedBookingId(scheduleBookings, today),
  );

  useEffect(() => {
    if (scheduleBookings.length === 0) {
      setSelectedBookingId(null);
      return;
    }

    setSelectedBookingId((current) => {
      if (current && scheduleBookings.some((booking) => booking.bookingId === current)) {
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
    scheduleBookings.find((booking) => booking.bookingId === selectedBookingId) ?? null;

  const handleCalendarViewChange = (nextView: ScheduleViewLevel) => {
    setView(nextView === 'day' ? 'week' : nextView);
  };
  const handleDisplayModeChange = (nextMode: ScheduleDisplayMode) => {
    if (controlledDisplayMode === undefined) {
      setInternalDisplayMode(nextMode);
    }

    onDisplayModeChange?.(nextMode);
  };

  return (
    <Stack gap="lg">
      <CalendarSyncModal
        opened={syncOpened}
        onClose={syncHandlers.close}
        initialFeedExists={calendarFeedExists || Boolean(calendarFeedUrl)}
        initialFeedUrl={calendarFeedUrl}
        initialTokenHint={calendarFeedTokenHint}
        initialOptions={calendarFeedOptions}
      />
      {scheduleBookings.length === 0 ? (
        <EmptyStateCard
          title={
            bookings.length > 0 && !showPastBookings
              ? 'No upcoming trips'
              : 'No trips to schedule yet'
          }
          description={
            bookings.length > 0 && !showPastBookings
              ? 'Your past and cancelled trips are still available in My Bookings.'
              : 'Add the next race, test, or track day first, then come back here for a cleaner season view.'
          }
          action={
            <Button
              component={Link}
              to={bookings.length > 0 ? manageBookingsHref : '/dashboard/days'}
            >
              {bookings.length > 0 ? 'View all bookings' : 'Browse available days'}
            </Button>
          }
        />
      ) : (
        <>
          <Group
            justify={showDisplayModeControl ? 'space-between' : 'flex-start'}
            gap="sm"
            wrap="wrap"
          >
            {showDisplayModeControl ? (
              <SegmentedControl
                value={displayMode}
                onChange={(value) => handleDisplayModeChange(value as ScheduleDisplayMode)}
                data={[
                  { label: 'List', value: 'list' },
                  { label: 'Calendar', value: 'calendar' },
                ]}
                w={{ base: '100%', sm: 'auto' }}
              />
            ) : null}
            <Button type="button" variant="default" onClick={syncHandlers.open}>
              Sync calendar
            </Button>
          </Group>

          {visibleDisplayMode === 'list' ? (
            <ScheduleListView
              bookings={scheduleBookings}
              selectedBookingId={selectedBookingId}
              onSelectBooking={setSelectedBookingId}
              showPastBookings={showPastBookings}
            />
          ) : (
            <CalendarView
              currentDate={currentDate}
              view={view}
              events={scheduleEvents}
              bookings={scheduleBookings}
              onDateChange={setCurrentDate}
              onViewChange={handleCalendarViewChange}
              onSelectBooking={setSelectedBookingId}
            />
          )}

          {selectedBooking ? (
            <SelectedBookingSummary
              booking={selectedBooking}
              manageBookingsHref={manageBookingsHref}
            />
          ) : null}
        </>
      )}
    </Stack>
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
  const sortedBookings = useMemo(() => [...bookings].toSorted(sortBookings), [bookings]);
  const scheduleBookings = useMemo(
    () => filterUpcomingScheduleBookings(sortedBookings, today),
    [sortedBookings, today],
  );
  const confirmedCount = scheduleBookings.filter((booking) => booking.status === 'booked').length;
  const maybeCount = scheduleBookings.filter((booking) => booking.status === 'maybe').length;
  const accommodationCount = scheduleBookings.filter(hasArrangedAccommodation).length;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Trip calendar"
        title="Schedule"
        description="See your upcoming trips at a glance, then jump into My Bookings whenever you need the full history or private details."
        meta={
          <TripStatusSummary
            totalCount={scheduleBookings.length}
            confirmedCount={confirmedCount}
            maybeCount={maybeCount}
            accommodationCount={accommodationCount}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/bookings" variant="default">
            View all bookings
          </Button>
        }
      />

      <BookingSchedulePanel
        bookings={bookings}
        calendarFeedExists={calendarFeedExists}
        calendarFeedUrl={calendarFeedUrl}
        calendarFeedTokenHint={calendarFeedTokenHint}
        calendarFeedOptions={calendarFeedOptions}
        today={today}
      />
    </Stack>
  );
}
