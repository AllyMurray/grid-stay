import {
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { UpdateBookingActionResult } from '~/lib/bookings/actions.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

export interface MyBookingsPageProps {
  bookings: BookingRecord[];
}

type BookingFilter = 'all' | BookingRecord['status'];

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function bookingListSummary(booking: BookingRecord) {
  if (booking.accommodationName) {
    return booking.accommodationName;
  }

  if (booking.status === 'cancelled') {
    return 'Cancelled trip';
  }

  return 'No accommodation shared yet';
}

function bookingPrivateSummary(booking: BookingRecord) {
  if (booking.bookingReference) {
    return `Reference ${booking.bookingReference}`;
  }

  if (booking.notes) {
    return 'Private notes saved';
  }

  return 'No private references yet';
}

function formatBookingDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

function formatBookingMonth(date: string) {
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

function matchesBookingQuery(booking: BookingRecord, query: string) {
  if (!query) {
    return true;
  }

  const value = query.toLowerCase();
  return [
    booking.circuit,
    booking.provider,
    booking.date,
    booking.description,
    booking.accommodationName,
    booking.bookingReference,
  ].some((field) => field?.toLowerCase().includes(value));
}

function groupBookingsByMonth(bookings: BookingRecord[]) {
  const groups = new Map<string, BookingRecord[]>();

  for (const booking of bookings) {
    const label = formatBookingMonth(booking.date);
    const current = groups.get(label);
    if (current) {
      current.push(booking);
      continue;
    }

    groups.set(label, [booking]);
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function BookingListItem({
  booking,
  active,
  onSelect,
}: {
  booking: BookingRecord;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="booking-list-item"
      data-active={active || undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} className="booking-list-date">
          <Text size="sm" fw={800}>
            {formatBookingDate(booking.date)}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {booking.provider}
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
              {booking.circuit}
            </Text>
            <Badge color={bookingColor(booking.status)} size="sm">
              {titleCase(booking.status)}
            </Badge>
          </Group>
          <Text size="sm" lineClamp={1}>
            {bookingListSummary(booking)}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {bookingPrivateSummary(booking)}
          </Text>
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

function BookingEditorPanel({
  booking,
  selectedIndex,
  totalBookings,
  hasPrevious,
  hasNext,
  onSelectPrevious,
  onSelectNext,
}: {
  booking: BookingRecord;
  selectedIndex: number;
  totalBookings: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onSelectPrevious: () => void;
  onSelectNext: () => void;
}) {
  const fetcher = useFetcher<UpdateBookingActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  return (
    <Paper className="shell-card booking-editor-panel" p="lg">
      <fetcher.Form method="post">
        <input type="hidden" name="bookingId" value={booking.bookingId} />
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" fw={700} c="brand.7">
                Editing trip {selectedIndex + 1} of {totalBookings}
              </Text>
              <Title order={2}>{booking.circuit}</Title>
              <Text size="sm" c="dimmed">
                {booking.date} • {booking.provider}
              </Text>
              <Text size="sm">{booking.description || 'No extra details'}</Text>
            </Stack>
            <Stack gap="sm" align="flex-end">
              <Badge color={bookingColor(booking.status)} size="lg">
                {titleCase(booking.status)}
              </Badge>
              <Group gap="xs">
                <Button
                  type="button"
                  size="compact-sm"
                  variant="default"
                  onClick={onSelectPrevious}
                  disabled={!hasPrevious}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="compact-sm"
                  variant="default"
                  onClick={onSelectNext}
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </Group>
            </Stack>
          </Group>

          <Divider />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Select
              name="status"
              label="Status"
              defaultValue={booking.status}
              data={[
                { value: 'booked', label: 'Booked' },
                { value: 'maybe', label: 'Maybe' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              error={fieldErrors?.status?.[0]}
            />
            <TextInput
              name="bookingReference"
              label="Booking reference"
              defaultValue={booking.bookingReference ?? ''}
              error={fieldErrors?.bookingReference?.[0]}
              maxLength={120}
            />
            <TextInput
              name="accommodationName"
              label="Accommodation name"
              defaultValue={booking.accommodationName ?? ''}
              error={fieldErrors?.accommodationName?.[0]}
              maxLength={120}
            />
            <TextInput
              name="accommodationReference"
              label="Accommodation reference"
              defaultValue={booking.accommodationReference ?? ''}
              error={fieldErrors?.accommodationReference?.[0]}
              maxLength={120}
            />
          </SimpleGrid>

          <Textarea
            name="notes"
            label="Private notes"
            minRows={4}
            defaultValue={booking.notes ?? ''}
            error={fieldErrors?.notes?.[0]}
            maxLength={1000}
          />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Stack gap={2}>
              <Text fw={700}>Shared with the group</Text>
              <Text size="sm" c="dimmed">
                {booking.accommodationName || 'Nothing yet'}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text fw={700}>Visible only to you</Text>
              <Text size="sm" c="dimmed">
                Booking reference, accommodation reference, and notes
              </Text>
            </Stack>
          </SimpleGrid>

          {formError ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {formError}
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </fetcher.Form>
    </Paper>
  );
}

export function MyBookingsPage({ bookings }: MyBookingsPageProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    bookings[0]?.bookingId ?? null,
  );
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const bookedCount = bookings.filter(
    (booking) => booking.status === 'booked',
  ).length;
  const maybeCount = bookings.filter(
    (booking) => booking.status === 'maybe',
  ).length;
  const sharedStayCount = new Set(
    bookings
      .map((booking) => booking.accommodationName?.trim())
      .filter((name): name is string => Boolean(name)),
  ).size;
  const sortedBookings = useMemo(
    () => [...bookings].sort(sortBookings),
    [bookings],
  );
  const filteredBookings = useMemo(
    () =>
      sortedBookings.filter((booking) => {
        if (statusFilter !== 'all' && booking.status !== statusFilter) {
          return false;
        }

        return matchesBookingQuery(booking, searchQuery.trim());
      }),
    [searchQuery, sortedBookings, statusFilter],
  );
  const bookingSections = useMemo(
    () => groupBookingsByMonth(filteredBookings),
    [filteredBookings],
  );
  const selectedBooking = useMemo(
    () =>
      filteredBookings.find(
        (booking) => booking.bookingId === selectedBookingId,
      ) ??
      filteredBookings[0] ??
      null,
    [filteredBookings, selectedBookingId],
  );
  const selectedIndex = selectedBooking
    ? filteredBookings.findIndex(
        (booking) => booking.bookingId === selectedBooking.bookingId,
      )
    : -1;

  useEffect(() => {
    if (filteredBookings.length === 0) {
      setSelectedBookingId(null);
      return;
    }

    if (
      selectedBookingId &&
      filteredBookings.some(
        (booking) => booking.bookingId === selectedBookingId,
      )
    ) {
      return;
    }

    setSelectedBookingId(filteredBookings[0].bookingId);
  }, [filteredBookings, selectedBookingId]);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Private trip details"
        title="My Bookings"
        description="Keep your references tidy here while the accommodation name stays visible to the rest of the group."
        meta={
          <HeaderStatGrid
            items={[
              {
                label: 'Trips tracked',
                value: bookings.length,
              },
              {
                label: 'Confirmed',
                value: bookedCount,
              },
              {
                label: 'Still deciding',
                value: maybeCount,
              },
              {
                label: 'Shared stays',
                value: sharedStayCount,
              },
            ]}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/days" variant="default">
            Back to available days
          </Button>
        }
      />

      {bookings.length === 0 ? (
        <EmptyStateCard
          title="No bookings yet"
          description="Start from the live days feed, add the next trip, and come back here when you need to store the private references."
          action={
            <Button component={Link} to="/dashboard/days">
              Browse available days
            </Button>
          }
        />
      ) : (
        <Grid gutter="lg" align="start">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper className="shell-card booking-list-panel" p="md">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <Stack gap={2}>
                    <Title order={3}>Trips</Title>
                    <Text size="sm" c="dimmed">
                      Choose a booking to review or edit.
                    </Text>
                  </Stack>
                  <Text size="sm" fw={700} c="dimmed">
                    {filteredBookings.length} shown
                  </Text>
                </Group>

                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 7, lg: 12, xl: 7 }}>
                    <TextInput
                      aria-label="Search trips"
                      placeholder="Search circuit, provider, stay, or reference"
                      value={searchQuery}
                      onChange={(event) =>
                        setSearchQuery(event.currentTarget.value)
                      }
                      leftSection={<IconSearch size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 5, lg: 12, xl: 5 }}>
                    <Select
                      aria-label="Filter trips by status"
                      comboboxProps={{ withinPortal: false }}
                      value={statusFilter}
                      onChange={(value) =>
                        setStatusFilter(
                          (value as BookingFilter | null) ?? 'all',
                        )
                      }
                      data={[
                        { value: 'all', label: 'All statuses' },
                        { value: 'booked', label: 'Booked' },
                        { value: 'maybe', label: 'Maybe' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                    />
                  </Grid.Col>
                </Grid>

                <ScrollArea.Autosize
                  offsetScrollbars
                  className="booking-list-scroll"
                >
                  {filteredBookings.length > 0 ? (
                    <Stack gap="lg">
                      {bookingSections.map((section) => (
                        <Stack key={section.label} gap="xs">
                          <Text
                            size="sm"
                            fw={700}
                            c="dimmed"
                            className="booking-section-label"
                          >
                            {section.label}
                          </Text>
                          <Stack gap={0}>
                            {section.items.map((booking, index) => (
                              <div key={booking.bookingId}>
                                <BookingListItem
                                  booking={booking}
                                  active={
                                    booking.bookingId ===
                                    selectedBooking?.bookingId
                                  }
                                  onSelect={() =>
                                    setSelectedBookingId(booking.bookingId)
                                  }
                                />
                                {index < section.items.length - 1 ? (
                                  <Divider />
                                ) : null}
                              </div>
                            ))}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Stack gap="sm" py="sm">
                      <Text fw={700}>No trips match that view</Text>
                      <Text size="sm" c="dimmed">
                        Clear the search or widen the status filter to bring
                        more bookings back into the list.
                      </Text>
                      <Group>
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                        >
                          Clear filters
                        </Button>
                      </Group>
                    </Stack>
                  )}
                </ScrollArea.Autosize>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 8 }}>
            {selectedBooking ? (
              <BookingEditorPanel
                key={selectedBooking.bookingId}
                booking={selectedBooking}
                selectedIndex={selectedIndex}
                totalBookings={filteredBookings.length}
                hasPrevious={selectedIndex > 0}
                hasNext={
                  selectedIndex >= 0 &&
                  selectedIndex < filteredBookings.length - 1
                }
                onSelectPrevious={() =>
                  setSelectedBookingId(
                    filteredBookings[Math.max(0, selectedIndex - 1)]
                      ?.bookingId ?? selectedBooking.bookingId,
                  )
                }
                onSelectNext={() =>
                  setSelectedBookingId(
                    filteredBookings[
                      Math.min(filteredBookings.length - 1, selectedIndex + 1)
                    ]?.bookingId ?? selectedBooking.bookingId,
                  )
                }
              />
            ) : null}
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
