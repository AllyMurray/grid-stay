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
  Table,
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

function formatDayLongDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDayDesktopDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

interface DayAttendanceSummary {
  attendeeCount: number;
  accommodationNames: string[];
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
): DayAttendanceSummary {
  return (
    summaries[dayId] ?? {
      attendeeCount: 0,
      accommodationNames: [],
    }
  );
}

function getAttendanceLabel(summary: DayAttendanceSummary) {
  return `${summary.attendeeCount} attending`;
}

function getAccommodationLabel(summary: DayAttendanceSummary) {
  if (summary.accommodationNames.length === 0) {
    return 'No shared stay added yet';
  }

  return summary.accommodationNames.join(', ');
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
  active,
  current,
  href,
}: {
  day: DayRow;
  summary: DayAttendanceSummary;
  booking?: DayBookingSnapshot;
  active: boolean;
  current: boolean;
  href: string;
}) {
  return (
    <UnstyledButton
      component={Link}
      to={href}
      preventScrollReset
      aria-current={current ? 'page' : undefined}
      className="day-list-item"
      data-active={active || undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} className="day-list-date">
          <Text size="sm" fw={800}>
            {formatDayListDate(day.date)}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {day.provider}
          </Text>
        </Stack>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group
            justify="space-between"
            align="flex-start"
            gap="xs"
            wrap="nowrap"
          >
            <Text fw={700} lineClamp={1}>
              {day.circuit}
            </Text>
            <Badge color={typeColor(day.type)} size="sm">
              {titleCase(day.type)}
            </Badge>
          </Group>
          <Text size="sm" lineClamp={1}>
            {getAttendanceLabel(summary)} • {getAccommodationLabel(summary)}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {booking
              ? `Your status: ${titleCase(booking.status)}`
              : day.description || 'No extra details'}
          </Text>
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

function DayListPanel({
  days,
  filters,
  attendanceSummaries,
  myBookingsByDay,
  activeDayId,
  currentDayId,
}: {
  days: DayRow[];
  filters: DaysIndexData['filters'];
  attendanceSummaries: DaysFeedData['attendanceSummaries'];
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  activeDayId: string | null;
  currentDayId: string | null;
}) {
  return (
    <Paper className="days-list-panel" p="md">
      <Stack gap="sm">
        {days.map((day, index) => (
          <div key={day.dayId}>
            <DayListItem
              day={day}
              summary={getAttendanceSummary(attendanceSummaries, day.dayId)}
              booking={myBookingsByDay[day.dayId]}
              active={day.dayId === activeDayId}
              current={day.dayId === currentDayId}
              href={createDaysIndexHref(filters, day.dayId)}
            />
            {index < days.length - 1 ? <Divider /> : null}
          </div>
        ))}
      </Stack>
    </Paper>
  );
}

function DesktopDayTable({
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
    <Paper className="days-list-panel" p={0}>
      <Table.ScrollContainer minWidth={1040}>
        <Table
          className="day-table"
          verticalSpacing="md"
          horizontalSpacing="md"
          highlightOnHover
        >
          <colgroup>
            <col className="day-table-col-date" />
            <col className="day-table-col-session" />
            <col className="day-table-col-provider" />
            <col className="day-table-col-plan" />
            <col className="day-table-col-trip" />
            <col className="day-table-col-action" />
          </colgroup>
          <Table.Thead>
            <Table.Tr className="day-table-header">
              <Table.Th>Date</Table.Th>
              <Table.Th>Session</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Group plan</Table.Th>
              <Table.Th>Your trip</Table.Th>
              <Table.Th ta="right">Details</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {days.map((day) => {
              const summary = getAttendanceSummary(
                attendanceSummaries,
                day.dayId,
              );
              const booking = myBookingsByDay[day.dayId];
              const isExpanded = day.dayId === selectedDayId;

              return (
                <Fragment key={day.dayId}>
                  <Table.Tr
                    className="day-table-row"
                    data-active={isExpanded || undefined}
                  >
                    <Table.Td className="day-table-date-cell">
                      <Text fw={800}>{formatDayListDate(day.date)}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDayDesktopDate(day.date)}
                      </Text>
                    </Table.Td>
                    <Table.Td className="day-table-session-cell">
                      <Stack gap={4}>
                        <Group gap="xs" wrap="nowrap">
                          <Text fw={700}>{day.circuit}</Text>
                          <Badge color={typeColor(day.type)} size="sm">
                            {titleCase(day.type)}
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {day.description || 'No extra details'}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{day.provider}</Text>
                    </Table.Td>
                    <Table.Td className="day-table-plan-cell">
                      <Stack gap={2}>
                        <Text size="sm" fw={700}>
                          {getAttendanceLabel(summary)}
                        </Text>
                        <Text size="sm" c="dimmed" lineClamp={2}>
                          {getAccommodationLabel(summary)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td className="day-table-trip-cell">
                      {booking ? (
                        <Stack gap={4}>
                          <Badge
                            color={bookingColor(booking.status)}
                            variant="light"
                            w="fit-content"
                          >
                            {titleCase(booking.status)}
                          </Badge>
                          <Text size="sm" c="dimmed">
                            {getDayBookingLabel(booking.status)}
                          </Text>
                        </Stack>
                      ) : (
                        <Stack gap={4}>
                          <Text size="sm" fw={700}>
                            Not added
                          </Text>
                          <Text size="sm" c="dimmed">
                            Open details to add this date.
                          </Text>
                        </Stack>
                      )}
                    </Table.Td>
                    <Table.Td className="day-table-action-cell">
                      <Button
                        component={Link}
                        to={
                          isExpanded
                            ? createDaysIndexHref(filters)
                            : createDaysIndexHref(filters, day.dayId)
                        }
                        variant={isExpanded ? 'default' : 'subtle'}
                        size="compact-sm"
                        preventScrollReset
                        aria-label={`${
                          isExpanded ? 'Hide details for' : 'View details for'
                        } ${day.circuit}`}
                      >
                        {isExpanded ? 'Hide' : 'View'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                  {isExpanded ? (
                    <Table.Tr className="day-table-detail-row">
                      <Table.Td colSpan={6} className="day-table-detail-cell">
                        <Box className="day-table-detail">
                          <DayDetailContent
                            day={day}
                            summary={summary}
                            booking={booking}
                            dismissHref={createDaysIndexHref(filters)}
                            dismissLabel="Close details"
                            compact
                          />
                        </Box>
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                </Fragment>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function DayDetailContent({
  day,
  summary,
  booking,
  dismissHref,
  dismissLabel,
  compact = false,
}: {
  day: DayRow;
  summary: DayAttendanceSummary;
  booking?: DayBookingSnapshot;
  dismissHref?: string;
  dismissLabel?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Text size="sm" fw={700} c="brand.7">
              Selected session
            </Text>
            <Title order={3}>{day.circuit}</Title>
            <Text size="sm" c="dimmed">
              {formatDayLongDate(day.date)} • {day.provider}
            </Text>
            <Text size="sm">{day.description || 'No extra details'}</Text>
          </Stack>
          <Stack gap="xs" align="flex-end">
            {dismissHref ? (
              <Button
                component={Link}
                to={dismissHref}
                variant="subtle"
                size="compact-sm"
                preventScrollReset
              >
                {dismissLabel || 'Close'}
              </Button>
            ) : null}
            <Badge color={typeColor(day.type)}>{titleCase(day.type)}</Badge>
            {booking ? (
              <Badge color={bookingColor(booking.status)} variant="light">
                {titleCase(booking.status)}
              </Badge>
            ) : null}
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Stack gap={4}>
            <Text fw={700}>Group plan</Text>
            <Text fw={700}>{getAttendanceLabel(summary)}</Text>
            <Text size="sm" c="dimmed">
              {getAccommodationLabel(summary)}
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text fw={700}>Provider</Text>
            <Text size="sm">{day.provider}</Text>
            <Text size="sm" c="dimmed">
              {formatDayLongDate(day.date)}
            </Text>
          </Stack>
          <Stack gap="sm">
            <Text fw={700}>Trip action</Text>
            <DayBookingAction
              day={day}
              booking={booking}
              presentation="panel"
            />
          </Stack>
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {dismissHref ? (
        <Button
          component={Link}
          to={dismissHref}
          variant="subtle"
          w="fit-content"
          preventScrollReset
        >
          {dismissLabel || 'Back'}
        </Button>
      ) : null}

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
          ) : null}
        </Stack>
      </Group>

      <Divider />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
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
        <Text fw={700}>Trip action</Text>
        <Text size="sm" c="dimmed">
          Add this date to your private booking workspace or jump over to manage
          the trip you already created.
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
  backHref,
}: {
  day: DayRow;
  summary: DayAttendanceSummary;
  booking?: DayBookingSnapshot;
  backHref?: string;
}) {
  return (
    <Paper className="days-detail-panel days-detail-sticky" p="lg">
      <DayDetailContent
        day={day}
        summary={summary}
        booking={booking}
        dismissHref={backHref}
        dismissLabel="Back to available days"
      />
    </Paper>
  );
}

export function AvailableDaysPage({ data }: AvailableDaysPageProps) {
  const [searchParams] = useSearchParams();
  const feedFetcher = useFetcher<DaysFeedData>();
  const [loadedDays, setLoadedDays] = useState<LoadedDaysState>(() =>
    createLoadedDaysState(data),
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const previousFilterKeyRef = useRef(data.filterKey);
  const pendingOffsetRef = useRef<number | null>(null);
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
  const mobileSelectedDay = selectedDayFromUrl;
  const mobileBackHref = createDaysIndexHref(data.filters);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Shared schedule"
        title="Available Days"
        description="Start with the live calendar, then move straight into the trip plan when a date is worth locking in."
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
              <Title order={3}>Available sessions</Title>
              <Text size="sm" c="dimmed">
                Review the live feed, then focus one date at a time before you
                add it to your bookings.
              </Text>
            </Stack>
            <Text size="sm" c="dimmed">
              Showing {loadedDays.days.length} of {loadedDays.totalCount} days
            </Text>
          </Group>

          {loadedDays.days.length > 0 ? (
            <>
              {mobileSelectedDay ? (
                <Stack hiddenFrom="lg" gap="md">
                  <DayDetailPanel
                    day={mobileSelectedDay}
                    summary={getAttendanceSummary(
                      loadedDays.attendanceSummaries,
                      mobileSelectedDay.dayId,
                    )}
                    booking={
                      loadedDays.myBookingsByDay[mobileSelectedDay.dayId]
                    }
                    backHref={mobileBackHref}
                  />
                </Stack>
              ) : (
                <Stack hiddenFrom="lg" gap="md">
                  <DayListPanel
                    days={loadedDays.days}
                    filters={data.filters}
                    attendanceSummaries={loadedDays.attendanceSummaries}
                    myBookingsByDay={loadedDays.myBookingsByDay}
                    activeDayId={null}
                    currentDayId={null}
                  />
                </Stack>
              )}

              <Box visibleFrom="lg">
                <DesktopDayTable
                  days={loadedDays.days}
                  filters={data.filters}
                  attendanceSummaries={loadedDays.attendanceSummaries}
                  myBookingsByDay={loadedDays.myBookingsByDay}
                  selectedDayId={selectedDayFromUrl?.dayId ?? null}
                />
              </Box>
            </>
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

          {loadedDays.nextOffset !== null ? (
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
