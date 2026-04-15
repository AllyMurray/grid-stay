import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Link, useFetcher } from 'react-router';
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

function formatRefreshedAt(value: string) {
  if (!value) {
    return 'Waiting for the first refresh';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
  return {
    filterKey: data.filterKey,
    days: data.days,
    myBookingsByDay: data.myBookingsByDay,
    attendanceSummaries: data.attendanceSummaries,
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

function DayBookingAction({
  day,
  booking,
}: {
  day: DayRow;
  booking?: DayBookingSnapshot;
}) {
  const fetcher = useFetcher<CreateBookingActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  if (booking?.status === 'booked') {
    return (
      <Stack gap={4} className="table-status">
        <Text size="xs" c="dimmed">
          Your status: {titleCase(booking.status)}
        </Text>
        <Button
          component={Link}
          to="/dashboard/bookings"
          size="sm"
          color="brand"
          variant="light"
        >
          {getDayBookingLabel(booking.status)}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={4} className="table-status">
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
          size="sm"
          color="brand"
          variant={booking ? 'light' : 'filled'}
          leftSection={<IconPlus size={14} />}
          loading={isSubmitting}
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

export function AvailableDaysPage({ data }: AvailableDaysPageProps) {
  const feedFetcher = useFetcher<DaysFeedData>();
  const [loadedDays, setLoadedDays] = useState<LoadedDaysState>(() =>
    createLoadedDaysState(data),
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const previousFilterKeyRef = useRef(data.filterKey);
  const pendingOffsetRef = useRef<number | null>(null);
  const processedOffsetsRef = useRef(new Set<number>([data.offset]));
  const activeFilterCount = countActiveFilters(data.filters);
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
              <Title order={3}>Schedule</Title>
              <Text size="sm" c="dimmed">
                Scroll to pull in more rows without reloading the whole day
                feed.
              </Text>
            </Stack>
            <Text size="sm" c="dimmed">
              Showing {loadedDays.days.length} of {loadedDays.totalCount} days
            </Text>
          </Group>

          {loadedDays.days.length > 0 ? (
            <Table.ScrollContainer minWidth={960}>
              <Table
                verticalSpacing="md"
                horizontalSpacing="md"
                highlightOnHover
                striped
                stickyHeader
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Circuit</Table.Th>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Group plan</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loadedDays.days.map((day) => {
                    const summary = loadedDays.attendanceSummaries[
                      day.dayId
                    ] ?? {
                      attendeeCount: 0,
                      accommodationNames: [],
                    };
                    const myBooking = loadedDays.myBookingsByDay[day.dayId];

                    return (
                      <Table.Tr key={day.dayId}>
                        <Table.Td>
                          <Text fw={700}>{day.date}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={typeColor(day.type)}>
                            {titleCase(day.type)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{day.circuit}</Table.Td>
                        <Table.Td>{day.provider}</Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {day.description || 'No extra details'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={700}>
                              {summary.attendeeCount} attending
                            </Text>
                            <Text size="sm" c="dimmed">
                              {summary.accommodationNames.length > 0
                                ? summary.accommodationNames.join(', ')
                                : 'No shared stay added yet'}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <DayBookingAction day={day} booking={myBooking} />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
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
