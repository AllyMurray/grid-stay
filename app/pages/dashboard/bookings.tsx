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
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconLock,
  IconRoad,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
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

function bookingSharedSummary(booking: BookingRecord) {
  if (booking.accommodationName) {
    return booking.accommodationName;
  }

  if (booking.status === 'cancelled') {
    return 'No shared stay on this trip';
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

function BookingFieldLabel({
  label,
  visibility,
  visibilityColor = 'dimmed',
}: {
  label: string;
  visibility: string;
  visibilityColor?: string;
}) {
  return (
    <Group gap={6} wrap="wrap" align="center">
      <Text span fw={700} size="sm">
        {label}
      </Text>
      <Text span size="xs" c={visibilityColor}>
        {visibility}
      </Text>
    </Group>
  );
}

function BookingSectionHeading({
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
    <Stack gap={2}>
      <Group gap="xs" align="center">
        <ThemeIcon size={28} radius="sm" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Text fw={700}>{title}</Text>
      </Group>
      <Text size="sm" c="dimmed">
        {description}
      </Text>
    </Stack>
  );
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
      <div className="booking-list-item-grid">
        <Stack gap={4} className="booking-list-date">
          <Text size="sm" fw={800}>
            {formatBookingDate(booking.date)}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {booking.provider}
          </Text>
        </Stack>
        <Text className="booking-list-title" fw={700} lineClamp={1}>
          {booking.circuit}
        </Text>
        <Badge
          className="booking-list-badge"
          color={bookingColor(booking.status)}
          size="sm"
        >
          {titleCase(booking.status)}
        </Badge>
        <Text className="booking-list-shared" size="sm" lineClamp={1}>
          <Text span className="booking-list-kicker">
            Shared
          </Text>{' '}
          {bookingSharedSummary(booking)}
        </Text>
        <Text
          className="booking-list-private"
          size="xs"
          c="dimmed"
          lineClamp={1}
        >
          <Text
            span
            className="booking-list-kicker booking-list-kicker-private"
          >
            Private
          </Text>{' '}
          {bookingPrivateSummary(booking)}
        </Text>
      </div>
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

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="xl">
            <Stack gap="md" className="booking-editor-section">
              <BookingSectionHeading
                icon={<IconRoad size={16} />}
                title="Trip plan"
                description="Keep the status current before you lock in the rest of the trip."
                color="brand"
              />
              <Select
                name="status"
                label={
                  <BookingFieldLabel
                    label="Status"
                    visibility="Affects your trip plan"
                    visibilityColor="brand.7"
                  />
                }
                description="Use booked, maybe, or cancelled to keep this trip current."
                defaultValue={booking.status}
                data={[
                  { value: 'booked', label: 'Booked' },
                  { value: 'maybe', label: 'Maybe' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                error={fieldErrors?.status?.[0]}
              />
            </Stack>

            <Stack gap="md" className="booking-editor-section">
              <BookingSectionHeading
                icon={<IconUsers size={16} />}
                title="Shared with the group"
                description="The stay name is the part everyone coordinating this weekend can see."
                color="blue"
              />
              <TextInput
                name="accommodationName"
                label={
                  <BookingFieldLabel
                    label="Accommodation name"
                    visibility="Visible to the group"
                    visibilityColor="blue.6"
                  />
                }
                description="Use the same stay name the rest of the group is working from."
                defaultValue={booking.accommodationName ?? ''}
                error={fieldErrors?.accommodationName?.[0]}
                maxLength={120}
              />
              <Text size="sm" c="dimmed">
                {booking.accommodationName
                  ? `${booking.accommodationName} is the current shared stay name for this trip.`
                  : 'Add the accommodation name once the group has settled on a stay.'}
              </Text>
            </Stack>
          </SimpleGrid>

          <Stack gap="md" className="booking-editor-section">
            <BookingSectionHeading
              icon={<IconLock size={16} />}
              title="Private to you"
              description="References and notes stay on your side and do not appear in the shared plan."
              color="gray"
            />
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <TextInput
                name="bookingReference"
                label={
                  <BookingFieldLabel
                    label="Booking reference"
                    visibility="Visible only to you"
                  />
                }
                description="Store the confirmation code or internal reference here."
                defaultValue={booking.bookingReference ?? ''}
                error={fieldErrors?.bookingReference?.[0]}
                maxLength={120}
              />
              <TextInput
                name="accommodationReference"
                label={
                  <BookingFieldLabel
                    label="Accommodation reference"
                    visibility="Visible only to you"
                  />
                }
                description="Useful for the hotel confirmation, booking id, or door code."
                defaultValue={booking.accommodationReference ?? ''}
                error={fieldErrors?.accommodationReference?.[0]}
                maxLength={120}
              />
            </SimpleGrid>

            <Textarea
              name="notes"
              label={
                <BookingFieldLabel
                  label="Private notes"
                  visibility="Visible only to you"
                />
              }
              description="Keep arrival notes, reminders, or anything else you do not want in the shared plan."
              minRows={4}
              defaultValue={booking.notes ?? ''}
              error={fieldErrors?.notes?.[0]}
              maxLength={1000}
            />
          </Stack>

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
        description="Keep shared stay names aligned with the group while references and notes stay on your side."
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
