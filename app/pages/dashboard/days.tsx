import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Link, useFetcher, useSearchParams } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { CreateBookingActionResult } from '~/lib/bookings/actions.server';
import type { BookingStatus } from '~/lib/constants/enums';
import type {
  DayBookingSnapshot,
  DayRow,
  DaysFeedData,
  DaysIndexData,
} from '~/lib/days/dashboard-feed.server';
import type {
  DayAttendanceSummary as DayAttendanceDetails,
  SharedAttendee,
} from '~/lib/days/types';

export interface AvailableDaysPageProps {
  data: DaysIndexData;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mergeDayRows(primary: DayRow[], secondary: DayRow[]): DayRow[] {
  const merged = [...primary];
  const seenDayIds = new Set(primary.map((day) => day.dayId));

  for (const day of secondary) {
    if (seenDayIds.has(day.dayId)) {
      continue;
    }

    merged.push(day);
    seenDayIds.add(day.dayId);
  }

  return merged;
}

function createDaysFeedHref(
  filters: DaysIndexData['filters'],
  offset: number,
): string {
  const params = new URLSearchParams();
  if (filters.month) {
    params.set('month', filters.month);
  }
  if (filters.circuit) {
    params.set('circuit', filters.circuit);
  }
  if (filters.provider) {
    params.set('provider', filters.provider);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  params.set('offset', String(offset));

  return `/api/dashboard/days-feed?${params.toString()}`;
}

function createDaysIndexHref(
  filters: DaysIndexData['filters'],
  selectedDayId?: string | null,
): string {
  const params = new URLSearchParams();
  if (filters.month) {
    params.set('month', filters.month);
  }
  if (filters.circuit) {
    params.set('circuit', filters.circuit);
  }
  if (filters.provider) {
    params.set('provider', filters.provider);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (selectedDayId) {
    params.set('day', selectedDayId);
  }

  const query = params.toString();
  return query ? `/dashboard/days?${query}` : '/dashboard/days';
}

function countActiveFilters(filters: DaysIndexData['filters']) {
  return Object.values(filters).filter(Boolean).length;
}

function typeColor(type: DayRow['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'blue';
    case 'track_day':
      return 'orange';
  }
}

function bookingColor(status: BookingStatus) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
  }
}

function formatRefreshedAt(value: string) {
  if (!value) {
    return 'Waiting for the first refresh';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDayListDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function formatDayListWeekday(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
  }).format(new Date(value));
}

function formatDayLongDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

interface DayAttendanceSummaryPreview {
  attendeeCount: number;
  accommodationNames: string[];
}

interface AttendeeStatusGroup {
  key: BookingStatus;
  label: string;
  attendees: SharedAttendee[];
}

interface SharedStayGroup {
  label: string;
  attendees: SharedAttendee[];
}

interface LoadedDaysState {
  filterKey: string;
  days: DayRow[];
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  attendanceSummaries: DaysFeedData['attendanceSummaries'];
  totalCount: number;
  nextOffset: number | null;
}

function createLoadedDaysState(data: DaysIndexData): LoadedDaysState {
  const days = data.selectedDay
    ? mergeDayRows([data.selectedDay], data.days)
    : data.days;

  return {
    filterKey: data.filterKey,
    days,
    myBookingsByDay: data.myBookingsByDay,
    attendanceSummaries: data.selectedDay
      ? {
          ...data.attendanceSummaries,
          ...(data.selectedDaySummary
            ? { [data.selectedDay.dayId]: data.selectedDaySummary }
            : {}),
        }
      : data.attendanceSummaries,
    totalCount: data.totalCount,
    nextOffset: data.nextOffset,
  };
}

function createDayAttendeesHref(dayId: string) {
  return `/api/days/${dayId}/attendees`;
}

function getDayBookingLabel(status?: BookingStatus) {
  switch (status) {
    case 'booked':
      return 'Manage booking';
    case 'maybe':
      return 'Confirm booking';
    case 'cancelled':
      return 'Restore booking';
    default:
      return 'Add to my bookings';
  }
}

function getAttendanceSummary(
  summaries: DaysFeedData['attendanceSummaries'],
  dayId: string,
): DayAttendanceSummaryPreview {
  return (
    summaries[dayId] ?? {
      attendeeCount: 0,
      accommodationNames: [],
    }
  );
}

function getAttendanceLabel(summary: DayAttendanceSummaryPreview) {
  return `${summary.attendeeCount} attending`;
}

function getAccommodationLabel(summary: DayAttendanceSummaryPreview) {
  if (summary.accommodationNames.length === 0) {
    return 'No shared stay added yet';
  }

  return summary.accommodationNames.join(', ');
}

function getDaySessionText(day: DayRow) {
  if (!day.description) {
    return day.provider;
  }

  return day.description.toLowerCase().includes(day.provider.toLowerCase())
    ? day.description
    : `${day.provider} • ${day.description}`;
}

function getDayTripText(booking?: DayBookingSnapshot) {
  if (!booking) {
    return 'Not in your bookings yet';
  }

  return `My trip: ${titleCase(booking.status)}`;
}

function groupAttendeesByStatus(
  attendees: SharedAttendee[],
): AttendeeStatusGroup[] {
  return [
    {
      key: 'booked',
      label: 'Booked',
      attendees: attendees.filter((attendee) => attendee.status === 'booked'),
    },
    {
      key: 'maybe',
      label: 'Maybe',
      attendees: attendees.filter((attendee) => attendee.status === 'maybe'),
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      attendees: attendees.filter(
        (attendee) => attendee.status === 'cancelled',
      ),
    },
  ];
}

function groupAttendeesBySharedStay(
  attendees: SharedAttendee[],
): SharedStayGroup[] {
  const groups = new Map<string, SharedAttendee[]>();

  for (const attendee of attendees) {
    if (attendee.status === 'cancelled') {
      continue;
    }

    const label = attendee.accommodationName?.trim() || 'No shared stay yet';
    const current = groups.get(label);

    if (current) {
      current.push(attendee);
      continue;
    }

    groups.set(label, [attendee]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === 'No shared stay yet') {
        return 1;
      }
      if (right === 'No shared stay yet') {
        return -1;
      }
      return left.localeCompare(right);
    })
    .map(([label, groupAttendees]) => ({
      label,
      attendees: groupAttendees,
    }));
}

function DayBookingAction({
  day,
  booking,
  presentation = 'compact',
}: {
  day: DayRow;
  booking?: DayBookingSnapshot;
  presentation?: 'compact' | 'panel';
}) {
  const fetcher = useFetcher<CreateBookingActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const isPanel = presentation === 'panel';
  const buttonSize = isPanel ? 'md' : 'sm';
  const containerProps = isPanel
    ? { gap: 'xs' as const }
    : { gap: 4 as const, className: 'table-status' };

  if (booking?.status === 'booked') {
    return (
      <Stack {...containerProps}>
        <Text size="xs" c="dimmed">
          Your status: {titleCase(booking.status)}
        </Text>
        <Button
          component={Link}
          to="/dashboard/bookings"
          size={buttonSize}
          color="brand"
          variant="light"
          w={isPanel ? 'fit-content' : undefined}
        >
          {getDayBookingLabel(booking.status)}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack {...containerProps}>
      {booking ? (
        <Text size="xs" c="dimmed">
          Your status: {titleCase(booking.status)}
        </Text>
      ) : null}

      <fetcher.Form method="post">
        <input type="hidden" name="dayId" value={day.dayId} />
        <input type="hidden" name="date" value={day.date} />
        <input type="hidden" name="type" value={day.type} />
        <input type="hidden" name="circuit" value={day.circuit} />
        <input type="hidden" name="provider" value={day.provider} />
        <input type="hidden" name="description" value={day.description} />
        <input type="hidden" name="status" value="booked" />
        <Button
          type="submit"
          size={buttonSize}
          color="brand"
          variant={booking ? 'light' : 'filled'}
          leftSection={<IconPlus size={14} />}
          loading={isSubmitting}
          w={isPanel ? 'fit-content' : undefined}
        >
          {getDayBookingLabel(booking?.status)}
        </Button>
      </fetcher.Form>

      {formError ? (
        <Text size="xs" c="red">
          {formError}
        </Text>
      ) : null}
    </Stack>
  );
}

function DayListItem({
  day,
  summary,
  booking,
  selected,
  href,
}: {
  day: DayRow;
  summary: DayAttendanceSummaryPreview;
  booking?: DayBookingSnapshot;
  selected: boolean;
  href: string;
}) {
  return (
    <UnstyledButton
      component={Link}
      to={href}
      preventScrollReset
      aria-current={selected ? 'page' : undefined}
      aria-label={`${selected ? 'Hide details for' : 'View details for'} ${
        day.circuit
      }`}
      className="day-list-item"
      data-active={selected || undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Group align="flex-start" wrap="nowrap" gap="md" style={{ flex: 1 }}>
          <Stack gap={2} className="day-list-date">
            <Text size="sm" fw={800}>
              {formatDayListDate(day.date)}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {formatDayListWeekday(day.date)}
            </Text>
          </Stack>

          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Group
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
              gap="sm"
            >
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={700} lineClamp={1}>
                  {day.circuit}
                </Text>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {getDaySessionText(day)}
                </Text>
              </Stack>

              <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
                <Badge color={typeColor(day.type)} size="sm">
                  {titleCase(day.type)}
                </Badge>
                {booking ? (
                  <Badge
                    color={bookingColor(booking.status)}
                    variant="light"
                    size="sm"
                  >
                    {titleCase(booking.status)}
                  </Badge>
                ) : null}
              </Stack>
            </Group>

            <Text size="sm" lineClamp={1}>
              {getAttendanceLabel(summary)} • {getAccommodationLabel(summary)}
            </Text>

            <Text size="xs" c="dimmed" lineClamp={1}>
              {getDayTripText(booking)}
            </Text>
          </Stack>
        </Group>

        <Text size="xs" fw={700} c={selected ? 'brand.7' : 'dimmed'}>
          {selected ? 'Hide' : 'View'}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

function DayListPanel({
  days,
  filters,
  attendanceSummaries,
  myBookingsByDay,
  selectedDayId,
}: {
  days: DayRow[];
  filters: DaysIndexData['filters'];
  attendanceSummaries: DaysFeedData['attendanceSummaries'];
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  selectedDayId: string | null;
}) {
  return (
    <Paper className="days-list-panel" p="md">
      <Stack gap={0}>
        {days.map((day, index) => {
          const summary = getAttendanceSummary(attendanceSummaries, day.dayId);
          const booking = myBookingsByDay[day.dayId];
          const selected = day.dayId === selectedDayId;

          return (
            <Fragment key={day.dayId}>
              <DayListItem
                day={day}
                summary={summary}
                booking={booking}
                selected={selected}
                href={
                  selected
                    ? createDaysIndexHref(filters)
                    : createDaysIndexHref(filters, day.dayId)
                }
              />

              {index < days.length - 1 ? <Divider /> : null}
            </Fragment>
          );
        })}
      </Stack>
    </Paper>
  );
}

function AttendeeStatusSection({ group }: { group: AttendeeStatusGroup }) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" gap="md">
        <Text fw={700}>{group.label}</Text>
        <Text size="sm" c="dimmed">
          {group.attendees.length}
        </Text>
      </Group>

      {group.attendees.length > 0 ? (
        <Stack gap="xs">
          {group.attendees.map((attendee, index) => (
            <Fragment key={attendee.bookingId}>
              <Group justify="space-between" align="flex-start" gap="md">
                <Text size="sm" fw={600}>
                  {attendee.userName}
                </Text>
                <Text size="sm" c="dimmed" ta="right">
                  {attendee.accommodationName?.trim() || 'No shared stay yet'}
                </Text>
              </Group>
              {index < group.attendees.length - 1 ? <Divider /> : null}
            </Fragment>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Nobody is in this group.
        </Text>
      )}
    </Stack>
  );
}

function SharedStayAssignments({ attendees }: { attendees: SharedAttendee[] }) {
  const groups = groupAttendeesBySharedStay(attendees);

  if (groups.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No active attendees are attached to this day yet.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          <Group justify="space-between" align="flex-end" gap="md">
            <Stack gap={2}>
              <Text fw={700}>{group.label}</Text>
              <Text size="sm" c="dimmed">
                {group.attendees
                  .map((attendee) => attendee.userName)
                  .join(', ')}
              </Text>
            </Stack>
            <Text size="sm" fw={700} c="dimmed">
              {group.attendees.length}
            </Text>
          </Group>
          {index < groups.length - 1 ? <Divider /> : null}
        </Fragment>
      ))}
    </Stack>
  );
}

function DayDetailContent({
  day,
  summary,
  booking,
  attendanceDetails,
  attendanceLoading,
}: {
  day: DayRow;
  summary: DayAttendanceSummaryPreview;
  booking?: DayBookingSnapshot;
  attendanceDetails?: DayAttendanceDetails | null;
  attendanceLoading?: boolean;
}) {
  const attendeeStatusGroups = attendanceDetails
    ? groupAttendeesByStatus(attendanceDetails.attendees)
    : [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Stack gap={4}>
          <Text size="sm" fw={700} c="brand.7">
            Selected day
          </Text>
          <Title order={2}>{day.circuit}</Title>
          <Text size="sm" c="dimmed">
            {formatDayLongDate(day.date)} • {day.provider}
          </Text>
          <Text size="sm">{day.description || 'No extra details'}</Text>
        </Stack>
        <Stack gap="xs" align="flex-end">
          <Badge color={typeColor(day.type)} size="lg">
            {titleCase(day.type)}
          </Badge>
          {booking ? (
            <Badge color={bookingColor(booking.status)} variant="light">
              {titleCase(booking.status)}
            </Badge>
          ) : (
            <Badge variant="light" color="gray">
              Not added
            </Badge>
          )}
        </Stack>
      </Group>

      <Divider />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Stack gap={4}>
          <Text fw={700}>Provider</Text>
          <Text size="sm">{day.provider}</Text>
          <Text size="sm" c="dimmed">
            {formatDayLongDate(day.date)}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text fw={700}>Group attendance</Text>
          <Text fz={28} fw={800} lh={1}>
            {summary.attendeeCount}
          </Text>
          <Text size="sm" c="dimmed">
            {getAttendanceLabel(summary)}
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text fw={700}>Shared stay</Text>
          <Text size="sm">{getAccommodationLabel(summary)}</Text>
          <Text size="sm" c="dimmed">
            Accommodation names appear here once someone has added them in the
            group plan.
          </Text>
        </Stack>
      </SimpleGrid>

      <Divider />

      <Stack gap="sm">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Text fw={700}>Attendee roster</Text>
            <Text size="sm" c="dimmed">
              Track who is booked, still deciding, or no longer going.
            </Text>
          </Stack>
          {attendanceDetails ? (
            <Text size="sm" fw={700} c="dimmed">
              {attendanceDetails.attendees.length} total
            </Text>
          ) : null}
        </Group>

        {attendanceLoading ? (
          <Group gap="sm">
            <Loader size="sm" color="brand" />
            <Text size="sm" c="dimmed">
              Loading attendee roster
            </Text>
          </Group>
        ) : attendanceDetails ? (
          <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
            {attendeeStatusGroups.map((group) => (
              <AttendeeStatusSection key={group.key} group={group} />
            ))}
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">
            Attendee details are not available yet.
          </Text>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Text fw={700}>Shared stay</Text>
            <Text size="sm" c="dimmed">
              See who is attached to each shared stay name and where the gaps
              still are.
            </Text>
          </Stack>
          <Text size="sm" fw={700} c="dimmed">
            {summary.accommodationNames.length} saved
          </Text>
        </Group>

        {attendanceLoading ? (
          <Group gap="sm">
            <Loader size="sm" color="brand" />
            <Text size="sm" c="dimmed">
              Loading shared stay assignments
            </Text>
          </Group>
        ) : attendanceDetails ? (
          <SharedStayAssignments attendees={attendanceDetails.attendees} />
        ) : (
          <Text size="sm" c="dimmed">
            Shared stay assignments are not available yet.
          </Text>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Text fw={700}>Trip action</Text>
        <Text size="sm" c="dimmed">
          Add this day to your private booking workspace or jump straight to the
          trip you already created.
        </Text>
        <DayBookingAction day={day} booking={booking} presentation="panel" />
      </Stack>
    </Stack>
  );
}

function DayDetailPanel({
  day,
  summary,
  booking,
  attendanceDetails,
  attendanceLoading,
}: {
  day: DayRow;
  summary: DayAttendanceSummaryPreview;
  booking?: DayBookingSnapshot;
  attendanceDetails?: DayAttendanceDetails | null;
  attendanceLoading?: boolean;
}) {
  return (
    <Paper className="days-detail-panel" p="lg">
      <DayDetailContent
        day={day}
        summary={summary}
        booking={booking}
        attendanceDetails={attendanceDetails}
        attendanceLoading={attendanceLoading}
      />
    </Paper>
  );
}

export function AvailableDaysPage({ data }: AvailableDaysPageProps) {
  const [searchParams] = useSearchParams();
  const feedFetcher = useFetcher<DaysFeedData>();
  const attendanceFetcher = useFetcher<DayAttendanceDetails>();
  const [loadedDays, setLoadedDays] = useState<LoadedDaysState>(() =>
    createLoadedDaysState(data),
  );
  const [attendanceDetailsByDay, setAttendanceDetailsByDay] = useState<
    Record<string, DayAttendanceDetails>
  >(() =>
    data.selectedDay && data.selectedDayAttendance
      ? { [data.selectedDay.dayId]: data.selectedDayAttendance }
      : {},
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const previousFilterKeyRef = useRef(data.filterKey);
  const pendingOffsetRef = useRef<number | null>(null);
  const pendingAttendanceDayIdRef = useRef<string | null>(null);
  const processedOffsetsRef = useRef(new Set<number>([data.offset]));
  const activeFilterCount = countActiveFilters(data.filters);
  const selectedDayId = searchParams.get('day')?.trim() || null;
  const loadMoreHref = useMemo(
    () =>
      loadedDays.nextOffset === null
        ? null
        : createDaysFeedHref(data.filters, loadedDays.nextOffset),
    [data.filters, loadedDays.nextOffset],
  );

  useEffect(() => {
    const filtersChanged = previousFilterKeyRef.current !== data.filterKey;
    previousFilterKeyRef.current = data.filterKey;
    pendingOffsetRef.current = null;
    if (filtersChanged) {
      processedOffsetsRef.current = new Set([data.offset]);
    }

    setLoadedDays((current) => {
      if (filtersChanged || current.filterKey !== data.filterKey) {
        return createLoadedDaysState(data);
      }

      const days = mergeDayRows(data.days, current.days);

      return {
        filterKey: data.filterKey,
        days,
        myBookingsByDay: data.myBookingsByDay,
        attendanceSummaries: {
          ...current.attendanceSummaries,
          ...data.attendanceSummaries,
        },
        totalCount: data.totalCount,
        nextOffset: days.length < data.totalCount ? days.length : null,
      };
    });
  }, [data]);

  useEffect(() => {
    const page = feedFetcher.data;
    if (!page || page.filterKey !== previousFilterKeyRef.current) {
      return;
    }

    pendingOffsetRef.current = null;
    if (processedOffsetsRef.current.has(page.offset)) {
      return;
    }

    processedOffsetsRef.current.add(page.offset);
    setLoadedDays((current) => {
      if (current.filterKey !== page.filterKey) {
        return current;
      }

      const days = mergeDayRows(current.days, page.days);

      return {
        ...current,
        days,
        attendanceSummaries: {
          ...current.attendanceSummaries,
          ...page.attendanceSummaries,
        },
        totalCount: page.totalCount,
        nextOffset: page.nextOffset,
      };
    });
  }, [feedFetcher.data]);

  useEffect(() => {
    if (!data.selectedDay || !data.selectedDayAttendance) {
      return;
    }

    const { dayId } = data.selectedDay;
    const attendance = data.selectedDayAttendance;
    setAttendanceDetailsByDay((current) => ({
      ...current,
      [dayId]: attendance,
    }));
  }, [data.selectedDay, data.selectedDayAttendance]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (
      !sentinel ||
      !loadMoreHref ||
      loadedDays.nextOffset === null ||
      feedFetcher.state !== 'idle'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        if (pendingOffsetRef.current === loadedDays.nextOffset) {
          return;
        }

        pendingOffsetRef.current = loadedDays.nextOffset;
        feedFetcher.load(loadMoreHref);
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feedFetcher, loadMoreHref, loadedDays.nextOffset, feedFetcher.state]);

  const selectedDayFromUrl =
    loadedDays.days.find((day) => day.dayId === selectedDayId) ?? null;
  const selectedDayAttendanceDetails = selectedDayFromUrl
    ? (attendanceDetailsByDay[selectedDayFromUrl.dayId] ?? null)
    : null;
  const attendanceLoading =
    Boolean(selectedDayFromUrl) &&
    !selectedDayAttendanceDetails &&
    (attendanceFetcher.state !== 'idle' ||
      pendingAttendanceDayIdRef.current === selectedDayFromUrl?.dayId);

  useEffect(() => {
    if (!selectedDayFromUrl || selectedDayAttendanceDetails) {
      return;
    }

    if (attendanceFetcher.state !== 'idle') {
      return;
    }

    pendingAttendanceDayIdRef.current = selectedDayFromUrl.dayId;
    attendanceFetcher.load(createDayAttendeesHref(selectedDayFromUrl.dayId));
  }, [
    attendanceFetcher,
    attendanceFetcher.state,
    selectedDayAttendanceDetails,
    selectedDayFromUrl,
  ]);

  useEffect(() => {
    if (!attendanceFetcher.data || !pendingAttendanceDayIdRef.current) {
      return;
    }

    const dayId = pendingAttendanceDayIdRef.current;
    pendingAttendanceDayIdRef.current = null;
    setAttendanceDetailsByDay((current) => ({
      ...current,
      [dayId]: attendanceFetcher.data!,
    }));
  }, [attendanceFetcher.data]);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Shared schedule"
        title="Available Days"
        description="Open one live date at a time to review the group plan, shared stay, and your next trip action."
        meta={
          <Stack gap={8}>
            <HeaderStatGrid
              items={[
                {
                  label: 'Matching days',
                  value: loadedDays.totalCount,
                },
                {
                  label: 'Circuits tracked',
                  value: data.circuitOptions.length,
                },
                {
                  label: 'Providers tracked',
                  value: data.providerOptions.length,
                },
                {
                  label: 'Filters applied',
                  value: activeFilterCount,
                },
              ]}
            />
            <Text size="sm" c="dimmed">
              Last refresh {formatRefreshedAt(data.refreshedAt)}
            </Text>
          </Stack>
        }
        actions={
          <Button component={Link} to="/dashboard/bookings" variant="default">
            Open my bookings
          </Button>
        }
      />

      {data.errors.length > 0 ? (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
          Some sources could not be loaded right now:{' '}
          {data.errors
            .map((error) => `${error.source}: ${error.message}`)
            .join(' | ')}
        </Alert>
      ) : null}

      <Paper className="shell-card" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Title order={3}>Refine the feed</Title>
              <Text size="sm" c="dimmed">
                Narrow the calendar by month, circuit, provider, or day type.
              </Text>
            </Stack>
            {activeFilterCount > 0 ? (
              <Button component={Link} to="/dashboard/days" variant="subtle">
                Clear filters
              </Button>
            ) : null}
          </Group>

          <Form method="get">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                <Select
                  name="month"
                  label="Month"
                  placeholder="Any month"
                  data={data.monthOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  defaultValue={data.filters.month}
                  clearable
                />
                <Select
                  name="circuit"
                  label="Circuit"
                  placeholder="Any circuit"
                  data={data.circuitOptions}
                  defaultValue={data.filters.circuit}
                  clearable
                />
                <Select
                  name="provider"
                  label="Provider"
                  placeholder="Any provider"
                  data={data.providerOptions}
                  defaultValue={data.filters.provider}
                  clearable
                />
                <Select
                  name="type"
                  label="Type"
                  placeholder="Any type"
                  data={[
                    { value: 'race_day', label: 'Race day' },
                    { value: 'test_day', label: 'Test day' },
                    { value: 'track_day', label: 'Track day' },
                  ]}
                  defaultValue={data.filters.type}
                  clearable
                />
              </SimpleGrid>

              <Group justify="flex-end">
                <Button type="submit">Apply filters</Button>
              </Group>
            </Stack>
          </Form>
        </Stack>
      </Paper>

      <Paper className="shell-card" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Title order={3}>
                {selectedDayFromUrl ? 'Selected day' : 'Choose a day'}
              </Title>
              <Text size="sm" c="dimmed">
                {selectedDayFromUrl
                  ? 'This day now has the full workspace so you can review the group plan without competing with the scrolling feed.'
                  : 'Scan the live feed, then open one day at a time to inspect the group plan and add it to your bookings.'}
              </Text>
            </Stack>
            {selectedDayFromUrl ? (
              <Button
                component={Link}
                to={createDaysIndexHref(data.filters)}
                variant="subtle"
                preventScrollReset
              >
                Back to available days
              </Button>
            ) : (
              <Text size="sm" c="dimmed">
                Showing {loadedDays.days.length} of {loadedDays.totalCount} days
              </Text>
            )}
          </Group>

          {selectedDayFromUrl ? (
            <DayDetailPanel
              day={selectedDayFromUrl}
              summary={getAttendanceSummary(
                loadedDays.attendanceSummaries,
                selectedDayFromUrl.dayId,
              )}
              booking={loadedDays.myBookingsByDay[selectedDayFromUrl.dayId]}
              attendanceDetails={selectedDayAttendanceDetails}
              attendanceLoading={attendanceLoading}
            />
          ) : loadedDays.days.length > 0 ? (
            <DayListPanel
              days={loadedDays.days}
              filters={data.filters}
              attendanceSummaries={loadedDays.attendanceSummaries}
              myBookingsByDay={loadedDays.myBookingsByDay}
              selectedDayId={null}
            />
          ) : (
            <EmptyStateCard
              title="No days match those filters"
              description="Reset the selection or widen the feed to bring more race, test, and track dates back into view."
              action={
                <Button component={Link} to="/dashboard/days">
                  Show the full feed
                </Button>
              }
            />
          )}

          {!selectedDayFromUrl && loadedDays.nextOffset !== null ? (
            <Box>
              <Stack gap={4} align="center">
                {feedFetcher.state === 'idle' ? (
                  <Text size="sm" c="dimmed">
                    Scroll to load more
                  </Text>
                ) : (
                  <Loader size="sm" color="brand" />
                )}
                <div ref={loadMoreRef} style={{ height: 1 }} />
              </Stack>
            </Box>
          ) : loadedDays.totalCount > 0 ? (
            <Text size="sm" c="dimmed" ta="center">
              All matching days are loaded.
            </Text>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
