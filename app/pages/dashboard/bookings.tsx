import {
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
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
import { PageHeader } from '~/components/layout/page-header';
import { TripStatusSummary } from '~/components/layout/trip-status-summary';
import type { BookingEditorActionResult } from '~/lib/bookings/actions.server';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { UserGarageShareRequest } from '~/lib/db/services/garage-sharing.server';
import type { GarageShareDecisionActionResult } from '~/lib/garage-sharing/actions.server';

export interface MyBookingsPageProps {
  bookings: BookingRecord[];
  garageShareRequests?: UserGarageShareRequest[];
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

function bookingGarageSummary(booking: BookingRecord) {
  if (!booking.garageBooked) {
    return 'No garage shared yet';
  }

  const capacity = booking.garageCapacity ?? 2;
  const label = booking.garageLabel?.trim();
  return label ? `${label} • ${capacity} cars` : `Garage • ${capacity} cars`;
}

function garageRequestStatusColor(status: UserGarageShareRequest['status']) {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'approved':
      return 'green';
    case 'declined':
      return 'gray';
    case 'cancelled':
      return 'gray';
  }
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
  return formatDateOnly(date, {
    day: 'numeric',
    month: 'short',
  });
}

function formatBookingMonth(date: string) {
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
    booking.garageLabel,
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
          {bookingSharedSummary(booking)} • {bookingGarageSummary(booking)}
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

function GarageShareRequestList({
  title,
  emptyText,
  requests,
}: {
  title: string;
  emptyText: string;
  requests: UserGarageShareRequest[];
}) {
  const fetcher = useFetcher<GarageShareDecisionActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const submitStatus = (
    request: UserGarageShareRequest,
    status: 'approved' | 'declined' | 'cancelled',
  ) => {
    fetcher.submit(
      {
        intent: 'updateGarageShareRequest',
        requestId: request.requestId,
        status,
      },
      { method: 'post' },
    );
  };

  return (
    <Stack gap="xs">
      <Text fw={700}>{title}</Text>
      {formError ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {formError}
        </Alert>
      ) : null}
      {requests.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyText}
        </Text>
      ) : (
        <Stack gap="xs">
          {requests.map((request) => (
            <Paper key={request.requestId} withBorder p="sm" radius="md">
              <Group justify="space-between" align="flex-start" gap="md">
                <Stack gap={4}>
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" fw={700}>
                      {request.isIncoming
                        ? request.requesterName
                        : request.garageOwnerName}
                    </Text>
                    <Badge
                      color={garageRequestStatusColor(request.status)}
                      variant="light"
                    >
                      {titleCase(request.status)}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {request.circuit} • {request.provider}
                  </Text>
                </Stack>

                {request.isIncoming && request.status === 'pending' ? (
                  <Group gap="xs" justify="flex-end">
                    <Button
                      type="button"
                      size="compact-sm"
                      variant="default"
                      disabled={isSubmitting}
                      onClick={() => submitStatus(request, 'declined')}
                    >
                      Decline
                    </Button>
                    <Button
                      type="button"
                      size="compact-sm"
                      loading={isSubmitting}
                      onClick={() => submitStatus(request, 'approved')}
                    >
                      Approve
                    </Button>
                  </Group>
                ) : request.status === 'pending' ||
                  request.status === 'approved' ? (
                  <Button
                    type="button"
                    size="compact-sm"
                    variant="default"
                    loading={isSubmitting}
                    onClick={() => submitStatus(request, 'cancelled')}
                  >
                    Cancel
                  </Button>
                ) : null}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function BookingEditorPanel({
  booking,
  garageShareRequests,
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
  garageShareRequests: UserGarageShareRequest[];
}) {
  const [
    deleteModalOpened,
    { close: closeDeleteModal, open: openDeleteModal },
  ] = useDisclosure(false);
  const saveFetcher = useFetcher<BookingEditorActionResult>();
  const deleteFetcher = useFetcher<BookingEditorActionResult>();
  const isSaving = saveFetcher.state !== 'idle';
  const isDeleting = deleteFetcher.state !== 'idle';
  const fieldErrors =
    saveFetcher.data && !saveFetcher.data.ok
      ? saveFetcher.data.fieldErrors
      : undefined;
  const formError =
    saveFetcher.data && !saveFetcher.data.ok
      ? saveFetcher.data.formError
      : null;
  const deleteFormError =
    deleteFetcher.data && !deleteFetcher.data.ok
      ? deleteFetcher.data.formError
      : null;
  const incomingGarageRequests = garageShareRequests.filter(
    (request) =>
      request.isIncoming &&
      request.dayId === booking.dayId &&
      request.garageBookingId === booking.bookingId,
  );
  const outgoingGarageRequests = garageShareRequests.filter(
    (request) =>
      request.isOutgoing &&
      (request.requesterBookingId === booking.bookingId ||
        request.dayId === booking.dayId),
  );

  useEffect(() => {
    if (deleteFetcher.state === 'idle' && deleteFetcher.data?.ok) {
      closeDeleteModal();
    }
  }, [closeDeleteModal, deleteFetcher.data, deleteFetcher.state]);

  return (
    <>
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Delete booking?"
        centered
      >
        <deleteFetcher.Form method="post">
          <input type="hidden" name="bookingId" value={booking.bookingId} />
          <input type="hidden" name="intent" value="deleteBooking" />
          <Stack gap="md">
            <Text size="sm">
              This removes {booking.circuit} from your trips and updates the
              shared attendance for that day.
            </Text>

            {deleteFormError ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />}>
                {deleteFormError}
              </Alert>
            ) : null}

            <Group justify="flex-end" wrap="wrap">
              <Button
                type="button"
                variant="default"
                onClick={closeDeleteModal}
              >
                Cancel
              </Button>
              <Button type="submit" color="red" loading={isDeleting}>
                Delete booking
              </Button>
            </Group>
          </Stack>
        </deleteFetcher.Form>
      </Modal>

      <Paper
        className="shell-card booking-editor-panel"
        p={{ base: 'md', sm: 'lg' }}
      >
        <saveFetcher.Form method="post">
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
                <Text size="sm">
                  {booking.description || 'No extra details'}
                </Text>
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
                icon={<IconUsers size={16} />}
                title="Garage sharing"
                description="Garage availability is visible to active attendees for this day."
                color="orange"
              />
              <Switch
                name="garageBooked"
                value="true"
                label={
                  <BookingFieldLabel
                    label="Garage booked"
                    visibility="Visible to the group"
                    visibilityColor="orange.7"
                  />
                }
                description="Turn this on when you have a garage and can share spare space."
                defaultChecked={Boolean(booking.garageBooked)}
              />
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <NumberInput
                  name="garageCapacity"
                  label={
                    <BookingFieldLabel
                      label="Garage capacity"
                      visibility="Includes your car"
                      visibilityColor="orange.7"
                    />
                  }
                  description="Most garages hold two cars."
                  defaultValue={booking.garageCapacity ?? 2}
                  min={1}
                  max={20}
                  error={fieldErrors?.garageCapacity?.[0]}
                />
                <TextInput
                  name="garageLabel"
                  label={
                    <BookingFieldLabel
                      label="Garage label"
                      visibility="Visible to the group"
                      visibilityColor="orange.7"
                    />
                  }
                  description="Optional garage number, block, or note."
                  defaultValue={booking.garageLabel ?? ''}
                  error={fieldErrors?.garageLabel?.[0]}
                  maxLength={120}
                />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <GarageShareRequestList
                  title="Requests to my garage"
                  emptyText="No one has asked to share this garage yet."
                  requests={incomingGarageRequests}
                />
                <GarageShareRequestList
                  title="My garage requests"
                  emptyText="You have not asked to share another garage for this trip."
                  requests={outgoingGarageRequests}
                />
              </SimpleGrid>
            </Stack>

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

            <Group justify="space-between" wrap="wrap">
              <Button
                type="button"
                color="red"
                variant="subtle"
                onClick={openDeleteModal}
              >
                Delete booking
              </Button>
              <Button
                type="submit"
                name="intent"
                value="updateBooking"
                loading={isSaving}
              >
                Save changes
              </Button>
            </Group>
          </Stack>
        </saveFetcher.Form>
      </Paper>
    </>
  );
}

export function MyBookingsPage({
  bookings,
  garageShareRequests = [],
}: MyBookingsPageProps) {
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
          <TripStatusSummary
            totalCount={bookings.length}
            confirmedCount={bookedCount}
            maybeCount={maybeCount}
            sharedStayCount={sharedStayCount}
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
        <Grid gap={{ base: 'md', sm: 'lg' }} align="start">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper
              className="shell-card booking-list-panel"
              p={{ base: 'sm', sm: 'md' }}
            >
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

                <Grid gap="sm">
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
                garageShareRequests={garageShareRequests}
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
